import { describe, expect, it } from 'vitest';
import { BREED_PROFILES } from '@/data/honsraserBreedProfiles';
import {
  CTR_DOCUMENT_TITLES,
  TOPIC_PAGE_PATHS,
  assertTopicPageHtml,
  breedTopicH1,
  documentTitleForPath,
  extractH1Texts,
  injectTopicBody,
  renderBreedTopicBody,
  stripGenericBrandH1,
} from '@/lib/prerenderTopicPages';

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

function withTitle(html: string, title: string) {
  return html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
}

function prerenderBreed(slug: string) {
  const breed = BREED_PROFILES.find((item) => item.slug === slug);
  if (!breed) throw new Error(`saknar rasprofil ${slug}`);
  const path = `/honsraser/${slug}`;
  const h1 = breedTopicH1(breed);
  const title = documentTitleForPath(path, `${breed.namn} – värpning, temperament & skötsel | Hönsgården`);
  return {
    path,
    h1,
    title,
    html: injectTopicBody(withTitle(SPA_SHELL, title), renderBreedTopicBody(breed, h1)),
  };
}

function prerenderFoderkostnadArticle() {
  const path = '/blogg/berakna-foderkostnad-for-hons';
  const articleH1 = 'Beräkna foderkostnad för höns enkelt';
  const title = documentTitleForPath(path, `${articleH1} | Hönsgården`);
  const body = `<main id="main-content"><article><h1>${articleH1}</h1><p>Räkna på säcken, inte på känsla.</p></article></main>`;
  return {
    path,
    h1: articleH1,
    title,
    html: injectTopicBody(withTitle(SPA_SHELL, title), body),
  };
}

describe('prerender topic H1 + CTR titles', () => {
  it('SPA-skalet har generic Hönsgården-H1 innan prerender', () => {
    expect(extractH1Texts(SPA_SHELL)).toEqual(['Hönsgården']);
    expect(() => assertTopicPageHtml(SPA_SHELL, {
      path: '/honsraser/orpington',
      topicH1: 'Orpington',
      titleIncludes: ['Orpington'],
    })).toThrow(/generic H1/);
  });

  it('tar bort leftover noscript-H1 när topic-body injiceras', () => {
    const html = injectTopicBody(SPA_SHELL, '<main><h1>Orpington – värpning, temperament och skötsel</h1></main>');
    expect(extractH1Texts(html)).toEqual(['Orpington – värpning, temperament och skötsel']);
    expect(stripGenericBrandH1('<h1>Hönsgården</h1>')).toBe('');
  });

  it.each([
    ['orpington', 'Orpington', ['Orpington-höna', '~180']],
    ['sussex', 'Sussex', ['Sussex-höna', '~240']],
  ] as const)('%s får topic-H1 och CTR-title, inte generic Hönsgården', (slug, topic, titleIncludes) => {
    const page = prerenderBreed(slug);
    expect(page.html).not.toContain('<h1>Hönsgården</h1>');
    const result = assertTopicPageHtml(page.html, {
      path: page.path,
      topicH1: topic,
      titleIncludes: [...titleIncludes],
    });
    expect(result.title).toBe(CTR_DOCUMENT_TITLES[page.path]);
    expect(result.title).not.toMatch(/^Hönsgården/);
    expect(page.html).toContain(`<h1 class="font-serif`);
  });

  it('foderkostnad-artikeln behåller artikelns H1 och får CTR-title', () => {
    const page = prerenderFoderkostnadArticle();
    expect(page.html).not.toContain('<h1>Hönsgården</h1>');
    const result = assertTopicPageHtml(page.html, {
      path: page.path,
      topicH1: 'Beräkna foderkostnad för höns enkelt',
      titleIncludes: ['foderkostnad', 'kalkyl'],
    });
    expect(result.title).toBe(CTR_DOCUMENT_TITLES[page.path]);
    expect(result.h1s).not.toContain('Hönsgården');
  });

  it('title-overrides gäller bara de tre URL:erna', () => {
    expect(TOPIC_PAGE_PATHS).toEqual([
      '/honsraser/orpington',
      '/honsraser/sussex',
      '/blogg/berakna-foderkostnad-for-hons',
    ]);
    expect(documentTitleForPath('/honsraser/wyandotte', 'Wyandotte – fallback | Hönsgården'))
      .toBe('Wyandotte – fallback | Hönsgården');
  });
});
