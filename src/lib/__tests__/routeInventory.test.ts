import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  matchRoute,
  patternToRegExp,
  buildVercelRewrites,
  buildVercelRedirects,
  STATIC_PUBLIC_ROUTES,
  DYNAMIC_PUBLIC_ROUTES,
} from '../routeInventory';

const repoRoot = process.cwd();
const readRepoFile = (relative: string) => readFileSync(join(repoRoot, relative), 'utf8');

describe('routeInventory matcher', () => {
  it('serves the homepage and all static public routes', () => {
    expect(matchRoute('/').kind).toBe('static');
    for (const route of STATIC_PUBLIC_ROUTES) {
      expect(matchRoute(route), `static route ${route}`).toEqual({ kind: 'static', route });
    }
  });

  it('matches every dynamic pattern against its own example URL', () => {
    for (const route of DYNAMIC_PUBLIC_ROUTES) {
      expect(matchRoute(route.example), `dynamic route ${route.pattern}`).toEqual({
        kind: 'dynamic',
        route: route.pattern,
      });
    }
  });

  it('routes the authenticated app shell, including deep nested paths', () => {
    expect(matchRoute('/app').kind).toBe('app');
    expect(matchRoute('/app/hens').kind).toBe('app');
    expect(matchRoute('/app/hens/abc-123').kind).toBe('app');
    expect(matchRoute('/app/weather/history/2026-08-30').kind).toBe('app');
    expect(matchRoute('/app/marknad/mina').kind).toBe('app');
  });

  it('returns notfound for bogus, dotless and unknown top-level paths', () => {
    for (const bogus of [
      '/qwerty-uiop',
      '/honsraser2', // dotless prefix collision must NOT match /honsraser/:slug
      '/blogg2',
      '/apple-touch-icon-precomposed.pngx',
      '/wp-admin',
      '/.env',
      '/hönsgården',
    ]) {
      expect(matchRoute(bogus), `bogus path ${bogus}`).toEqual({ kind: 'notfound' });
    }
  });

  it('returns notfound for paths nested deeper than any known pattern', () => {
    for (const nested of [
      '/blogg/foo/bar',
      '/salja-agg/stockholm/innerstan',
      '/verktyg/aggkalkylator/extra',
      '/marknad/k/agg/nocco',
      '/karta/bekrafta/mamma',
    ]) {
      expect(matchRoute(nested), `nested path ${nested}`).toEqual({ kind: 'notfound' });
    }
  });

  it('redirects retired index aliases permanently', () => {
    expect(matchRoute('/index')).toEqual({ kind: 'redirect', destination: '/', statusCode: 308 });
    expect(matchRoute('/index.html')).toEqual({ kind: 'redirect', destination: '/', statusCode: 308 });
  });

  it('ignores query strings and trailing slashes when matching', () => {
    expect(matchRoute('/blogg?_page=2').kind).toBe('static');
    expect(matchRoute('/honsraser/').kind).toBe('static');
    expect(matchRoute('/salja-agg/umeå?källa=qr').kind).toBe('dynamic');
  });

  it('has unique static routes and unique dynamic patterns', () => {
    expect(new Set(STATIC_PUBLIC_ROUTES).size).toBe(STATIC_PUBLIC_ROUTES.length);
    const patterns = DYNAMIC_PUBLIC_ROUTES.map((r) => r.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });

  it('keeps dynamic patterns unambiguous: no example matches a different pattern first', () => {
    for (const route of DYNAMIC_PUBLIC_ROUTES) {
      const earlier = DYNAMIC_PUBLIC_ROUTES.filter(
        (candidate) => candidate.pattern !== route.pattern && patternToRegExp(candidate.pattern).test(route.example),
      );
      // Overlaps are allowed only where React Router ranks a specific route higher
      // (e.g. /s/agg is static and /s/:slug dynamic); record them explicitly.
      for (const overlap of earlier) {
        expect([route.pattern, overlap.pattern].sort().join('|')).toMatch(/s\/:slug\|\/s\/agg|guider|marknad\/k|marknad\/:slug/);
      }
    }
  });
});

describe('vercel.json sync', () => {
  const vercel = JSON.parse(readRepoFile('vercel.json'));

  it('contains no catch-all rewrite to /index.html', () => {
    const catchAll = (vercel.rewrites ?? []).filter(
      (r: { source: string }) => r.source === '/(.*)' || r.source === '/*' || r.source === '/:path*',
    );
    expect(catchAll).toEqual([]);
  });

  it('rewrites exactly match the route inventory', () => {
    expect(vercel.rewrites).toEqual(buildVercelRewrites());
  });

  it('redirects exactly match the route inventory', () => {
    expect(vercel.redirects).toEqual(buildVercelRedirects());
  });

  it('rewrites only ever target /index.html', () => {
    for (const rewrite of vercel.rewrites) {
      expect(rewrite.destination).toBe('/index.html');
    }
  });

  it('exposes a static 404 page for unmatched paths', () => {
    const html = readRepoFile('public/404.html');
    expect(html).toContain('noindex');
    expect(html).toContain('Sidan hittades inte');
  });
});
