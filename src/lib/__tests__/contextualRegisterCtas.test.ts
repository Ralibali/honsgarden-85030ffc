import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BREED_PRERENDER_PROFILES } from '@/data/honsraserBreedProfiles.mjs';
import { renderBlogMarkdown } from '@/lib/blogMarkdown';
import {
  CONTEXTUAL_REGISTER_CTAS,
  assertContextualRegisterCta,
  htmlHasContextualRegisterCta,
  injectContextualRegisterCta,
} from '@/lib/contextualRegisterCtas';
import { injectTopicBody, renderBreedTopicBody } from '@/lib/prerenderTopicPages';

const SPA_SHELL = `<!doctype html><html><head><title>Hönsgården</title></head><body><div id="root"></div></body></html>`;

const BUILT_PAGES = CONTEXTUAL_REGISTER_CTAS.map((cta) => ({
  ...cta,
  file: `dist${cta.path}/index.html`,
}));

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

  it('/blogg/bast-honsras-sverige injicerar CTA efter jämförelsetabellen', () => {
    const cta = CONTEXTUAL_REGISTER_CTAS.find((item) => item.slug === 'bast-honsras-sverige')!;
    const html = injectContextualRegisterCta(comparisonTableFixture(), cta.slug);
    assertContextualRegisterCta(html, cta);
    expect(html.indexOf('</table>')).toBeLessThan(html.indexOf(cta.button));
    expect(html.indexOf(cta.button)).toBeLessThan(html.indexOf('Rekommenderade kombinationer'));
    expect(html).toContain(cta.body);
  });

  it('andra rassidor och artiklar får ingen av de tre register-CTA:erna', () => {
    const wyandotte = prerenderedBreedHtml('wyandotte');
    const otherArticle = injectContextualRegisterCta(comparisonTableFixture(), 'foder-till-hons-guide');
    for (const cta of CONTEXTUAL_REGISTER_CTAS) {
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
      return;
    }

    expect(present, 'byggda HTML-sidor måste täcka alla tre URL:erna').toHaveLength(BUILT_PAGES.length);
    for (const page of present) {
      assertContextualRegisterCta(readFileSync(page.file, 'utf8'), page);
    }
  });
});
