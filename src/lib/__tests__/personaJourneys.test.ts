/**
 * Produktmotståndare (Swarm Y) — persona-täckning av kritiska resor.
 *
 * Försöker bevisa att nyckelpersonornas resor är brutna:
 *  1. Nybörjaren: landning → demo → registrering → onboarding måste ha
 *     mätning i varje steg, och demon får inte ha omappade navigeringshål.
 *  2. Säljaren: /salja-agg → regelguide → registrering → annons måste ha
 *     routes + events.
 *  3. Plus-användaren: insikter/Agda/rapporter grindas via entitlement,
 *     aldrig via nya betalväggar.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEMO_UNMAPPED_ALLOWLIST, mapAppPathToDemoFeature } from '../demoHandoff';

const ROOT = join(__dirname, '..', '..');

describe('demo-ytans navigeringshål (persona: Nybörjaren i demo)', () => {
  const dashboardSrc = readFileSync(join(ROOT, 'pages', 'DashboardV2.tsx'), 'utf8');
  const dashComponents = readdirSync(join(ROOT, 'components', 'dashboard'))
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => readFileSync(join(ROOT, 'components', 'dashboard', f), 'utf8'));
  const allSrc = [dashboardSrc, ...dashComponents].join('\n');

  const targets = new Set<string>();
  for (const m of allSrc.matchAll(/navigate\('(\/app[^']*)'\)/g)) targets.add(m[1].split(/[?#]/)[0]);
  for (const m of allSrc.matchAll(/to="(\/app[^"]*)"/g)) targets.add(m[1].split(/[?#]/)[0]);
  // Prefix-collapse: /app/hens/abc → /app/hens
  const collapsed = new Set([...targets].map((t) => t.replace(/^(\/app\/[^/]+).*/, '$1')));

  it('dashboarden navigerar faktiskt någonstans (testet läser rätt)', () => {
    expect(collapsed.size).toBeGreaterThanOrEqual(5);
  });

  it('varje navigeringsmål är mappat till en demo-feature ELLER medvetet undantaget', () => {
    const holes = [...collapsed].filter(
      (t) => !mapAppPathToDemoFeature(t) && !DEMO_UNMAPPED_ALLOWLIST.includes(t),
    );
    expect(holes).toEqual([]);
  });

  it('undantagslistan är principsäker: bara konto/engångs-ytor', () => {
    for (const allowed of DEMO_UNMAPPED_ALLOWLIST) {
      expect(mapAppPathToDemoFeature(allowed), `${allowed} ska inte mappas`).toBeUndefined();
    }
  });

  it('nya feature-mappningar fungerar', () => {
    expect(mapAppPathToDemoFeature('/app/feed')).toBe('feed');
    expect(mapAppPathToDemoFeature('/app/finance')).toBe('finance');
    expect(mapAppPathToDemoFeature('/app/rapporter')).toBe('reports_preview');
  });
});

describe('persona-trattar har mätning i varje steg', () => {
  const analyticsSrc = readFileSync(join(ROOT, 'lib', 'analytics.ts'), 'utf8');

  it('nybörjartratten: demo → registrering → onboarding → första ägget', () => {
    for (const event of [
      'Demo Opened',
      'Demo Feature Used',
      'Demo To Signup',
      'CTA Register Clicked',
      'Signup Completed',
      'Onboarding Completed',
      'First Egg Logged',
      'First Hen Added',
    ]) {
      expect(analyticsSrc, `saknar event '${event}'`).toContain(`'${event}'`);
    }
  });

  it('säljartratten: regelverktyg → registrering → annons', () => {
    for (const event of ['Public Tool Used', 'Signup Completed', 'Referral Signup']) {
      expect(analyticsSrc, `saknar event '${event}'`).toContain(`'${event}'`);
    }
  });

  it('alla demo-features i enum:en är mappbara från minst en sökväg', () => {
    const enumValues = [...analyticsSrc.matchAll(/^\s*\| '(\w+)'/gm)]
      .map((m) => m[1])
      .filter((v) => ['egg_log', 'hens', 'calendar', 'marketplace', 'agda_preview', 'reports_preview', 'feed', 'finance'].includes(v));
    for (const feature of enumValues) {
      // Minst en sökväg måste mappa till varje enum-värde.
      const probe = {
        egg_log: '/app/eggs',
        hens: '/app/hens',
        calendar: '/app/calendar',
        marketplace: '/app/marknad',
        agda_preview: '/app/agda',
        reports_preview: '/app/rapporter',
        feed: '/app/feed',
        finance: '/app/finance',
      }[feature];
      expect(mapAppPathToDemoFeature(probe as string)).toBe(feature);
    }
  });
});

describe('plus-personan: entitlement-grind utan nya betalväggar', () => {
  it('premium-insikter på dashboarden grindas via hasCapability, inte PremiumGate', () => {
    const src = readFileSync(join(ROOT, 'pages', 'DashboardV2.tsx'), 'utf8');
    expect(src).toContain("hasCapability(user?.premium_type ?? null, 'advanced_analytics')");
    expect(src).toContain('buildPremiumInsights');
    // Ingen ny betalvägg runt insiktskortet:
    const cardBlock = src.slice(src.indexOf('PremiumInsightsCard') - 400, src.indexOf('PremiumInsightsCard'));
    expect(cardBlock).not.toContain('PremiumGate');
  });
});
