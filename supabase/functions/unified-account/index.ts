import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "npm:stripe@22.6.0";
import { bundleAccess } from "../_shared/unifiedBilling.ts";
const domains = {
  hens: "https://honsgarden.se",
  garden: "https://odlingsdagboken.com",
};
type App = keyof typeof domains;
const isBanned = (user: unknown) =>
  !!user && typeof user === "object" && "banned_until" in user &&
  typeof user.banned_until === "string" &&
  Date.parse(user.banned_until) > Date.now();
const project = {
  hens: Deno.env.get("SUPABASE_URL")!,
  garden: "https://ysonnvbkrwajacvdkqut.supabase.co",
};
const admin = createClient(
  project.hens,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
function gardenAdmin() {
  const key = Deno.env.get("GARDEN_SERVICE_ROLE_KEY");
  if (!key) throw new Error("Kontokopplingen är inte tillgänglig just nu.");
  return createClient(project.garden, key);
}
function client(app: App) {
  return app === "hens" ? admin : gardenAdmin();
}
const headersFor = (req: Request) => ({
  "Access-Control-Allow-Origin":
    Object.values(domains).includes(req.headers.get("origin") || "")
      ? req.headers.get("origin")!
      : "https://honsgarden.se",
  "Vary": "Origin",
  "Access-Control-Allow-Headers":
    "authorization,content-type,apikey,x-client-info",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
});
Deno.serve(async (req) => {
  const headers = headersFor(req);
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Metoden stöds inte" }, 405);
  try {
    if (Number(req.headers.get("content-length") || 0) > 5000) {
      return reply({ error: "För stor förfrågan" }, 413);
    }
    const reader = req.body?.getReader();
    let raw = "";
    const decoder = new TextDecoder();
    if (reader) {
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
        if (bytes > 5000) {
          await reader.cancel();
          return reply({ error: "För stor förfrågan" }, 413);
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    }
    const body = JSON.parse(raw);
    const app: App = body.app;
    if (app !== "hens" && app !== "garden") {
      return reply({ error: "Okänd app" }, 400);
    }
    if (
      Deno.env.get("UNIFIED_ACCOUNT_ENABLED") !== "true" ||
      !Deno.env.get("GARDEN_SERVICE_ROLE_KEY")
    ) return reply({ available: false, linked: false, active: false });
    const action = body.action;
    // Login transfer is authorized exclusively by an expiring, single-use ticket from an authenticated source session.
    if (action === "complete-login") {
      const { data: ticket, error } = await admin.rpc(
        "consume_unified_ticket",
        { p_token: String(body.ticket || ""), p_app: app, p_kind: "login" },
      );
      if (error) {
        throw new Error(
          "Länken har gått ut. Öppna appen från det andra kontot igen.",
        );
      }
      const origin = await client(ticket.source_app as App).auth.admin
        .getUserById(ticket.source_user_id);
      const target = await client(app).auth.admin.getUserById(
        ticket.target_user_id,
      );
      if (
        origin.error || target.error || !origin.data.user?.email_confirmed_at ||
        !target.data.user?.email_confirmed_at || !target.data.user.email ||
        isBanned(origin.data.user) || isBanned(target.data.user)
      ) {
        throw new Error(
          "Kontot kunde inte bekräftas. Logga in på vanligt sätt.",
        );
      }
      const { data: link, error: linkError } = await client(app).auth.admin
        .generateLink({ type: "magiclink", email: target.data.user.email });
      if (linkError || !link.properties?.hashed_token) {
        throw new Error("Inloggningen kunde inte slutföras.");
      }
      return reply({ token_hash: link.properties.hashed_token });
    }
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Logga in först" }, 401);
    const { data: { user }, error: authError } = await client(app).auth.getUser(
      token,
    );
    if (authError || !user?.email_confirmed_at) {
      return reply({ error: "Logga in med ett bekräftat konto" }, 401);
    }
    const { data: account, error: accountError } = await admin.from(
      "unified_accounts",
    ).select("*").eq(
      app === "hens" ? "hens_user_id" : "garden_user_id",
      user.id,
    ).maybeSingle();
    if (accountError) throw accountError;
    if (action === "create-link" || action === "create-login") {
      if (action === "create-login" && !account) {
        throw new Error("Koppla kontona först.");
      }
      const kind = action === "create-link" ? "link" : "login";
      const { data: ticket, error } = await admin.rpc("mint_unified_ticket", {
        p_app: app,
        p_user: user.id,
        p_kind: kind,
      });
      if (error) throw new Error("Länken kunde inte skapas. Försök senare.");
      const target = app === "hens" ? "garden" : "hens";
      return reply({
        url: `${domains[target]}/auth/connect#ticket=${ticket}&mode=${kind}`,
      });
    }
    if (action === "complete-link") {
      const { error } = await admin.rpc("consume_unified_ticket", {
        p_token: String(body.ticket || ""),
        p_app: app,
        p_kind: "link",
        p_user: user.id,
      });
      if (error) {
        throw new Error(
          "Kontona kunde inte kopplas. Länken kan ha gått ut eller ett konto kan redan vara kopplat.",
        );
      }
      return reply({ linked: true });
    }
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const priceId = Deno.env.get("STRIPE_BUNDLE_PRICE_ID");
    const stripe = stripeKey
      ? new Stripe(stripeKey, { apiVersion: "2026-08-26.dahlia" })
      : null;
    let active = !!stripe && !!priceId && account?.bundle_status === "active" &&
      Date.parse(account.active_until || "") > Date.now();
    let until = account?.active_until;
    if (account?.stripe_subscription_id && stripe) {
      // Timestamp the lookup before waiting for Stripe; a slower response must
      // not overwrite a later cancellation or a replacement subscription.
      const observed = new Date().toISOString();
      const sub = await stripe.subscriptions.retrieve(
        account.stripe_subscription_id,
      );
      const access = bundleAccess(sub, priceId);
      active = access.active;
      until = access.until;
      const { data: updated, error } = await admin.from("unified_accounts")
        .update({
          bundle_status: access.active
            ? "active"
            : sub.status === "active"
            ? "none"
            : sub.status,
          active_until: until,
          verified_at: observed,
        }).eq("id", account.id)
        .eq("stripe_subscription_id", account.stripe_subscription_id)
        .or(`verified_at.is.null,verified_at.lt.${observed}`)
        .select("id");
      if (error) throw error;
      if (!updated?.length) {
        throw new Error("Abonnemanget uppdateras. Försök igen.");
      }
      for (const which of ["hens", "garden"] as App[]) {
        const { error } = await client(which).rpc("apply_bundle_entitlement", {
          p_user: which === "hens"
            ? account.hens_user_id
            : account.garden_user_id,
          p_active: active,
          p_until: until,
          p_observed: observed,
        });
        if (error) throw error;
      }
    }
    if (action === "prepare-account-deletion" || action === "unlink") {
      if (!account) return reply({ cleared: true });
      if (account.stripe_customer_id) {
        if (!stripe) {
          throw new Error(
            "Abonnemanget kunde inte kontrolleras. Försök igen innan kontot tas bort.",
          );
        }
        const subscriptions = await stripe.subscriptions.list({
          customer: account.stripe_customer_id,
          status: "all",
          limit: 100,
        });
        const owned = subscriptions.data.filter((s) =>
          s.metadata.unified_account_id === account.id &&
          !["canceled", "incomplete_expired"].includes(s.status)
        );
        if (action === "unlink" && owned.length) {
          throw new Error(
            "Avsluta kombopaketet först och vänta tills den betalda perioden har löpt ut.",
          );
        }
        for (const sub of owned) {
          await stripe.subscriptions.cancel(sub.id, {
            prorate: false,
            invoice_now: false,
          });
        }
        const sessions = await stripe.checkout.sessions.list({
          customer: account.stripe_customer_id,
          status: "open",
          limit: 100,
        });
        for (const session of sessions.data) {
          if (session.metadata?.unified_account_id === account.id) {
            await stripe.checkout.sessions.expire(session.id);
          }
        }
      }
      const observed = new Date().toISOString();
      for (const which of ["hens", "garden"] as App[]) {
        const { error } = await client(which).rpc("apply_bundle_entitlement", {
          p_user: which === "hens"
            ? account.hens_user_id
            : account.garden_user_id,
          p_active: false,
          p_until: null,
          p_observed: observed,
        });
        if (error) throw error;
      }
      const { error: ticketsError } = await admin.from(
        "unified_account_tickets",
      ).delete().in("source_user_id", [
        account.hens_user_id,
        account.garden_user_id,
      ]);
      if (ticketsError) throw ticketsError;
      const { error: removeError } = await admin.from("unified_accounts")
        .delete().eq("id", account.id);
      if (removeError) throw removeError;
      return reply({ cleared: true });
    }
    if (action === "status") {
      let price = null;
      if (priceId && stripe) {
        const p = await stripe.prices.retrieve(priceId);
        if (
          p.active && p.recurring && p.unit_amount !== null &&
          p.unit_amount > 0 && p.currency === "sek" &&
          p.tax_behavior === "inclusive"
        ) {
          price = {
            amount: p.unit_amount / 100,
            currency: "SEK",
            interval: p.recurring.interval,
            count: p.recurring.interval_count,
          };
        }
      }
      return reply({
        available: true,
        linked: !!account,
        active: !!active,
        until: until ?? null,
        price,
        can_buy: Deno.env.get("BUNDLE_CHECKOUT_ENABLED") === "true",
        can_manage: !!account?.stripe_customer_id,
      });
    }
    if (!account) throw new Error("Koppla båda kontona innan du väljer paket.");
    if (!stripe) {
      throw new Error("Abonnemangshanteringen är inte tillgänglig just nu.");
    }
    if (action === "portal") {
      if (!account.stripe_customer_id) {
        throw new Error("Du har inget kombopaket att hantera.");
      }
      const session = await stripe.billingPortal.sessions.create({
        customer: account.stripe_customer_id,
        return_url: domains[app] + "/app/settings",
      });
      return reply({ url: session.url });
    }
    if (action === "checkout") {
      if (!priceId || Deno.env.get("BUNDLE_CHECKOUT_ENABLED") !== "true") {
        throw new Error("Kombopaketet går inte att köpa ännu.");
      }
      if (active) {
        throw new Error("Du har redan kombopaketet. Välj Hantera abonnemang.");
      }
      const price = await stripe.prices.retrieve(priceId);
      if (
        !price.active || !price.recurring || price.unit_amount === null ||
        price.unit_amount <= 0 || price.currency !== "sek" ||
        price.tax_behavior !== "inclusive"
      ) throw new Error("Paketets pris kunde inte bekräftas.");
      // Native subscriptions and existing app plans must be handled before starting another recurring charge.
      for (const which of ["hens", "garden"] as App[]) {
        const id = which === "hens"
          ? account.hens_user_id
          : account.garden_user_id;
        const { data: p, error } = await client(which).from("profiles").select(
          "subscription_status,premium_expires_at,created_at",
        ).eq("user_id", id).single();
        if (error) {
          throw new Error(
            "Dina befintliga abonnemang kunde inte kontrolleras.",
          );
        }
        const days = which === "hens" ? 7 : 14;
        const signupTrial = p.premium_expires_at &&
          Math.abs(
              Date.parse(p.premium_expires_at) - Date.parse(p.created_at) -
                days * 86400000,
            ) < 60000;
        if (
          p.subscription_status === "premium" && !signupTrial &&
          (!p.premium_expires_at ||
            Date.parse(p.premium_expires_at) > Date.now())
        ) {
          throw new Error(
            "Du har redan Plus i en app. Hantera det abonnemanget innan du köper kombopaketet, så undviker du dubbla avgifter.",
          );
        }
      }
      let customer = account.stripe_customer_id;
      if (!customer) {
        const owner = await admin.auth.admin.getUserById(account.hens_user_id);
        if (!owner.data.user?.email) {
          throw new Error("Kontot kunde inte bekräftas.");
        }
        const created = await stripe.customers.create({
          email: owner.data.user.email,
          metadata: { unified_account_id: account.id },
        }, { idempotencyKey: `unified-customer-${account.id}` });
        customer = created.id;
        const { error } = await admin.from("unified_accounts").update({
          stripe_customer_id: customer,
        }).eq("id", account.id);
        if (error) throw error;
      }
      const subs = await stripe.subscriptions.list({
        customer,
        status: "all",
        limit: 100,
      });
      if (
        subs.data.some((s) =>
          ["active", "trialing", "past_due", "unpaid", "paused", "incomplete"]
            .includes(s.status)
        )
      ) {
        throw new Error(
          "Ett abonnemang finns redan. Öppna abonnemangshanteringen.",
        );
      }
      const open = await stripe.checkout.sessions.list({
        customer,
        status: "open",
        limit: 5,
      });
      const existing = open.data.find((s) =>
        s.metadata?.unified_account_id === account.id
      );
      if (existing?.url) return reply({ url: existing.url });
      const suffix = account.id.replaceAll("-", "").slice(0, 8).split("").map((
        n: string,
      ) => String.fromCharCode(97 + parseInt(n, 16))).join("");
      const session = await stripe.checkout.sessions.create({
        customer,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        locale: "sv",
        metadata: { unified_account_id: account.id },
        subscription_data: { metadata: { unified_account_id: account.id } },
        integration_identifier: `garden-hens-bundle-${suffix}`,
        success_url: domains[app] + "/app/settings?bundle=success",
        cancel_url: domains[app] + "/app/settings",
      }, {
        idempotencyKey: `unified-checkout-${account.id}-${
          Math.floor(Date.now() / 1800000)
        }`,
      });
      return reply({ url: session.url });
    }
    return reply({ error: "Okänd åtgärd" }, 400);
  } catch (error) {
    return reply({
      error: error instanceof Error && !("code" in error)
        ? error.message
        : "Åtgärden kunde inte slutföras. Försök igen.",
    }, 400);
  }
});
