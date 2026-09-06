import { describe, expect, it } from 'vitest';
import { isPwaNavigationDenied } from '@/lib/pwaNavigationDenylist';

describe('PWA navigation denylist', () => {
  it.each([
    '/',
    '/index.html',
    '/blogg',
    '/blogg/bast-honsras-sverige',
    '/honsraser/orpington',
    '/app-for-honsagare',
    '/agglogg',
    '/karta',
    '/marknad/k/hons',
    '/demo',
    '/~oauth',
    '/api',
  ])('släpper den publika routen %s till nätverket', (path) => {
    expect(isPwaNavigationDenied(path)).toBe(true);
  });

  it.each(['/app', '/app/', '/app/eggs', '/login'])(
    'låter PWA-skalet hantera %s',
    (path) => {
      expect(isPwaNavigationDenied(path)).toBe(false);
    },
  );
});
