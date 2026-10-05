import { describe, expect, it } from 'vitest';
import {
  AD_DISCLOSURE_TEXT,
  BLOG_INDEX_H1,
  categoriesWithPosts,
  collectionJsonLd,
  extractFaqPairs,
  faqPageJsonLd,
  hasSponsoredLinks,
  lastModifiedDate,
  relatedPosts,
  renderBlogIndexBody,
  renderCategoryBody,
  renderRelatedPosts,
  renderTagBody,
} from '@/lib/prerenderBlogHub.mjs';
import { extractH1Texts } from '@/lib/prerenderTopicPages.mjs';

const CATEGORY_META = {
  guide: { label: 'Guider', description: 'Kompletta guider om höns.' },
  halsa: { label: 'Hälsa', description: 'Allt om hönshälsa.' },
  recension: { label: 'Recensioner', description: 'Recensioner.' },
};

const POSTS = [
  { slug: 'kvalster-hons', title: 'Kvalster hos höns', excerpt: 'Så hittar du kvalster.', category: 'halsa', tags: ['hönshälsa', 'vinter'], published_at: '2026-05-01T08:00:00Z', updated_at: '2026-09-01T08:00:00Z' },
  { slug: 'hons-pa-vintern', title: 'Höns på vintern', excerpt: 'Kyla & drag.', category: 'guide', tags: ['vinter'], published_at: '2026-08-01T08:00:00Z', updated_at: '2026-08-01T08:00:00Z' },
  { slug: 'bygga-honshus', title: 'Bygga hönshus', excerpt: 'Mått och material.', category: 'guide', tags: [], published_at: '2026-02-01T08:00:00Z' },
  { slug: 'ruggning-hons', title: 'Ruggning <hos> höns', excerpt: '', category: 'halsa', tags: ['hönshälsa'], published_at: '2026-07-01T08:00:00Z' },
];

function links(html: string): string[] {
  return [...html.matchAll(/href="(\/blogg\/[^"]+)"/g)].map((match) => match[1]);
}

describe('blog hub prerender', () => {
  it('renders /blogg with one H1 and a crawlable link to every article', () => {
    const html = renderBlogIndexBody({ posts: POSTS, categoryMeta: CATEGORY_META });
    expect(extractH1Texts(html)).toEqual([BLOG_INDEX_H1]);
    for (const post of POSTS) expect(links(html)).toContain(`/blogg/${post.slug}`);
    expect(links(html)).toContain('/blogg/kategori/guide');
    expect(links(html)).not.toContain('/blogg/kategori/recension');
    expect(html).toContain('Ruggning &lt;hos&gt; höns');
    expect((html.match(/<main\b/g) || []).length).toBe(1);
  });

  it('renders a category page with its label as H1 and only its own articles', () => {
    const html = renderCategoryBody({ slug: 'halsa', meta: CATEGORY_META.halsa, posts: POSTS, categoryMeta: CATEGORY_META });
    expect(extractH1Texts(html)).toEqual(['Hälsa']);
    const articleLinks = links(html).filter((href) => !href.startsWith('/blogg/kategori/'));
    expect(articleLinks).toEqual(['/blogg/ruggning-hons', '/blogg/kvalster-hons']);
  });

  it('says so instead of rendering an empty list for an empty category', () => {
    const html = renderCategoryBody({ slug: 'recension', meta: CATEGORY_META.recension, posts: POSTS, categoryMeta: CATEGORY_META });
    expect(html).toContain('Inga artiklar i den här kategorin ännu');
  });

  it('renders a tag page with the article count and tagged articles', () => {
    const html = renderTagBody({ tag: 'vinter', posts: POSTS });
    expect(extractH1Texts(html)).toEqual(['Vinter']);
    expect(html).toContain('2 artiklar taggade med "vinter"');
    expect(links(html).filter((href) => !href.startsWith('/blogg/kategori/'))).toEqual(['/blogg/hons-pa-vintern', '/blogg/kvalster-hons']);
  });

  it('lists only categories that have posts', () => {
    expect(categoriesWithPosts(POSTS, CATEGORY_META).map((category) => category.slug)).toEqual(['guide', 'halsa']);
  });
});

describe('article helpers', () => {
  it('ranks related posts like the runtime block: category, shared tags, then recency', () => {
    const related = relatedPosts(POSTS[0], POSTS, 3).map((post) => post.slug);
    expect(related).toEqual(['ruggning-hons', 'hons-pa-vintern', 'bygga-honshus']);
    expect(related).not.toContain('kvalster-hons');
    expect(renderRelatedPosts([])).toBe('');
    expect(renderRelatedPosts(relatedPosts(POSTS[0], POSTS))).toContain('href="/blogg/ruggning-hons"');
  });

  it('extracts FAQ pairs from faq-q/faq-a and details blocks, deduplicated', () => {
    const html = '<div class="faq-q">Behöver höns <b>värme</b>?</div><div class="faq-a"><p>Oftast inte &amp; aldrig drag.</p><p>Torrt hus.</p></div>'
      + '<details><summary>Hur ofta ska man städa?</summary><p>Varje vecka.</p></details>'
      + '<details><summary>Hur ofta ska man städa?</summary><p>Dubblett.</p></details>';
    expect(extractFaqPairs(html)).toEqual([
      { q: 'Behöver höns värme?', a: 'Oftast inte & aldrig drag. Torrt hus.' },
      { q: 'Hur ofta ska man städa?', a: 'Varje vecka.' },
    ]);
    expect(faqPageJsonLd([])).toBeNull();
    expect(faqPageJsonLd(extractFaqPairs(html))?.mainEntity).toHaveLength(2);
  });

  it('detects sponsored links only from the rel attribute', () => {
    expect(hasSponsoredLinks('<a href="https://pin.bonden.se/t/t" rel="sponsored noopener">B</a>')).toBe(true);
    expect(hasSponsoredLinks('<a rel="nofollow sponsored" href="x">B</a>')).toBe(true);
    expect(hasSponsoredLinks('<a href="https://www.granngarden.se/">G</a> sponsored')).toBe(false);
    expect(AD_DISCLOSURE_TEXT).toMatch(/^Vissa länkar/);
  });

  it('uses the latest real modification date and never invents one', () => {
    expect(lastModifiedDate(POSTS)).toBe('2026-09-01');
    expect(lastModifiedDate([{ slug: 'x' }])).toBe('');
  });

  it('builds a CollectionPage with an ItemList and a breadcrumb trail', () => {
    const data = collectionJsonLd({
      name: 'Hälsa',
      description: 'Allt om hönshälsa.',
      path: '/blogg/kategori/halsa',
      posts: POSTS.slice(0, 2),
      breadcrumbs: [{ name: 'Hem', path: '/' }, { name: 'Blogg', path: '/blogg' }, { name: 'Hälsa', path: '/blogg/kategori/halsa' }],
    });
    const [page, breadcrumb] = data['@graph'];
    expect(page['@type']).toBe('CollectionPage');
    expect(page.mainEntity.itemListElement.map((item: { url: string }) => item.url)).toEqual([
      'https://honsgarden.se/blogg/kvalster-hons',
      'https://honsgarden.se/blogg/hons-pa-vintern',
    ]);
    expect(breadcrumb.itemListElement.map((item: { item: string }) => item.item)).toEqual([
      'https://honsgarden.se',
      'https://honsgarden.se/blogg',
      'https://honsgarden.se/blogg/kategori/halsa',
    ]);
  });
});
