/**
 * Canonical route inventory — single source of truth for which URL paths
 * serve the SPA shell, which redirect, and which must return a true 404.
 *
 * Consumed by:
 *  - scripts/route-inventory.mjs (generates/verifies the `rewrites` and
 *    `redirects` sections of vercel.json — run `npm run verify:routes`)
 *  - src/lib/__tests__/routeInventory.test.ts (behavioural contract)
 *
 * Keep in sync with the <Routes> table in src/App.tsx.
 * Pure ESM data + string matching only — safe to import from Node scripts.
 */

/** Infra-level permanent redirects (308), evaluated before the filesystem. */
export const ROUTE_REDIRECTS = [
  { source: '/index', destination: '/', statusCode: 308 },
  { source: '/index.html', destination: '/', statusCode: 308 },
  // Äldre landningssidor sammanslagna under /honsraser/ (MERGE+REDIRECT).
  // Canonical-pekarna loopade tidigare mellan de två URL:erna — nu finns
  // exakt en indexerbar URL per sida.
  { source: '/dvarghons', destination: '/honsraser/dvarghons', statusCode: 308 },
  { source: '/skansk-blommehona', destination: '/honsraser/skansk-blommehona', statusCode: 308 },
];

/**
 * Exact public paths served by the SPA (or by a prerendered static file,
 * which the filesystem serves before rewrites are consulted).
 * '/' is served from dist/index.html directly and needs no rewrite.
 */
export const STATIC_PUBLIC_ROUTES = [
  '/',
  '/app-for-honsagare',
  '/agglogg',
  '/honskalender',
  '/foderkostnad-hons',
  '/klackningskalender',
  '/borja-med-hons',
  '/honsraser',
  '/honsraser-lista',
  '/salja-agg',
  '/karta',
  '/karta/bekrafta',
  '/demo',
  '/s/agg',
  '/login',
  '/delete-account',
  '/terms',
  '/integritet',
  '/reset-password',
  '/om-oss',
  '/verktyg/aggkalkylator',
  '/verktyg/aggregler-vagvisare',
  '/verktyg/klackningskalkylator',
  '/guider',
  '/guider/registrera-hons-jordbruksverket',
  '/guider/salja-agg-regler',
  '/blogg',
  '/marknad',
  '/marknad/ny',
  '/butik',
  '/butik/tack',
  '/butik/villkor',
  '/butik/angra',
];

/**
 * Parameterised public routes. `pattern` uses `:param` segments and is
 * converted to a Vercel rewrite source verbatim. `example` is a concrete
 * path used by tests to prove the pattern matches real URLs.
 * `note` records the residual soft-404 exposure for bogus parameter values
 * (HTTP 200 + client-side NotFound/noindex) until a server-side resolver
 * exists — tracked as GATED in the V2 plan.
 */
export const DYNAMIC_PUBLIC_ROUTES = [
  { pattern: '/honsraser/:slug', example: '/honsraser/orpington', note: 'bogus slug → client 404 + noindex' },
  { pattern: '/salja-agg/:ort', example: '/salja-agg/stockholm', note: 'bogus ort → client 404 + noindex' },
  { pattern: '/karta/hantera/:token', example: '/karta/hantera/abc123', note: 'token page' },
  { pattern: '/s/:slug', example: '/s/anna-lena', note: 'public egg-sale page' },
  { pattern: '/r/:token', example: '/r/abc123', note: 'token dispatch' },
  { pattern: '/avboka/:token', example: '/avboka/abc123', note: 'cancel booking' },
  { pattern: '/bestallning/:token', example: '/bestallning/abc123', note: 'order portal' },
  { pattern: '/inbjudan/:token', example: '/inbjudan/abc123', note: 'invite' },
  { pattern: '/guider/:slug', example: '/guider/nagon-artikel', note: 'client redirect to /blogg/:slug' },
  { pattern: '/blogg/kategori/:category', example: '/blogg/kategori/skotsel', note: 'bogus category → noindex' },
  { pattern: '/blogg/tagg/:tag', example: '/blogg/tagg/agg', note: 'thin tags noindexed client-side' },
  { pattern: '/blogg/:slug', example: '/blogg/bast-honsras-sverige', note: 'prerendered when published; bogus slug → client 404' },
  { pattern: '/marknad/k/:kategori', example: '/marknad/k/agg', note: 'marketplace category' },
  { pattern: '/marknad/:slug', example: '/marknad/agg-fran-hogsby', note: 'listing detail' },
  { pattern: '/butik/:slug', example: '/butik/honsnat-25m', note: 'shop product' },
];

/**
 * Authenticated app shell. All /app/* paths serve index.html; ProtectedRoute
 * handles auth client-side and robots.txt disallows crawling of /app/.
 */
export const APP_SHELL_ROUTES = [
  { pattern: '/app', example: '/app' },
  { pattern: '/app/:path*', example: '/app/hens/123' },
];

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Convert a `:param` / `:param*` pattern to an anchored RegExp. */
export function patternToRegExp(pattern) {
  const source = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        return segment.endsWith('*') ? '(?:/.*)?' : '/[^/]+';
      }
      return segment ? `/${escapeRegExp(segment)}` : '';
    })
    .join('');
  return new RegExp(`^${source}/?$`);
}

/**
 * Classify a pathname against the inventory.
 * Returns one of:
 *   { kind: 'redirect', destination, statusCode }
 *   { kind: 'static' | 'dynamic' | 'app', route }
 *   { kind: 'notfound' }
 */
export function matchRoute(pathname) {
  const path = (pathname || '/').split('?')[0].split('#')[0] || '/';
  const normalised = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;

  for (const redirect of ROUTE_REDIRECTS) {
    if (normalised === redirect.source) {
      return { kind: 'redirect', destination: redirect.destination, statusCode: redirect.statusCode };
    }
  }
  if (STATIC_PUBLIC_ROUTES.includes(normalised)) {
    return { kind: 'static', route: normalised };
  }
  for (const route of DYNAMIC_PUBLIC_ROUTES) {
    if (patternToRegExp(route.pattern).test(normalised)) {
      return { kind: 'dynamic', route: route.pattern };
    }
  }
  for (const route of APP_SHELL_ROUTES) {
    if (patternToRegExp(route.pattern).test(normalised)) {
      return { kind: 'app', route: route.pattern };
    }
  }
  return { kind: 'notfound' };
}

/** Build the `rewrites` array for vercel.json from the inventory. */
export function buildVercelRewrites() {
  const rewrites = [];
  for (const route of STATIC_PUBLIC_ROUTES) {
    if (route === '/') continue; // served from dist/index.html by the filesystem
    rewrites.push({ source: route, destination: '/index.html' });
  }
  for (const route of DYNAMIC_PUBLIC_ROUTES) {
    rewrites.push({ source: route.pattern, destination: '/index.html' });
  }
  for (const route of APP_SHELL_ROUTES) {
    rewrites.push({ source: route.pattern, destination: '/index.html' });
  }
  return rewrites;
}

/** Build the `redirects` array for vercel.json from the inventory. */
export function buildVercelRedirects() {
  return ROUTE_REDIRECTS.map(({ source, destination, statusCode }) => ({
    source,
    destination,
    statusCode,
  }));
}
