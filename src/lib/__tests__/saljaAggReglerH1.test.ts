import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getRegulationGuide } from '@/data/regulationGuides.mjs';
import {
  extractH1Texts,
  extractTitle,
  injectTopicBody,
} from '@/lib/prerenderTopicPages';

const REGLER_PATH = '/guider/salja-agg-regler';
const REGLER_TITLE = 'Sälja ägg från egna höns – reglerna i klartext (2026)';
const REGLER_H1 = 'Sälja ägg från egna höns – reglerna i klartext';
const REGLER_FAQS = [
  'Får jag sälja ägg från mina hobbyhöns?',
  'När räknas jag som livsmedelsföretagare?',
  'Måste äggen vara stämplade?',
  'Kan jag sälja äggen i butik?',
  'Får jag ge hönorna matrester?',
  'Vad händer om salmonella upptäcks?',
];

const SPA_SHELL = `<!doctype html>
<html lang="sv">
  <head>
    <title>Hönsgården – Äggloggare & App för Hobbyuppfödare av Höns</title>
  </head>
  <body>
    <div id="root"></div>
    <noscript>
      <div>
        <h1>Hönsgården</h1>
        <p>JavaScript behöver vara aktiverat för att använda Hönsgården.</p>
      </div>
    </noscript>
  </body>
</html>`;

describe('/guider/salja-agg-regler first-byte H1', () => {
  const guide = getRegulationGuide('salja-agg-regler');
  const prerenderSource = readFileSync(
    path.resolve(process.cwd(), 'scripts/prerender-blog-posts.mjs'),
    'utf8',
  );

  it('ändrar inte title eller FAQ', () => {
    expect(guide).toBeTruthy();
    expect(guide?.title).toBe(REGLER_TITLE);
    expect(guide?.h1).toBe(REGLER_H1);
    expect(guide?.faqs.map((faq) => faq.q)).toEqual(REGLER_FAQS);
  });

  it('prerender strippar leftover noscript-H1 via injectTopicBody', () => {
    expect(prerenderSource).toMatch(
      /function buildRegulationGuidePage[\s\S]*return injectTopicBody\(/,
    );
  });

  it('first-byte har en enda H1 efter leftover-strip', () => {
    const withTitle = SPA_SHELL.replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${REGLER_TITLE}</title>`,
    );
    const html = injectTopicBody(withTitle, `<main><h1>${REGLER_H1}</h1></main>`);
    expect(extractH1Texts(html)).toEqual([REGLER_H1]);
    expect(extractTitle(html)).toBe(REGLER_TITLE);
    expect(html).not.toContain('<h1>Hönsgården</h1>');
    expect(REGLER_PATH).toBe('/guider/salja-agg-regler');
  });
});
