import { describe, it, expect } from 'vitest';
import { evaluateRegler, summarizeLevel, THRESHOLDS, type VagvisareInput } from '../aggRegler';

const ids = (input: VagvisareInput) => evaluateRegler(input).map((r) => r.id);
const byId = (input: VagvisareInput, id: string) => evaluateRegler(input).find((r) => r.id === id);

describe('aggRegler – evaluateRegler', () => {
  it('ger alltid anläggningsregistret och kommunregler, även utan försäljning', () => {
    const rules = ids({ hens: 3, sells: false, channels: [] });
    expect(rules).toContain('anlaggningsregistret');
    expect(rules).toContain('kommunens_regler');
  });

  it('säljer man inte slipper man resten (info) och inga krav', () => {
    const rules = evaluateRegler({ hens: 500, sells: false, channels: [] });
    expect(rules.some((r) => r.id === 'ingen_forsaljning' && r.level === 'info')).toBe(true);
    expect(rules.some((r) => r.level === 'required')).toBe(false);
  });

  it('kräver skattedeklaration för alla som säljer', () => {
    const rules = ids({ hens: 5, sells: true, channels: ['privat'] });
    expect(rules).toContain('skatt');
  });

  it('≤50 höns + försäljning utanför gården → namn/adress, inte producentkod', () => {
    const input: VagvisareInput = { hens: 40, sells: true, channels: ['torg'] };
    expect(ids(input)).toContain('namn_adress');
    expect(ids(input)).not.toContain('producentkod');
    expect(ids(input)).not.toContain('lansstyrelse_registrering');
  });

  it('>50 höns + försäljning utanför gården → producentkod + länsstyrelseregistrering', () => {
    const input: VagvisareInput = { hens: 80, sells: true, channels: ['gard', 'torg'] };
    expect(ids(input)).toContain('producentkod');
    expect(ids(input)).toContain('lansstyrelse_registrering');
  });

  it('>50 höns men bara gårdsbutik/förbetald REKO → undantag (ingen producentkod)', () => {
    const input: VagvisareInput = { hens: 120, sells: true, channels: ['gard', 'reko_prepaid'] };
    expect(ids(input)).toContain('producentkod_undantag');
    expect(ids(input)).not.toContain('producentkod');
    // länsstyrelseregistrering gäller ändå (>50 fjäderfän)
    expect(ids(input)).toContain('lansstyrelse_registrering');
  });

  it('>350 höns → kommunregistrering av livsmedelsverksamhet', () => {
    const input: VagvisareInput = { hens: 400, sells: true, channels: ['gard'] };
    expect(ids(input)).toContain('kommun_livsmedel');
  });

  it('grossist kräver alltid Livsmedelsverkets godkännande', () => {
    const input: VagvisareInput = { hens: 60, sells: true, channels: ['grossist'] };
    expect(ids(input)).toContain('lsl_godkannande');
  });

  it('yrkesmässig produktion → salmonellakrav med journal', () => {
    const input: VagvisareInput = { hens: 100, sells: true, channels: ['gard'] };
    expect(ids(input)).toContain('salmonella');
    expect(byId(input, 'salmonella')?.body).toMatch(/journal/i);
  });

  it('liten hobbyförsäljning → journal-trygghetsinfo istället för krav', () => {
    const input: VagvisareInput = { hens: 8, sells: true, channels: ['privat'] };
    expect(ids(input)).toContain('salmonella_gransfall');
    expect(ids(input)).not.toContain('salmonella');
  });

  it('alla resultat har titel och brödtext', () => {
    const input: VagvisareInput = { hens: 500, sells: true, channels: ['torg', 'grossist'] };
    for (const r of evaluateRegler(input)) {
      expect(r.title.length).toBeGreaterThan(3);
      expect(r.body.length).toBeGreaterThan(20);
    }
  });

  it('tröskelvärden är regelverkets', () => {
    expect(THRESHOLDS.producentkodHens).toBe(50);
    expect(THRESHOLDS.smaMangderHens).toBe(350);
  });
});

describe('aggRegler – summarizeLevel', () => {
  it('hobby utan försäljning', () => {
    expect(summarizeLevel({ hens: 300, sells: false, channels: [] })).toBe('hobby');
  });
  it('hobby med liten privat försäljning', () => {
    expect(summarizeLevel({ hens: 10, sells: true, channels: ['privat', 'gard'] })).toBe('hobby');
  });
  it('gränsfall vid >50 höns eller försäljning utanför gården', () => {
    expect(summarizeLevel({ hens: 51, sells: true, channels: ['gard'] })).toBe('gransfall');
    expect(summarizeLevel({ hens: 20, sells: true, channels: ['torg'] })).toBe('gransfall');
  });
  it('producent vid >350 höns eller grossist', () => {
    expect(summarizeLevel({ hens: 351, sells: true, channels: ['gard'] })).toBe('producent');
    expect(summarizeLevel({ hens: 60, sells: true, channels: ['grossist'] })).toBe('producent');
  });
});
