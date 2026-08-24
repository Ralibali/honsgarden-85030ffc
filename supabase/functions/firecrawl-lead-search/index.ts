// Firecrawl-driven lead research for admins.
// Endast admin (verifierad via JWT + user_roles) får anropa.
// FIRECRAWL_API_KEY måste finnas som server-secret; loggas aldrig.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";
const MAX_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 20_000;

type LeadType = "hönsgård" | "gårdsbutik" | "äggproducent" | "reko" | "generisk";

interface RequestBody {
  city?: string;
  region?: string;
  lead_type?: LeadType;
  limit?: number;
  custom_query?: string;
}

interface NormalizedLead {
  name: string;
  business_type: string;
  website: string | null;
  website_domain: string | null;
  public_email: string | null;
  public_phone: string | null;
  city: string | null;
  region: string | null;
  social_urls: Record<string, string>;
  source_url: string;
  source_title: string;
  source_description: string;
  relevance_score: number;
  found_at: string;
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_RE = /(?:\+46[\s-]?|0)(?:\d[\s-]?){7,11}\d/;
const BLOCKED_EMAIL_DOMAINS = ["example.com", "sentry.io", "wixpress.com"];
const BLOCKED_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "google.com",
  "wikipedia.org",
  "reko-ring.se",
  "hitta.se",
  "eniro.se",
  "allabolag.se",
  "blocket.se",
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildQueries(type: LeadType, city: string | undefined, custom?: string): string[] {
  if (custom && custom.trim().length > 0) return [custom.trim().slice(0, 200)];
  const cityPart = city ? city.trim() : "Sverige";
  const map: Record<LeadType, string[]> = {
    hönsgård: [`hönsgård ${cityPart}`, `säljer ägg ${cityPart}`],
    gårdsbutik: [`gårdsbutik ägg ${cityPart}`, `gårdsförsäljning ägg ${cityPart}`],
    äggproducent: [`äggproducent ${cityPart}`, `äggförsäljning ${cityPart}`],
    reko: [`REKO ägg ${cityPart}`, `REKO-ring ${cityPart} ägg`],
    generisk: [`säljer ägg ${cityPart}`, `hönsgård ${cityPart}`, `gårdsbutik ägg ${cityPart}`],
  };
  return map[type] ?? map.generisk;
}

function domainFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isBlockedHost(url: string): boolean {
  const host = domainFromUrl(url);
  if (!host) return true;
  return BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`));
}

function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_RE);
  if (!m) return null;
  const email = m[0].toLowerCase();
  if (BLOCKED_EMAIL_DOMAINS.some((d) => email.endsWith(`@${d}`))) return null;
  if (email.length > 254) return null;
  return email;
}

function extractPhone(text: string): string | null {
  const m = text.match(PHONE_RE);
  if (!m) return null;
  const cleaned = m[0].replace(/[\s-]/g, "");
  return cleaned.length >= 8 && cleaned.length <= 15 ? cleaned : null;
}

function extractSocial(text: string): Record<string, string> {
  const socials: Record<string, string> = {};
  const fb = text.match(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9_.\-\/]+/i);
  const ig = text.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.\-\/]+/i);
  if (fb) socials.facebook = fb[0].slice(0, 300);
  if (ig) socials.instagram = ig[0].slice(0, 300);
  return socials;
}

function normalizeResult(
  result: { url?: string; title?: string; description?: string; content?: string; markdown?: string },
  leadType: string,
  city: string | undefined,
): NormalizedLead | null {
  const url = typeof result.url === "string" ? result.url : "";
  if (!url || isBlockedHost(url)) return null;
  const title = (result.title ?? "").toString().trim().slice(0, 240);
  const description = (result.description ?? "").toString().trim().slice(0, 500);
  const haystack = `${title} ${description} ${result.content ?? ""} ${result.markdown ?? ""}`.slice(0, 20_000);
  const domain = domainFromUrl(url);
  const email = extractEmail(haystack);
  const phone = extractPhone(haystack);
  const socials = extractSocial(haystack);
  if (!title && !domain) return null;

  let score = 0;
  const low = haystack.toLowerCase();
  if (/\bägg\b/.test(low)) score += 20;
  if (/höns/i.test(low)) score += 15;
  if (/reko/i.test(low)) score += 10;
  if (/gårdsbutik|gårdsförsäljning/i.test(low)) score += 10;
  if (email) score += 25;
  if (phone) score += 15;
  if (city && low.includes(city.toLowerCase())) score += 10;

  return {
    name: title || (domain ?? ""),
    business_type: leadType,
    website: url,
    website_domain: domain,
    public_email: email,
    public_phone: phone,
    city: city ?? null,
    region: null,
    social_urls: socials,
    source_url: url,
    source_title: title,
    source_description: description,
    relevance_score: score,
    found_at: new Date().toISOString(),
  };
}

async function firecrawlSearch(
  apiKey: string,
  query: string,
  limit: number,
  location: string | undefined,
): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // Firecrawl v2 Search: top-level `country` + optional `location` string.
    // Ref: https://docs.firecrawl.dev/api-reference/v2-endpoint/search
    const payload: Record<string, unknown> = {
      query,
      limit: Math.min(MAX_LIMIT, limit),
      sources: ["web"],
      country: "SE",
      lang: "sv",
    };
    if (location && location.trim().length > 0) {
      payload.location = location.trim().slice(0, 120);
    }
    const res = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`Firecrawl ${res.status}: ${text.slice(0, 200)}`);
      return [];
    }
    const data = await res.json();
    const web = data?.data?.web ?? data?.web ?? data?.data ?? [];
    return Array.isArray(web) ? web : [];
  } catch (err) {
    console.error("Firecrawl request failed:", err instanceof Error ? err.message : String(err));
    return [];
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "config_missing", message: "FIRECRAWL_API_KEY saknas i backend-konfigurationen." }, 503);
  }

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
  const userId = claimsData.claims.sub as string;

  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) return jsonResponse({ error: "Forbidden" }, 403);

  let body: RequestBody = {};
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const city = typeof body.city === "string" ? body.city.slice(0, 80) : undefined;
  const leadType: LeadType = (["hönsgård", "gårdsbutik", "äggproducent", "reko", "generisk"] as const).includes(
    body.lead_type as LeadType,
  )
    ? (body.lead_type as LeadType)
    : "generisk";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(body.limit) || 10));
  const custom = typeof body.custom_query === "string" ? body.custom_query.slice(0, 200) : undefined;

  const queries = buildQueries(leadType, city, custom);
  const rawResults: unknown[] = [];
  for (const q of queries) {
    const results = await firecrawlSearch(apiKey, q, limit, city);
    rawResults.push(...results);
    if (rawResults.length >= limit * 3) break;
  }

  const normalized: NormalizedLead[] = [];
  const seenDomains = new Set<string>();
  const seenEmails = new Set<string>();
  for (const r of rawResults) {
    const lead = normalizeResult(r as Record<string, string>, leadType, city);
    if (!lead) continue;
    const dedupeKey = (lead.website_domain ?? "") + "|" + (lead.public_email ?? "");
    if (dedupeKey === "|") continue;
    if (lead.website_domain && seenDomains.has(lead.website_domain)) continue;
    if (lead.public_email && seenEmails.has(lead.public_email)) continue;
    if (lead.website_domain) seenDomains.add(lead.website_domain);
    if (lead.public_email) seenEmails.add(lead.public_email);
    normalized.push(lead);
  }

  // Filtrera bort dubbletter som redan finns i sales_leads
  const service = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const domains = normalized.map((l) => l.website_domain).filter(Boolean) as string[];
  const emails = normalized.map((l) => l.public_email).filter(Boolean) as string[];
  const existingDomains = new Set<string>();
  const existingEmails = new Set<string>();
  if (domains.length > 0) {
    const { data } = await service.from("sales_leads").select("website_domain").in("website_domain", domains);
    for (const row of data ?? []) if (row.website_domain) existingDomains.add(row.website_domain);
  }
  if (emails.length > 0) {
    const { data } = await service.from("sales_leads").select("public_email").in("public_email", emails);
    for (const row of data ?? []) if (row.public_email) existingEmails.add(row.public_email);
  }
  const fresh = normalized
    .map((l) => ({ ...l, already_saved: (l.website_domain && existingDomains.has(l.website_domain)) || (l.public_email && existingEmails.has(l.public_email)) }))
    .sort((a, b) => b.relevance_score - a.relevance_score);

  return jsonResponse({ leads: fresh, queries, total: fresh.length });
});
