/** Meta Pixel. Loaded only after explicit advertising consent; nothing is sent before. */
export const META_PIXEL_ID = '986111717870460';
export const ADS_CONSENT_KEY = 'honsgarden_ads_consent_v1';
/** Bump when the banner's advertising wording changes; saved with each choice. */
export const ADS_NOTICE_VERSION = 'ads-2026-10-15';
const VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;

export type AdsConsent = { version: 1; ads: boolean; updatedAt: string; notice: string };

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};
declare global {
  interface Window { fbq?: Fbq; _fbq?: Fbq }
}

export function parseAdsConsent(raw: string | null): AdsConsent | null {
  try {
    const s = JSON.parse(raw || 'null');
    if (s?.version !== 1 || typeof s.ads !== 'boolean' || typeof s.updatedAt !== 'string') return null;
    const t = Date.parse(s.updatedAt);
    if (!Number.isFinite(t) || Date.now() - t >= VALIDITY_MS || Date.now() < t) return null;
    return { version: 1, ads: s.ads, updatedAt: s.updatedAt, notice: String(s.notice ?? '') };
  } catch { return null; }
}

export function readAdsConsent(): AdsConsent | null {
  try { return parseAdsConsent(localStorage.getItem(ADS_CONSENT_KEY)); } catch { return null; }
}

let initialized = false;

function load(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  const n: Fbq = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod.apply(n, args); else n.queue!.push(args);
  } as Fbq;
  if (!window.fbq) {
    window.fbq = n;
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
  window.fbq!('consent', 'grant');
  window.fbq!('init', META_PIXEL_ID);
  window.fbq!('track', 'PageView');
}

/** Apply a choice immediately: grant loads the pixel, refusal revokes without reload. */
export function applyAdsConsent(allowed: boolean): void {
  if (allowed) {
    if (initialized) window.fbq?.('consent', 'grant'); else load();
  } else if (initialized) {
    window.fbq?.('consent', 'revoke');
  }
}

export function storeAdsConsent(ads: boolean): void {
  try {
    localStorage.setItem(ADS_CONSENT_KEY, JSON.stringify({ version: 1, ads, updatedAt: new Date().toISOString(), notice: ADS_NOTICE_VERSION }));
  } catch { /* session-only choice */ }
  applyAdsConsent(ads);
}

function adsAllowed(): boolean { return readAdsConsent()?.ads === true; }

let lastPath = '';
export function trackMetaPageView(path: string): void {
  if (!adsAllowed() || !initialized || path === lastPath) return;
  lastPath = path;
  window.fbq?.('track', 'PageView');
}

/** Fired only after a successful account creation. */
export function trackCompleteRegistration(): void {
  if (!adsAllowed()) return;
  if (!initialized) load();
  const eventID = `reg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  window.fbq?.('track', 'CompleteRegistration', {}, { eventID });
}

/** Boot on page load and follow changes made in other tabs. */
let booted = false;
export function initMetaPixel(): void {
  if (typeof window === 'undefined' || booted) return;
  booted = true;
  if (adsAllowed()) load();
  lastPath = window.location.pathname;
  window.addEventListener('storage', (e) => {
    if (e.key === ADS_CONSENT_KEY) applyAdsConsent(parseAdsConsent(e.newValue)?.ads === true);
  });
  // SPA navigation: count page views on route changes (only when allowed).
  const onNav = () => setTimeout(() => trackMetaPageView(window.location.pathname), 0);
  const push = history.pushState.bind(history);
  history.pushState = (...args: Parameters<History['pushState']>) => { push(...args); onNav(); };
  window.addEventListener('popstate', onNav);
}
