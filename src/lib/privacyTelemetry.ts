import { readPrivacyConsent } from './privacyConsent';
/** Shared gate for first-party usage telemetry. A legacy decision never grants consent. */
const CONSENT_KEY = 'honsgarden_ga4_consent_v2';
const PRIVATE_PATHS = ['/app', '/admin', '/auth', '/bestallning', '/shop/checkout', '/shop/order', '/shop/thank-you'];

export function hasTelemetryConsent(): boolean {
  return readPrivacyConsent(CONSENT_KEY)?.analytics === true;
}

export function telemetryPath(raw = window.location.pathname): string | null {
  try {
    const url = new URL(raw, window.location.origin);
    if (!/^https?:$/.test(url.protocol)) return null;
    if (PRIVATE_PATHS.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'))) return null;
    return url.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');
  } catch { return null; }
}

export function telemetryReferrer(): string | null {
  try { return document.referrer ? new URL(document.referrer).origin : null; } catch { return null; }
}

/** Only stable, non-personal event dimensions are accepted; never free-form labels or URLs. */
export function telemetryMetadata(input: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const output: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(input).slice(0, 20)) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || /email|phone|token|password|user_id|customer|message|name|text|href|url/i.test(key)) continue;
    if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) output[key] = value;
    if (typeof value === 'string' && /^[a-z0-9_.-]{1,60}$/i.test(value) && !/[0-9a-f]{8}-[0-9a-f-]{27,}/i.test(value)) output[key] = value;
  }
  return output;
}
