import { selectAll } from "../_shared/selectAll.ts";
import { placementRates } from "../_shared/affiliateCtr.ts";
// Affiliate-analys per artikel (views, impressions, klick, CTR, top produkt/annonsör).
// Endast admin.
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveDays } from "./utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims?.sub) return jsonResponse({ error: "Unauthorized" }, 401);
  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: claimsData.claims.sub,
    _role: "admin",
  });
  if (!isAdmin) return jsonResponse({ error: "Forbidden" }, 403);

  // Läs `days` robust: query-param ELLER JSON-body (POST). Klämmer 1..365.
  const url = new URL(req.url);
  const queryParam = url.searchParams.get("days");
  let body: unknown = null;
  if (req.method === "POST") {
    try {
      body = await req.json();
    } catch {
      /* body optional */
    }
  }
  const { days, sinceMs } = resolveDays({ queryParam, body });
  const since = new Date(Date.now() - sinceMs).toISOString();

  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const [clicksRes, impressionsRes, viewsRes] = await Promise.all([
    selectAll(() => service.from("affiliate_clicks").select("slug, session_id, created_at, source, product_id, advertiser, section_title, path").gte("created_at", since).order("id")),
    selectAll(() => service.from("affiliate_impressions").select("slug, session_id, created_at, source, product_id, advertiser, section_title, path").gte("created_at", since).order("id")),
    selectAll(() => service.from("page_views").select("path").gte("created_at", since).order("id")),
  ]);

  if ([clicksRes, impressionsRes, viewsRes].some(res => res.error)) return jsonResponse({ error: "Analysunderlaget kunde inte hämtas" }, 503);
  const clicks = clicksRes.data ?? [];
  const impressions = impressionsRes.data ?? [];
  const views = viewsRes.data ?? [];

  const bySlug: Record<string, {
    slug: string;
    views: number;
    impressions: number;
    clicks: number;
    clicksBySource: Record<string, number>;
    productCounts: Record<string, number>;
    advertiserCounts: Record<string, number>;
  }> = {};

  const ensure = (slug: string) => {
    if (!bySlug[slug]) {
      bySlug[slug] = {
        slug,
        views: 0,
        impressions: 0,
        clicks: 0,
        clicksBySource: {},
        productCounts: {},
        advertiserCounts: {},
      };
    }
    return bySlug[slug];
  };

  for (const v of views) {
    const path = String(v.path ?? "");
    const m = path.match(/^\/blogg\/([^/?#]+)/);
    if (m) ensure(m[1]).views += 1;
  }
  for (const imp of impressions) {
    if (!imp.slug) continue;
    ensure(imp.slug).impressions += 1;
  }
  for (const c of clicks) {
    if (!c.slug) continue;
    const entry = ensure(c.slug);
    entry.clicks += 1;
    const src = String(c.source ?? "other");
    entry.clicksBySource[src] = (entry.clicksBySource[src] || 0) + 1;
    if (c.product_id) entry.productCounts[c.product_id] = (entry.productCounts[c.product_id] || 0) + 1;
    if (c.advertiser) entry.advertiserCounts[c.advertiser] = (entry.advertiserCounts[c.advertiser] || 0) + 1;
  }

  const rates = placementRates(impressions, clicks, row => row.slug);
  const rows = Object.values(bySlug).map((r) => {
    const topProduct = Object.entries(r.productCounts).sort((a, b) => b[1] - a[1])[0];
    const topAdvertiser = Object.entries(r.advertiserCounts).sort((a, b) => b[1] - a[1])[0];
    const ctr = rates.get(r.slug) ?? null;
    return {
      slug: r.slug,
      views: r.views,
      impressions: r.impressions,
      clicks: r.clicks,
      ctr,
      clicks_by_source: r.clicksBySource,
      top_product: topProduct ? { id: topProduct[0], clicks: topProduct[1] } : null,
      top_advertiser: topAdvertiser ? { name: topAdvertiser[0], clicks: topAdvertiser[1] } : null,
    };
  }).sort((a, b) => b.clicks - a.clicks);

  // "Hög trafik, låg CTR" = minst 20 visningar och CTR < 1%
  const lowCtr = rows.filter((r) => r.views >= 20 && r.ctr !== null && r.ctr < 0.01).slice(0, 20);

  return jsonResponse({ days, rows, low_ctr: lowCtr });
});
