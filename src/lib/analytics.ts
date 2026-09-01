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
  | 'onboarding'
  | 'hens_page'
  | 'blog_header'
  | 'blog_inline'
  | 'blog_final'
  | 'blog_sidebar'
  | 'blog_popup'
  | 'orpington'
  | 'sussex'
  | 'bast-honsras';

/** Tillåtna OAuth-leverantörer (låg kardinalitet). */
export type AnalyticsOAuthProvider = 'google' | 'apple';

/** Tillåtna auth-lägen (låg kardinalitet). */
export type AnalyticsAuthMode = 'login' | 'register';

/** Demofunktioner som får förekomma i funnel-events (låg kardinalitet). */
export type AnalyticsDemoFeature =
  | 'egg_log'
  | 'hens'
  | 'calendar'
  | 'marketplace'
  | 'agda_preview'
  | 'reports_preview'
  | 'feed'
  | 'finance';

/** Publika anonyma verktyg under /verktyg/ (låg kardinalitet). */
export type AnalyticsPublicTool =
  | 'aggkalkylator'
  | 'aggregler_vagvisare'
  | 'klackningskalkylator';

/** Onboarding-steg (låg kardinalitet). */
export type AnalyticsOnboardingStep =
  | 'welcome'
  | 'flock_created'
  | 'first_hen'
  | 'first_egg'
  | 'reminder_offered'
  | 'completed';

/** Påminnelsekanaler (låg kardinalitet). */
export type AnalyticsReminderChannel = 'push' | 'email' | 'in_app';

/** Push-permission-resultat (låg kardinalitet). */
export type AnalyticsPushPermission = 'accepted' | 'denied' | 'dismissed' | 'unsupported';

/** Säsongslägen (låg kardinalitet). */
export type AnalyticsSeasonalMode = 'winter' | 'normal';

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

  /* -------- V2 north-star funnel (swarm U) --------
   * Full kedja: demo → signup → första hönan → första ägget → retention.
   * Alla properties är strikt låg-kardinalitet; aldrig fritext eller ID:n. */
  'Demo Opened': {
    source?: AnalyticsSource;
  };
  'Demo Feature Used': {
    feature?: AnalyticsDemoFeature;
  };
  'Demo To Signup': {
    feature?: AnalyticsDemoFeature;
  };
  'First Hen Added': {
    source?: AnalyticsSource;
  };
  'Onboarding Step Completed': {
    step?: AnalyticsOnboardingStep;
  };
  'Onboarding Completed': Record<string, never>;
  'Reminder Created': {
    channel?: AnalyticsReminderChannel;
  };
  'Push Prompt Shown': {
    source?: AnalyticsSource;
  };
  'Push Permission Result': {
    result?: AnalyticsPushPermission;
  };
  'Push Subscription Created': Record<string, never>;
  'Notification Clicked': {
    channel?: AnalyticsReminderChannel;
  };
  'Plus Gate Shown': {
    feature?: string;
  };
  'Plus Gate Clicked': {
    feature?: string;
  };
  'Seasonal Mode Changed': {
    mode?: AnalyticsSeasonalMode;
  };
  'Public Tool Used': {
    tool?: AnalyticsPublicTool;
  };
  'Referral Link Shared': Record<string, never>;
  'Referral Signup': Record<string, never>;
  'Marketplace Listing Created': Record<string, never>;
  'Marketplace Contact Clicked': Record<string, never>;
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

/**
 * Minimal auth-user shape used to decide whether an account was just created.
 * Matches the fields already present on the Supabase user / signUp response.
 */
export type AuthAccountSnapshot = {
  id?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  is_anonymous?: boolean | null;
  app_metadata?: {
    provider?: string | null;
    providers?: string[] | null;
  } | null;
  identities?: Array<{
    provider?: string | null;
    created_at?: string | null;
    last_sign_in_at?: string | null;
  }> | null;
};

const OAUTH_PROVIDERS = new Set(['google', 'apple']);
/** created_at and last_sign_in_at are the same instant on a first OAuth session. */
const NEW_ACCOUNT_WINDOW_MS = 5_000;
const SIGNUP_TRACKED_PREFIX = 'hg_signup_tracked_v1:';
const trackedSignupIds = new Set<string>();

/** Clears the in-memory one-shot set. Tests must also `localStorage.clear()`. */
export function resetSignupTrackingForTests(): void {
  trackedSignupIds.clear();
}

