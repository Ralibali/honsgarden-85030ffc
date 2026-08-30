import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const TODAY = '2026-08-30';

describe('trust copy – SaljaAgg (swarm A)', () => {
  const saljaAgg = read('src/pages/SaljaAgg.tsx');

  it('never claims egg sales to retail are notified to Livsmedelsverket', () => {
    // Felaktigheten: butiksförsäljning kräver godkänt äggpackeri, inte en
    // "anmälan till Livsmedelsverket".
    expect(saljaAgg).not.toContain('anmäla till Livsmedelsverket');
  });

  it('explains the approved packing station requirement for retail sales', () => {
    expect(saljaAgg).toContain('godkänt äggpackeri');
    expect(saljaAgg).toContain('godkännandet ansöks hos Livsmedelsverket');
  });

  it('points 50+ hen keepers to länsstyrelsen, not Livsmedelsverket', () => {
    expect(saljaAgg).toContain('anmälas till länsstyrelsen');
  });

  it('states the Jordbruksverket holding-register obligation for all keepers', () => {
    expect(saljaAgg).toContain('Jordbruksverkets anläggningsregister');
  });

  it('contains no fabricated fixed tax-free threshold', () => {
    expect(saljaAgg).not.toMatch(/skattefritt upp till/);
    expect(saljaAgg).not.toMatch(/50\s?000\s?kr\/år bör du kontakta/);
    expect(saljaAgg).toContain('ingen fast beloppsgräns');
  });

  it('links primary authority sources on the page', () => {
    expect(saljaAgg).toContain('livsmedelsverket.se/foretagande-regler-kontroll');
    expect(saljaAgg).toContain('jordbruksverket.se/djur/');
    expect(saljaAgg).toContain('skatteverket.se');
  });
});

describe('trust copy – legal entity & dates', () => {
  const terms = read('src/pages/Terms.tsx');
  const about = read('src/pages/About.tsx');

  it('names the operating legal entity in Swedish terms', () => {
    expect(terms).toContain('Aurora Media AB (org.nr 559272-0220, Linköping)');
    expect(terms).toContain('info@auroramedia.se');
  });

  it('names the operating legal entity in English terms', () => {
    expect(terms).toContain('Aurora Media AB (reg. no. 559272-0220, Linköping, Sweden)');
  });

  it('shows the operator on the About page footer', () => {
    expect(about).toContain('Aurora Media AB (org.nr 559272-0220), Linköping');
  });

  it('has no legal page dated in the future', () => {
    const dates = [...terms.matchAll(/(?:Senast uppdaterad|Last updated): (\d{4}-\d{2}-\d{2})/g)].map((m) => m[1]);
    expect(dates.length).toBeGreaterThan(0);
    for (const date of dates) {
      expect(date <= TODAY, `legal date ${date} must not be in the future`).toBe(true);
    }
  });
});
