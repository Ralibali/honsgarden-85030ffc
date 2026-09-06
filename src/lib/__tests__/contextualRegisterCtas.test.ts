import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BREED_PRERENDER_PROFILES } from '@/data/honsraserBreedProfiles.mjs';
import { renderBlogMarkdown } from '@/lib/blogMarkdown';
import {
  CONTEXTUAL_CTAS,
  CONTEXTUAL_DEMO_CTAS,
  CONTEXTUAL_REGISTER_CTAS,
  assertContextualRegisterCta,
  htmlHasContextualRegisterCta,
  injectContextualRegisterCta,
} from '@/lib/contextualRegisterCtas';
import { injectTopicBody, renderBreedTopicBody } from '@/lib/prerenderTopicPages';

const SPA_SHELL = `<!doctype html><html><head><title>Hönsgården</title></head><body><div id="root"></div></body></html>`;

const BUILT_PAGES = CONTEXTUAL_CTAS.map((cta) => ({
  ...cta,
  file: `dist${cta.path}/index.html`,
}));

const FODERKOSTNAD_HEADING = 'Beräkna foderkostnad för höns per månad';

function foderkostnadArticleFixture() {
  return [
    '<h2>Vad som påverkar foderkostnaden mest</h2>',
    '<p>Två flockar med lika många höns kan ha tydligt olika foderkostnader.</p>',
    `<h2>${FODERKOSTNAD_HEADING}</h2>`,
    '<p>Om din flock kostar 13,83 kronor per dag i foder landar månaden på ungefär 415 kronor.</p>',
    '<h3>När månadssiffran blir missvisande</h3>',
    '<p>Många utgår från hur många säckar de köpt under en månad.</p>',
    '<h2>Kostnad per ägg - användbart men inte hela sanningen</h2>',
    '<p>Det är lockande att räkna ut exakt vad varje ägg kostar.</p>',
  ].join('');
}

function prerenderedBreedHtml(slug: string) {
  const breed = BREED_PRERENDER_PROFILES.find((item: { slug: string }) => item.slug === slug);
  if (!breed) throw new Error(`saknar rasprofil ${slug}`);
  return injectTopicBody(SPA_SHELL, renderBreedTopicBody(breed));
}

function comparisonTableFixture() {
  return renderBlogMarkdown(`## Jämförelsetabell — alla 12 raser

| Ras | Ägg/år |
|---|---:|
| Hedemora | 150–200 |
| Sussex | 240–260 |

## Rekommenderade kombinationer

🐔 Logga vilken ras som värper bäst hos dig. Hönsgården är en svensk app.
`);
}

describe('contextual register CTAs in prerendered pages', () => {
  it.each(CONTEXTUAL_REGISTER_CTAS.filter((cta) => cta.afterHeading))(
    '$path prerenderad HTML har exakt href och knapptext efter FAQ',
    (cta) => {
      const html = prerenderedBreedHtml(cta.slug);
      assertContextualRegisterCta(html, cta);
      expect(html.indexOf(cta.afterHeading!)).toBeLessThan(html.indexOf(cta.button));
      expect(html).toContain(cta.body);
    },
  );

  it('/blogg/berakna-foderkostnad-for-hons injicerar demo-CTA efter månadssektionen', () => {
    const cta = CONTEXTUAL_DEMO_CTAS.find((item) => item.slug === 'berakna-foderkostnad-for-hons')!;
    const html = injectContextualRegisterCta(foderkostnadArticleFixture(), cta.slug);
    assertContextualRegisterCta(html, cta);
    expect(html.indexOf(FODERKOSTNAD_HEADING)).toBeLessThan(html.indexOf(cta.button));
    expect(html.indexOf(cta.button)).toBeLessThan(html.indexOf('Kostnad per ägg'));
    expect(html.indexOf('När månadssiffran blir missvisande')).toBeLessThan(html.indexOf(cta.button));
    expect(html).toContain('href="/demo?source=foderkostnad"');
    expect(html).toContain('class="contextual-cta-button');
    expect(html).not.toMatch(/trial|7 dagar|Premium/i);
    expect(html).not.toContain('/login?mode=register');
  });

  it('foderkostnad-CTA hamnar efter sista aside om rubriken saknas', () => {
    const cta = CONTEXTUAL_DEMO_CTAS[0];
    const html = injectContextualRegisterCta(
      '<p>Ingen månadssektion.</p><aside class="existing">tidigare</aside><p>slut</p>',
      cta.slug,
    );
    assertContextualRegisterCta(html, cta);
    expect(html.indexOf('tidigare')).toBeLessThan(html.indexOf(cta.button));
    expect(html.indexOf(cta.button)).toBeLessThan(html.indexOf('<p>slut</p>'));
  });

  it('/blogg/bast-honsras-sverige injicerar CTA efter jämförelsetabellen', () => {
    const cta = CONTEXTUAL_REGISTER_CTAS.find((item) => item.slug === 'bast-honsras-sverige')!;
    const html = injectContextualRegisterCta(comparisonTableFixture(), cta.slug);
    assertContextualRegisterCta(html, cta);
    expect(html.indexOf('</table>')).toBeLessThan(html.indexOf(cta.button));
    expect(html.indexOf(cta.button)).toBeLessThan(html.indexOf('Rekommenderade kombinationer'));
    expect(html).toContain(cta.body);
  });

  it('andra rassidor och artiklar får ingen av register- eller demo-CTA:erna', () => {
    const wyandotte = prerenderedBreedHtml('wyandotte');
    const otherArticle = injectContextualRegisterCta(comparisonTableFixture(), 'foder-till-hons-guide');
    for (const cta of CONTEXTUAL_CTAS) {
      expect(htmlHasContextualRegisterCta(wyandotte, cta)).toBe(false);
      expect(htmlHasContextualRegisterCta(otherArticle, cta)).toBe(false);
    }
  });

  it('prerender-skriptet anropar injectContextualRegisterCta', () => {
    const source = readFileSync('scripts/prerender-blog-posts.mjs', 'utf8');
    expect(source).toMatch(/injectContextualRegisterCta\(rewritten, post\.slug\)/);
  });

  it('byggda/prerenderade sidor saknar inte exakt href eller knapptext', () => {
    const present = BUILT_PAGES.filter((page) => existsSync(page.file));
    if (present.length === 0) {
      for (const cta of CONTEXTUAL_REGISTER_CTAS.filter((item) => item.afterHeading)) {
        assertContextualRegisterCta(prerenderedBreedHtml(cta.slug), cta);
      }
      const blog = CONTEXTUAL_REGISTER_CTAS.find((item) => item.slug === 'bast-honsras-sverige')!;
      assertContextualRegisterCta(injectContextualRegisterCta(comparisonTableFixture(), blog.slug), blog);
      const demo = CONTEXTUAL_DEMO_CTAS[0];
      assertContextualRegisterCta(injectContextualRegisterCta(foderkostnadArticleFixture(), demo.slug), demo);
      return;
    }

    expect(present, 'byggda HTML-sidor måste täcka alla kontextuella CTA-URL:er').toHaveLength(BUILT_PAGES.length);
    for (const page of present) {
      assertContextualRegisterCta(readFileSync(page.file, 'utf8'), page);
    }
  });
});
