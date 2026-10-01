export type PrivacyConsent = { version: 2; analytics: boolean; updatedAt: string };
const CONSENT_VALIDITY_MS = 365 * 24 * 60 * 60 * 1000;

export function parsePrivacyConsent(raw: string | null): PrivacyConsent | null {
  try {
    const state = JSON.parse(raw || 'null');
    if (state?.version !== 2 || typeof state.analytics !== 'boolean' || typeof state.updatedAt !== 'string') return null;
    const savedAt = Date.parse(state.updatedAt);
    const age = Date.now() - savedAt;
    if (!Number.isFinite(savedAt) || age < 0 || age >= CONSENT_VALIDITY_MS) return null;
    return { version: 2, analytics: state.analytics, updatedAt: state.updatedAt };
  } catch { return null; }
}

export function readPrivacyConsent(key: string): PrivacyConsent | null {
  try { return parsePrivacyConsent(localStorage.getItem(key)); } catch { return null; }
}

export function storePrivacyConsent(key: string, analytics: boolean): void {
  try { localStorage.setItem(key, JSON.stringify({ version: 2, analytics, updatedAt: new Date().toISOString() })); } catch { /* The runtime can remember a choice for this session. */ }
}
