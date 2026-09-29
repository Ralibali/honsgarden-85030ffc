export function pushNotificationPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/app') || raw.includes('\\')) return null;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin && (url.pathname === '/app' || url.pathname.startsWith('/app/'))
      ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch { return null; }
}
