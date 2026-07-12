import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Only Hönsgården products
const HONSGARDEN_PRODUCT_IDS = new Set([
  "prod_U1nXjyO3PyPsWS", // Hönsgården årsprenumeration (legacy)
  "prod_U1nW7q52KG8tm4", // Hönsgården årsbetalning (legacy)
  "prod_U1nP6PS9ifMlFy", // Hönsgården månadsvis (legacy)
  "prod_UsFuYFeabfimV4", // Hönsgården Plus (nya priser 39/299 kr, 2026)
]);

function isHonsgardenSub(sub: Stripe.Subscription): boolean {
  return sub.items.data.some((item) => {
    const productId = typeof item.price.product === "string"
      ? item.price.product
      : (item.price.product as Stripe.Product)?.id;
    return HONSGARDEN_PRODUCT_IDS.has(productId);
  });
}

// Extract price/product id from an invoice line — supports legacy `line.price`
// and current `line.pricing.price_details` shapes (API 2025-08-27+).
function lineIds(line: any): { priceId?: string; productId?: string } {
  const direct = line?.price;
  if (direct && typeof direct === "object") {
    const productId = typeof direct.product === "string" ? direct.product : direct.product?.id;
    return { priceId: direct.id, productId };
  }
  if (typeof direct === "string") return { priceId: direct };
  const pd = line?.pricing?.price_details;
  if (pd) return { priceId: pd.price, productId: pd.product };
  return {};
}

function isHonsgardenInvoice(inv: Stripe.Invoice, honsgardenPriceIds: Set<string>): boolean {
  return !!inv.lines?.data?.some((line) => {
    const { priceId, productId } = lineIds(line);
    if (productId && HONSGARDEN_PRODUCT_IDS.has(productId)) return true;
    if (priceId && honsgardenPriceIds.has(priceId)) return true;
    return false;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError) throw new Error(`Auth: ${userError.message}`);
    const uid = userData.user?.id;
    if (!uid) throw new Error("Not authenticated");

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: uid, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch Hönsgården prices for filtering charges
    const honsgardenPriceIds = new Set<string>();
    for (const prodId of HONSGARDEN_PRODUCT_IDS) {
      const prices = await stripe.prices.list({ product: prodId, limit: 100 });
      for (const p of prices.data) {
        honsgardenPriceIds.add(p.id);
      }
    }

    // 1. Fetch subscriptions (only Hönsgården)
    const allSubs: Stripe.Subscription[] = [];
    for (const status of ["active", "trialing", "past_due", "canceled"] as const) {
      let hasMore = true;
      let startingAfter: string | undefined;
      while (hasMore) {
        const batch = await stripe.subscriptions.list({
          status,
          limit: 100,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });
        for (const sub of batch.data) {
          if (isHonsgardenSub(sub)) allSubs.push(sub);
        }
        hasMore = batch.has_more;
        if (batch.data.length > 0) {
          startingAfter = batch.data[batch.data.length - 1].id;
        }
      }
    }

    // 2. Compute metrics
    const now = new Date();
    const activeSubs = allSubs.filter((s) => s.status === "active" || s.status === "trialing");
    const canceledSubs = allSubs.filter((s) => s.status === "canceled");

    let mrr = 0;
    let monthlyCount = 0;
    let yearlyCount = 0;

    for (const sub of activeSubs) {
      const item = sub.items.data[0];
      if (!item) continue;
      const price = item.price;
      const amount = price.unit_amount ?? 0;
      const interval = price.recurring?.interval;

      if (interval === "month") {
        mrr += amount;
        monthlyCount++;
      } else if (interval === "year") {
        mrr += Math.round(amount / 12);
        yearlyCount++;
      }
    }

    // 3. Recent invoices for Hönsgården subscriptions (last 30 days)
    const thirtyDaysAgo = Math.floor((now.getTime() - 30 * 86400000) / 1000);
    const recentPayments: Array<{
      email: string;
      amount: number;
      currency: string;
      date: string;
      plan: string;
      status: string;
    }> = [];

    // Use invoices filtered by subscription to only get Hönsgården payments
    const invoices = await stripe.invoices.list({
      limit: 100,
      created: { gte: thirtyDaysAgo },
      status: "paid",
    });

    for (const inv of invoices.data) {
      // Check if any line item belongs to a Hönsgården price
      const isHG = inv.lines?.data?.some((line) => {
        const priceId = typeof line.price === "string" ? line.price : line.price?.id;
        return priceId && honsgardenPriceIds.has(priceId);
      });
      if (!isHG) continue;

      recentPayments.push({
        email: inv.customer_email ?? "okänd",
        amount: (inv.amount_paid ?? 0) / 100,
        currency: (inv.currency ?? "sek").toUpperCase(),
        date: new Date((inv.created ?? 0) * 1000).toISOString(),
        plan: inv.lines?.data?.[0]?.description ?? "Premium",
        status: "succeeded",
      });
    }

    // 4. Monthly revenue trend (last 6 months)
    const sixMonthsAgo = Math.floor((now.getTime() - 180 * 86400000) / 1000);
    const allInvoices = await stripe.invoices.list({
      limit: 100,
      created: { gte: sixMonthsAgo },
      status: "paid",
    });

    const monthlyRevenue: Record<string, number> = {};
    for (const inv of allInvoices.data) {
      const isHG = inv.lines?.data?.some((line) => {
        const priceId = typeof line.price === "string" ? line.price : line.price?.id;
        return priceId && honsgardenPriceIds.has(priceId);
      });
      if (!isHG) continue;
      const d = new Date((inv.created ?? 0) * 1000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyRevenue[key] = (monthlyRevenue[key] ?? 0) + (inv.amount_paid ?? 0) / 100;
    }

    const revenueTrend = Object.entries(monthlyRevenue)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => ({ month, total: Math.round(total) }));

    // 5. Churn (canceled in last 30 days)
    const recentCanceled = canceledSubs.filter((s) => {
      const canceledAt = s.canceled_at;
      return canceledAt && canceledAt > thirtyDaysAgo;
    });

    const totalRevenue30d = recentPayments.reduce((sum, p) => sum + p.amount, 0);

    const result = {
      mrr: Math.round(mrr / 100),
      arr: Math.round((mrr / 100) * 12),
      active_subscribers: activeSubs.length,
      monthly_subscribers: monthlyCount,
      yearly_subscribers: yearlyCount,
      churn_30d: recentCanceled.length,
      revenue_30d: Math.round(totalRevenue30d),
      recent_payments: recentPayments.slice(0, 20),
      revenue_trend: revenueTrend,
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[admin-revenue]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
