// Delad, strikt CORS-hjälpare för webbshoppens edge functions.
// - Explicit Origin som inte finns i tillåtenlistan → 403 (både OPTIONS och andra metoder).
// - Request utan Origin (server-till-server, curl, webhook, mobil) tillåts men får aldrig en
//   "godkänd" browser-origin i svaret. Vi svarar då utan Access-Control-Allow-Origin så att
//   ingen browser felaktigt uppfattar det som CORS-godkänt.
// - Tillåtna origins läses från fast lista + APP_ALLOWED_ORIGINS (kommaseparerad).

export const ALLOWED_ORIGINS_DEFAULT = [
  "https://honsgarden.se",
  "https://www.honsgarden.se",
  "https://honsgarden.app",
  "https://www.honsgarden.app",
  "https://honsgarden.lovable.app",
  "https://id-preview--f0c63bdf-2baf-4795-b008-16d49fc7d8ae.lovable.app",
];

const COMMON_ALLOW_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

export function allowedOriginsSet(): Set<string> {
  const configured = (Deno.env.get("APP_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return new Set([...ALLOWED_ORIGINS_DEFAULT, ...configured]);
}

function isLocalOrigin(url: URL): boolean {
  return url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
}

/**
 * Returnerar { ok, headers, blocked }.
 * - ok=false och blocked=true om Origin finns men inte är tillåten (svar: 403).
 * - ok=true och headers innehåller Access-Control-Allow-Origin endast om Origin är tillåten.
 *   Saknas Origin: begäran tillåts, men vi lägger inte till Allow-Origin (skyddar mot att en
 *   browser felaktigt läser detta som "godkänt origin").
 */
export function evaluateCors(req: Request): {
  ok: boolean;
  blocked: boolean;
  headers: Record<string, string>;
} {
  const requested = req.headers.get("origin");
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": COMMON_ALLOW_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (!requested) {
    return { ok: true, blocked: false, headers: base };
  }

  let url: URL;
  try {
    url = new URL(requested);
  } catch {
    return { ok: false, blocked: true, headers: base };
  }

  const allowed = allowedOriginsSet();
  if (allowed.has(url.origin) || isLocalOrigin(url)) {
    return {
      ok: true,
      blocked: false,
      headers: { ...base, "Access-Control-Allow-Origin": url.origin },
    };
  }
  return { ok: false, blocked: true, headers: base };
}

export function jsonResponse(
  body: unknown,
  status: number,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

/**
 * Säker "success/cancel-URL"-origin för Stripe Checkout. Returnerar antingen den validerade
 * Origin eller ett stabilt default-hem, aldrig en attackers värde.
 */
export function safeSuccessOrigin(req: Request): string {
  const fallback = "https://honsgarden.se";
  const requested = req.headers.get("origin");
  if (!requested) return fallback;
  try {
    const url = new URL(requested);
    const allowed = allowedOriginsSet();
    if (allowed.has(url.origin) || isLocalOrigin(url)) return url.origin;
  } catch { /* keep default */ }
  return fallback;
}
