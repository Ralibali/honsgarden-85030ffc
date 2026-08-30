import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');

describe('index.html hreflang (swarm S)', () => {
  const hreflangs = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map(
    (m) => ({ lang: m[1], href: m[2] }),
  );

  it('never points hreflang at undeployed domains', () => {
    for (const { href } of hreflangs) {
      expect(href.startsWith('https://honsgarden.se')).toBe(true);
    }
    expect(html).not.toMatch(/hreflang="[^"]*" href="https?:\/\/(?!honsgarden\.se)/);
  });

  it('self-references sv and x-default on the Swedish domain', () => {
    const langs = hreflangs.map((h) => h.lang);
    expect(langs).toContain('sv');
    expect(langs).toContain('x-default');
    const xDefault = hreflangs.find((h) => h.lang === 'x-default');
    expect(xDefault?.href).toBe('https://honsgarden.se/');
  });

  it('keeps i18n capability dormant: no en-US/en alternates until launch', () => {
    const langs = hreflangs.map((h) => h.lang);
    expect(langs).not.toContain('en');
    expect(langs).not.toContain('en-US');
  });
});
