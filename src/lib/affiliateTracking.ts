/**
 * Affiliate click tracking.
 *
 * Loggar ett klick på en affiliate-länk INNAN webbläsaren öppnar målet.
 * Använder navigator.sendBeacon när möjligt (skickas garanterat även om sidan
 * navigerar bort) och faller tillbaka på en vanlig fetch med keepalive.
 *
 * Klick skrivs direkt mot Supabase REST API:t — INSERT-rättigheter finns för
 * `anon` med strikta längdbegränsningar via RLS-policyn.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SESSION_KEY = 'hg_aff_session';

export type AffiliateClickSource =
  | 'product_box'
  | 'banner'
  | 'glossary'
  | 'app_widget'
  | 'comparison'
  | 'recommended'
  | 'other';

export interface AffiliateClickPayload {
  product_id?: string | null;
  banner_id?: string | null;
  advertiser: string;
  source: AffiliateClickSource;
  slug?: string | null;
  section_title?: string | null;
  href: string;
}

export interface AffiliateImpressionPayload {
  product_id?: string | null;
  advertiser: string;
  source: AffiliateClickSource;
  slug?: string | null;
  section_title?: string | null;
}

function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}

function postJson(endpoint: string, body: string): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: 'return=minimal',
  };
  try {
    void fetch(endpoint, {
      method: 'POST',
      headers,
      body,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    }).catch(() => {});
  } catch {
    // tracking får aldrig påverka UX
  }
}

export function trackAffiliateClick(payload: AffiliateClickPayload): void {
  const body = JSON.stringify({
    product_id: truncate(payload.product_id ?? null, 100),
    banner_id: truncate(payload.banner_id ?? null, 100),
    advertiser: truncate(payload.advertiser, 100),
    source: payload.source,
    slug: truncate(payload.slug ?? null, 500),
    section_title: truncate(payload.section_title ?? null, 300),
    path: truncate(typeof window !== 'undefined' ? window.location.pathname : null, 500),
    href: truncate(payload.href, 2000),
    session_id: getSessionId(),
    user_agent: truncate(typeof navigator !== 'undefined' ? navigator.userAgent : null, 500),
    referer: truncate(typeof document !== 'undefined' ? document.referrer : null, 1000),
  });
  postJson(`${SUPABASE_URL}/rest/v1/affiliate_clicks`, body);
}

const seenImpressions = new Set<string>();

export function trackAffiliateImpression(payload: AffiliateImpressionPayload): void {
  const session = getSessionId();
  const dedupe = [
    session,
    payload.slug ?? '',
    payload.section_title ?? '',
    payload.product_id ?? '',
    payload.advertiser,
  ].join('|');
  if (seenImpressions.has(dedupe)) return;
  seenImpressions.add(dedupe);

  const body = JSON.stringify({
    product_id: truncate(payload.product_id ?? null, 100),
    advertiser: truncate(payload.advertiser, 100),
    source: payload.source,
    slug: truncate(payload.slug ?? null, 500),
    section_title: truncate(payload.section_title ?? null, 300),
    path: truncate(typeof window !== 'undefined' ? window.location.pathname : null, 500),
    session_id: session,
    user_agent: truncate(typeof navigator !== 'undefined' ? navigator.userAgent : null, 500),
    referer: truncate(typeof document !== 'undefined' ? document.referrer : null, 1000),
  });
  postJson(`${SUPABASE_URL}/rest/v1/affiliate_impressions`, body);
}
