/**
 * Central, typesäker Plausible-helper.
 *
 * - Plausible-snippetten i `index.html` (`pa-*.js`) laddar och initierar
 *   trackern och auto-spårar pageviews inkl. SPA-navigering via History API.
 *   Vi lägger därför INTE till någon manuell pageview-tracking här; det skulle
 *   ge dubbla pageviews.
 * - Denna helper är den enda tillåtna vägen för att skicka events från
 *   applikationen. Håll event-namn och properties strikt typade och med låg
 *   kardinalitet. Skicka aldrig personuppgifter, fritext, e-post, namn,
 *   användar-id, hönsnamn eller andra unika identifierare.
 * - Admin- och interna personalsidor exkluderas via `exclude`-inställningen
 *   i `plausible.init(...)` i `index.html` OCH som säkerhetsnät här.
 */

/** Path-prefix som aldrig ska ge events (interna/admin-vyer). */
const EXCLUDED_PATH_PREFIXES = ['/app/admin'] as const;

/** Tillåtna plan-värden (låg kardinalitet). */
export type AnalyticsPlan = 'free' | 'plus';

/** Tillåtna faktureringsintervall (låg kardinalitet). */
export type AnalyticsBillingInterval = 'monthly' | 'yearly';

/** Tillåtna trafik/kontext-source-värden (låg kardinalitet). */
export type AnalyticsSource =
  | 'premium_page'
  | 'dashboard'
  | 'eggs_page'
  | 'hen_profile'
  | 'quick_fab'
  | 'quick_log_card'
  | 'signup_form'
  | 'landing_hero'
  | 'landing_navbar'
  | 'landing_final_cta'
  | 'demo_banner'
  | 'blog_header'
  | 'blog_inline'
  | 'blog_final'
  | 'blog_sidebar'
  | 'blog_popup';

/** Tillåtna OAuth-leverantörer (låg kardinalitet). */
export type AnalyticsOAuthProvider = 'google' | 'apple';

/** Tillåtna auth-lägen (låg kardinalitet). */
export type AnalyticsAuthMode = 'login' | 'register';

/**
 * Strikt event-map. Endast dessa event får skickas.
 * Håll properties låga och icke-identifierande.
 */
export type AnalyticsEventMap = {
  'Signup Started': {
    source?: AnalyticsSource;
  };
  'Signup Completed': {
    source?: AnalyticsSource;
  };
  'OAuth Started': {
    provider?: AnalyticsOAuthProvider;
    mode?: AnalyticsAuthMode;
  };
  'CTA Register Clicked': {
    source?: AnalyticsSource;
  };
  'Premium Checkout Started': {
    plan?: AnalyticsPlan;
    billing_interval?: AnalyticsBillingInterval;
    source?: AnalyticsSource;
  };
  'Premium Purchased': {
    plan?: AnalyticsPlan;
    billing_interval?: AnalyticsBillingInterval;
  };
  'First Egg Logged': {
    source?: AnalyticsSource;
  };
  'Smart Upsell Shown': {
    trigger?: string;
  };
  'Smart Upsell Clicked': {
    trigger?: string;
  };
  'Smart Upsell Dismissed': {
    trigger?: string;
  };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;

type PlausibleFn = (
  event: string,
  options?: { props?: Record<string, string | number | boolean | undefined> },
) => void;

declare global {
  interface Window {
    plausible?: PlausibleFn & { q?: unknown[]; o?: unknown };
  }
}

function isExcludedPath(pathname: string): boolean {
  return EXCLUDED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function sanitizeProps(
  props: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> | undefined {
  if (!props) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === '') continue;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      out[key] = value;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Skicka ett typat Plausible-event.
 * Failar tyst om Plausible inte är laddad eller pathen är exkluderad.
 */
export function trackEvent<E extends AnalyticsEventName>(
  event: E,
  props?: AnalyticsEventMap[E],
): void {
  try {
    if (typeof window === 'undefined') return;
    const path = window.location?.pathname ?? '';
    if (isExcludedPath(path)) return;
    const plausible = window.plausible;
    if (typeof plausible !== 'function') return;
    const cleanProps = sanitizeProps(props as Record<string, unknown> | undefined);
    plausible(event, cleanProps ? { props: cleanProps } : undefined);
  } catch {
    // analytics får aldrig krascha appen
  }
}

const FIRST_EGG_FLAG = 'hg_first_egg_tracked_v1';

/**
 * Fire "First Egg Logged" en gång per enhet.
 * Anropas efter faktiskt lyckad äggloggning från valfri UI-yta.
 */
export function trackFirstEggIfNew(source: AnalyticsSource): void {
  try {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(FIRST_EGG_FLAG)) return;
    localStorage.setItem(FIRST_EGG_FLAG, '1');
    trackEvent('First Egg Logged', { source });
  } catch {
    // localStorage kan vara blockerat i privat läge
  }
}

/** Alla tillåtna source-värden i runtime (för validering av query-params). */
export const ANALYTICS_SOURCES = [
  'premium_page',
  'dashboard',
  'eggs_page',
  'hen_profile',
  'quick_fab',
  'quick_log_card',
  'signup_form',
  'landing_hero',
  'landing_navbar',
  'landing_final_cta',
  'demo_banner',
  'blog_header',
  'blog_inline',
  'blog_final',
  'blog_sidebar',
  'blog_popup',
] as const satisfies readonly AnalyticsSource[];

/**
 * Validera en (potentiellt godtycklig) sträng från t.ex. en query-param mot
 * de tillåtna source-värdena. Fritext släpps aldrig igenom till analytics.
 */
export function parseAnalyticsSource(
  value: string | null | undefined,
  fallback: AnalyticsSource = 'signup_form',
): AnalyticsSource {
  if (!value) return fallback;
  return (ANALYTICS_SOURCES as readonly string[]).includes(value)
    ? (value as AnalyticsSource)
    : fallback;
}
