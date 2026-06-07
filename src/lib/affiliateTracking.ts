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
  | 'other';

export interface AffiliateClickPayload {
  /** Statiskt produkt-id (från affiliateProducts.ts) eller DB-id. */
  product_id?: string | null;
  /** Statiskt banner-id (t.ex. 'bonden-sky-160'). */
  banner_id?: string | null;
  /** Annonsör, t.ex. 'p-lindberg', 'bonden', 'adlibris'. */
  advertiser: string;
  /** Var klicket skedde i UI:t. */
  source: AffiliateClickSource;
  /** Artikelslug om klicket kommer från ett blogginlägg. */
  slug?: string | null;
  /** Faktisk tracking-URL som öppnades. */
  href: string;
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

/**
 * Loggar ett affiliate-klick. Anropet är fire-and-forget och kastar aldrig.
 */
export function trackAffiliateClick(payload: AffiliateClickPayload): void {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

  const body = JSON.stringify({
    product_id: truncate(payload.product_id ?? null, 100),
    banner_id: truncate(payload.banner_id ?? null, 100),
    advertiser: truncate(payload.advertiser, 100),
    source: payload.source,
    slug: truncate(payload.slug ?? null, 500),
    path: truncate(typeof window !== 'undefined' ? window.location.pathname : null, 500),
    href: truncate(payload.href, 2000),
    session_id: getSessionId(),
    user_agent: truncate(typeof navigator !== 'undefined' ? navigator.userAgent : null, 500),
    referer: truncate(typeof document !== 'undefined' ? document.referrer : null, 1000),
  });

  const endpoint = `${SUPABASE_URL}/rest/v1/affiliate_clicks`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: 'return=minimal',
  };

  // sendBeacon klarar inte custom headers → använd bara fetch med keepalive.
  try {
    void fetch(endpoint, {
      method: 'POST',
      headers,
      body,
      keepalive: true,
      mode: 'cors',
      credentials: 'omit',
    }).catch(() => {
      // Tyst – tracking får aldrig påverka UX.
    });
  } catch {
    // ignore
  }
}
