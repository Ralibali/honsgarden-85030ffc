import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const prerenderSource = readFileSync(
  path.resolve(process.cwd(), 'scripts/prerender-blog-posts.mjs'),
  'utf8',
);
const saljaAggSource = readFileSync(
  path.resolve(process.cwd(), 'src/pages/SaljaAgg.tsx'),
  'utf8',
);

function extractQuotedField(block: string, field: string) {
  const match = block.match(new RegExp(`${field}:\\s*'((?:\\\\'|[^'])*)'`));
  if (!match) throw new Error(`Saknar ${field} i SEO-block`);
  return match[1].replace(/\\'/g, "'");
}

function parseSaljaAggUseSeo(source: string) {
  const match = source.match(/useSeo\(\{([\s\S]*?)\n {2}\}\);/);
  if (!match) throw new Error('SaljaAgg.tsx saknar useSeo-anrop');
  return {
    title: extractQuotedField(match[1], 'title'),
    description: extractQuotedField(match[1], 'description'),
  };
}

function parseStaticPagesBlock(source: string) {
  const match = source.match(/const STATIC_PAGES = \[([\s\S]*?)\n\];/);
  if (!match) throw new Error('prerender-blog-posts.mjs saknar STATIC_PAGES');
  return match[1];
}

function parseStaticPage(source: string, pagePath: string) {
  const block = parseStaticPagesBlock(source);
  const row = block.match(
    new RegExp(
      `\\{\\s*path:\\s*'${pagePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?\\}`,
    ),
  );
  if (!row) throw new Error(`STATIC_PAGES saknar ${pagePath}`);
  return {
    path: pagePath,
    title: extractQuotedField(row[0], 'title'),
    description: extractQuotedField(row[0], 'description'),
  };
}

describe('STATIC_PAGES /salja-agg first-byte SEO', () => {
  const useSeo = parseSaljaAggUseSeo(saljaAggSource);
  const staticPage = parseStaticPage(prerenderSource, '/salja-agg');

  it('matchar SaljaAgg.tsx useSeo commercial title och description', () => {
    expect(staticPage.title).toBe(useSeo.title);
    expect(staticPage.description).toBe(useSeo.description);
    expect(staticPage.title).toBe('Sälja ägg lokalt med Swish – gratis säljsida | Hönsgården');
    expect(staticPage.description).toBe(
      'Sälja ägg från egna höns? Skapa en gratis säljsida med bokning och Swish-betalning på 2 minuter. Få stamkunder, hantera lager och äggförsäljning enkelt med Hönsgården.',
    );
  });

  it('leder inte med regler/priser – den queryn ägs av /guider/salja-agg-regler', () => {
    expect(staticPage.title).not.toMatch(/regler|priser/i);
    expect(staticPage.description).not.toMatch(/regler|prissättning|priser/i);
    expect(staticPage.title).not.toContain('Sälja ägg privat i Sverige');
    expect(prerenderSource).not.toContain(
      'Sälja ägg privat i Sverige – regler, priser & säljplats',
    );
  });
});
