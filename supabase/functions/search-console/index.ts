import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const SITE_URL = "https://www.honsgarden.se/";

async function gw(path: string, init: RequestInit = {}) {
  const LK = Deno.env.get("LOVABLE_API_KEY");
  const CK = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");
  if (!LK) throw new Error("LOVABLE_API_KEY not set");
  if (!CK) throw new Error("GOOGLE_SEARCH_CONSOLE_API_KEY not set");
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${LK}`,
      "X-Connection-Api-Key": CK,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`GSC ${path} [${res.status}]: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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

    const { action = "overview", days = 28, dimension = "query", site = SITE_URL } = await req.json().catch(() => ({}));
    const siteEnc = encodeURIComponent(site);

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - Number(days));
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    if (action === "sites") {
      const data = await gw(`/webmasters/v3/sites`);
      return Response.json(data, { headers: corsHeaders });
    }

    if (action === "search") {
      const data = await gw(`/webmasters/v3/sites/${siteEnc}/searchAnalytics/query`, {
        method: "POST",
        body: JSON.stringify({
          startDate, endDate,
          dimensions: [dimension],
          rowLimit: 50,
        }),
      });
      return Response.json(data, { headers: corsHeaders });
    }

    if (action === "sitemaps") {
      const data = await gw(`/webmasters/v3/sites/${siteEnc}/sitemaps`);
      return Response.json(data, { headers: corsHeaders });
    }

    if (action === "submit-sitemap") {
      const { sitemap } = await req.json().catch(() => ({}));
      const sm = sitemap || `${site.replace(/\/$/, "")}/sitemap.xml`;
      await gw(`/webmasters/v3/sites/${siteEnc}/sitemaps/${encodeURIComponent(sm)}`, { method: "PUT" });
      return Response.json({ ok: true, sitemap: sm }, { headers: corsHeaders });
    }

    // overview: totals + top queries + top pages + sitemaps
    const [totals, queries, pages, sitemaps] = await Promise.all([
      gw(`/webmasters/v3/sites/${siteEnc}/searchAnalytics/query`, {
        method: "POST",
        body: JSON.stringify({ startDate, endDate, dimensions: [] }),
      }),
      gw(`/webmasters/v3/sites/${siteEnc}/searchAnalytics/query`, {
        method: "POST",
        body: JSON.stringify({ startDate, endDate, dimensions: ["query"], rowLimit: 25 }),
      }),
      gw(`/webmasters/v3/sites/${siteEnc}/searchAnalytics/query`, {
        method: "POST",
        body: JSON.stringify({ startDate, endDate, dimensions: ["page"], rowLimit: 25 }),
      }),
      gw(`/webmasters/v3/sites/${siteEnc}/sitemaps`).catch(() => ({ sitemap: [] })),
    ]);

    return Response.json(
      { site, startDate, endDate, totals: totals.rows?.[0] ?? null, queries: queries.rows ?? [], pages: pages.rows ?? [], sitemaps: sitemaps.sitemap ?? [] },
      { headers: corsHeaders },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("search-console error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
