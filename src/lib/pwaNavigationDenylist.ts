/**
 * Workbox NavigationRoute denylist.
 *
 * Public marketing HTML (especially `/`) must come from the network so a
 * precached empty SPA shell cannot paint a white screen. `/demo` is also
 * denylisted so first-byte is the prerendered demo UI, not the landing
 * shell. `/app` stays off this list so the PWA can keep serving the app
 * shell offline.
 */
export const PWA_NAVIGATION_DENYLIST: RegExp[] = [
  /^\/~oauth/,
  /^\/api/,
  /^\/$/,
  /^\/index(?:\.html)?$/,
  // /dvarghons och /skansk-blommehona 308:as på edge till /honsraser/<slug>
  // och behöver inga egna poster — prefixet "honsraser" täcker dem.
  /^\/(?:blogg|honsraser|honsraser-lista|borja-med-hons|app-for-honsagare|agglogg|honskalender|foderkostnad-hons|klackningskalender|om-oss|salja-agg|karta|marknad|guider|verktyg|demo)(?:\/|$)/,
];

export function isPwaNavigationDenied(pathname: string): boolean {
  const path = String(pathname).split('?')[0] || '/';
  return PWA_NAVIGATION_DENYLIST.some((pattern) => pattern.test(path));
}
