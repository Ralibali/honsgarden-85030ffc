// Auth providers return to the allowlisted /app URL. Keep the intended Hönsgården
// page in the current tab while the provider or confirmation page is open.
const STORAGE_KEY = 'honsgarden.loginDestination';
const MAX_AGE_MS = 60 * 60 * 1000;

export function signupPlanDestination(plan: unknown): string {
  return plan === 'plus_monthly' || plan === 'plus_annual' ? `/app/premium?plan=${plan}&trial=7d` : '/app';
}

export function loginDestination(raw: string | null): string | null {
  if (!raw?.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (['access_token', 'refresh_token', 'token_hash', 'code', 'error_description'].some(
      key => url.searchParams.has(key) || fragment.has(key),
    )) return null;
    if (!/^\/(?:app|marknad)(?:\/|$)/.test(url.pathname) &&
        !/^\/inbjudan\/[a-f0-9]{64}$/i.test(url.pathname)) return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}

export function rememberLoginDestination(destination: string | null) {
  try {
    if (!destination || destination === '/app') {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ destination, expiresAt: Date.now() + MAX_AGE_MS }));
  } catch { /* Login remains available with browser storage disabled. */ }
}

export function pendingLoginDestination(): string | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (entry.expiresAt > Date.now() && typeof entry.destination === 'string') {
      return loginDestination(entry.destination);
    }
  } catch { /* Ignore stale or unavailable browser storage. */ }
  return null;
}