function parseAuthTimestampMs(value?: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function hasOAuthIdentity(user: AuthAccountSnapshot | null | undefined): boolean {
  if (!user) return false;
  if ((user.identities ?? []).some((identity) => identity.provider != null && OAUTH_PROVIDERS.has(identity.provider))) {
    return true;
  }
  const provider = user.app_metadata?.provider;
  if (provider && OAUTH_PROVIDERS.has(provider)) return true;
  return (user.app_metadata?.providers ?? []).some((item) => OAUTH_PROVIDERS.has(item));
}

/**
 * True only when the auth payload looks like a brand-new account.
 *
 * - Empty `identities` is Supabase's anti-enumeration signUp response for an
 *   existing email — not a created account.
 * - `created_at` ≈ `last_sign_in_at` (or missing last_sign_in) is how a first
 *   session looks. A later login updates last_sign_in and fails this check.
 */
export function isNewAuthAccount(user: AuthAccountSnapshot | null | undefined): boolean {
  if (!user?.id || user.is_anonymous) return false;

  const identities = user.identities;
  if (Array.isArray(identities) && identities.length === 0) return false;

  const createdMs = parseAuthTimestampMs(user.created_at);
  if (createdMs == null) return false;

  const lastSignInMs = parseAuthTimestampMs(user.last_sign_in_at);
  if (lastSignInMs != null && Math.abs(lastSignInMs - createdMs) > NEW_ACCOUNT_WINDOW_MS) {
    return false;
  }

  if (Array.isArray(identities) && identities.length > 0) {
    return identities.some((identity) => {
      const identityCreated = parseAuthTimestampMs(identity.created_at);
      if (identityCreated == null) return true;
      const identityLast = parseAuthTimestampMs(identity.last_sign_in_at);
      const createdTogether = Math.abs(identityCreated - createdMs) <= NEW_ACCOUNT_WINDOW_MS;
      const firstIdentitySignIn =
        identityLast == null || Math.abs(identityLast - identityCreated) <= NEW_ACCOUNT_WINDOW_MS;
      return createdTogether && firstIdentitySignIn;
    });
  }

  return lastSignInMs == null || Math.abs(lastSignInMs - createdMs) <= NEW_ACCOUNT_WINDOW_MS;
}

function hasTrackedSignup(userId: string): boolean {
  if (trackedSignupIds.has(userId)) return true;
  try {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(`${SIGNUP_TRACKED_PREFIX}${userId}`) === '1';
  } catch {
    return false;
  }
}

function markSignupTracked(userId: string): void {
  trackedSignupIds.add(userId);
  try {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`${SIGNUP_TRACKED_PREFIX}${userId}`, '1');
  } catch {
    // privat läge: minnes-set räcker för den här sidladdningen
  }
}

/**
 * One authoritative "Signup Completed" fire per new account on this device.
 * Reuses the existing Plausible event — no second pixel or event name.
 */
export function trackSignupIfNew(
  user: AuthAccountSnapshot | null | undefined,
  props?: AnalyticsEventMap['Signup Completed'],
): boolean {
  if (!user?.id || !isNewAuthAccount(user) || hasTrackedSignup(user.id)) return false;
  markSignupTracked(user.id);
  trackEvent('Signup Completed', props);
  return true;
}

/**
 * OAuth lands on /app via SIGNED_IN. Email register is tracked at signUp
 * success instead, so this ignores email/password sessions and every event
 * other than SIGNED_IN (no login, refresh, or INITIAL_SESSION).
 */
export function maybeTrackAuthSignup(
  event: string,
  user: AuthAccountSnapshot | null | undefined,
  props?: AnalyticsEventMap['Signup Completed'],
): boolean {
  if (event !== 'SIGNED_IN' || !hasOAuthIdentity(user)) return false;
  return trackSignupIfNew(user, props);
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

const FIRST_HEN_FLAG = 'hg_first_hen_tracked_v1';

/**
 * Fire "First Hen Added" en gång per enhet.
 * Anropas efter faktiskt lyckad hönskapelse från valfri UI-yta.
 * (Exempeldata i onboarding räknas inte — användaren har inte lagt till
 * sin egen höna då.)
 */
export function trackFirstHenIfNew(source: AnalyticsSource): void {
  try {
    if (typeof window === 'undefined') return;
    if (localStorage.getItem(FIRST_HEN_FLAG)) return;
    localStorage.setItem(FIRST_HEN_FLAG, '1');
    trackEvent('First Hen Added', { source });
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
  'onboarding',
  'hens_page',
  'blog_header',
  'blog_inline',
  'blog_final',
  'blog_sidebar',
  'blog_popup',
  'orpington',
  'sussex',
  'bast-honsras',
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
