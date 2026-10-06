/**
 * Crawlable first-byte HTML for the blog: hub pages (/blogg, categories,
 * tags), related-article links and FAQ extraction for articles.
 *
 * Used by scripts/prerender-blog-posts.mjs. `extractFaqPairs` is also used by
 * the runtime article page so both emit the same FAQPage data.
 */

import { escapeHtml } from './prerenderTopicPages.mjs';

export const BASE_URL = 'https://honsgarden.se';

/** Same wording as the runtime article page. Shown above the first ad link. */
export const AD_DISCLOSURE_TEXT =
  'Vissa länkar i denna artikel är annonslänkar. Vi kan få ersättning om du handlar via dem, utan extra kostnad för dig.';

/** Runtime H1/intro of /blogg (src/pages/Guides.tsx). */
export const BLOG_INDEX_H1 = 'Höns, hem, trädgård & friluftsliv';
export const BLOG_INDEX_INTRO =
  'Guider och praktiska tips för dig med höns – och för hemmet, trädgården och livet utomhus.';

function decodeEntities(value = '') {
  return String(value)
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function publishedTime(post) {
  const time = Date.parse(post?.published_at || '');
  return Number.isFinite(time) ? time : 0;
}

export function sortPostsByDate(posts = []) {
  return [...posts].sort((a, b) => publishedTime(b) - publishedTime(a));
}

export function formatSwedishDate(iso) {
  const time = Date.parse(iso || '');
  if (!Number.isFinite(time)) return '';
  return new Date(time).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Stockholm' });
}

/** Latest of updated_at / published_at, as YYYY-MM-DD, or '' when unknown. */
export function lastModifiedDate(posts = []) {
  let latest = 0;
  for (const post of posts) {
    for (const value of [post?.updated_at, post?.published_at]) {
      const time = Date.parse(value || '');
      if (Number.isFinite(time) && time > latest) latest = time;
    }
  }
  return latest ? new Date(latest).toISOString().split('T')[0] : '';
}

export function postsInCategory(posts = [], category) {
  return sortPostsByDate(posts.filter((post) => post?.category === category));
}

export function postsWithTag(posts = [], tag) {
  return sortPostsByDate(posts.filter((post) => Array.isArray(post?.tags) && post.tags.includes(tag)));
}

/**
 * Same relevance as the runtime "Fler artiklar" block: same category +2,
 * each shared tag +1, newest first on ties.
 */
export function relatedPosts(post, posts = [], limit = 4) {
  const tags = new Set(post?.tags || []);
  return posts
    .filter((other) => other?.slug && other.slug !== post?.slug)
    .map((other) => {
      let score = other.category && other.category === post?.category ? 2 : 0;
      for (const tag of other.tags || []) if (tags.has(tag)) score += 1;
      return { other, score };
    })
    .sort((a, b) => b.score - a.score || publishedTime(b.other) - publishedTime(a.other))
    .slice(0, limit)
    .map(({ other }) => other);
}

// Block-level boundaries become spaces; inline tags (<b>, <a>) vanish without one.
function faqText(html = '') {
  return decodeEntities(String(html)
    .replace(/<\/(?:p|li|div|h[1-6]|td|th|dd|dt)>|<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim());
}

/** FAQ pairs from `.faq-q`/`.faq-a` blocks and `<details><summary>` blocks. */
export function extractFaqPairs(html = '') {
  const pairs = [];
  const seen = new Set();
  const push = (rawQ, rawA) => {
    const q = faqText(rawQ);
    const a = faqText(rawA);
    if (!q || !a || seen.has(q)) return;
    seen.add(q);
    pairs.push({ q, a });
  };
  const faqRe = /<(?:div|dt)[^>]*class="faq-q"[^>]*>([\s\S]*?)<\/(?:div|dt)>\s*<(?:div|dd)[^>]*class="faq-a"[^>]*>([\s\S]*?)<\/(?:div|dd)>/gi;
  let match;
  while ((match = faqRe.exec(String(html))) !== null) push(match[1], match[2]);
  const detailsRe = /<summary[^>]*>([\s\S]*?)<\/summary>\s*([\s\S]*?)(?=<\/details>)/gi;
  while ((match = detailsRe.exec(String(html))) !== null) push(match[1], match[2]);
  return pairs;
}

export function faqPageJsonLd(pairs = []) {
  if (!pairs.length) return null;
  return {
    '@type': 'FAQPage',
    mainEntity: pairs.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}

/** True when rendered article HTML contains a link marked as paid. */
export function hasSponsoredLinks(html = '') {
  return /<a\b[^>]*\srel=(["'])[^"']*\bsponsored\b[^"']*\1/i.test(String(html));
}

export function renderAdDisclosure() {
  return `<p class="text-xs text-muted-foreground italic mb-4 mt-2">${escapeHtml(AD_DISCLOSURE_TEXT)}</p>`;
}

function postExcerpt(post) {
  const text = post?.excerpt || post?.meta_description || '';
  return text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text;
}

function renderPostItem(post, { withExcerpt = true } = {}) {
  const date = formatSwedishDate(post.published_at);
  const meta = date ? `<p class="text-xs text-muted-foreground"><time datetime="${escapeHtml(post.published_at)}">${escapeHtml(date)}</time></p>` : '';
  const excerpt = withExcerpt && postExcerpt(post)
    ? `<p class="text-sm text-muted-foreground leading-relaxed">${escapeHtml(postExcerpt(post))}</p>`
    : '';
  return `<li class="py-3 border-b border-border/40"><h3 class="font-serif text-lg leading-snug"><a href="/blogg/${escapeHtml(post.slug)}" class="hover:text-primary">${escapeHtml(post.title)}</a></h3>${meta}${excerpt}</li>`;
}

export function renderPostList(posts = [], options) {
  if (!posts.length) return '';
  return `<ul class="list-none p-0">${posts.map((post) => renderPostItem(post, options)).join('')}</ul>`;
}

/** [{ slug, label, count }] for categories that have at least one post. */
export function categoriesWithPosts(posts = [], categoryMeta = {}) {
  return Object.entries(categoryMeta)
    .map(([slug, meta]) => ({ slug, label: meta.label, count: posts.filter((post) => post?.category === slug).length }))
    .filter((category) => category.count > 0);
}

function renderCategoryNav(categories = [], currentSlug) {
  if (!categories.length) return '';
  const links = categories
    .map((category) => (category.slug === currentSlug
      ? `<li><span aria-current="page" class="font-medium">${escapeHtml(category.label)}</span></li>`
      : `<li><a href="/blogg/kategori/${escapeHtml(category.slug)}" class="hover:text-primary">${escapeHtml(category.label)}</a> <span class="text-muted-foreground">(${category.count})</span></li>`))
    .join('');
  return `<nav aria-label="Kategorier" class="my-6"><ul class="flex flex-wrap gap-x-4 gap-y-2 list-none p-0 text-sm">${links}</ul></nav>`;
}

function renderBreadcrumb(items) {
  const parts = items.map((item) => (item.href
    ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.name)}</a>`
    : `<span aria-current="page">${escapeHtml(item.name)}</span>`));
  return `<nav aria-label="Brödsmulor" class="text-xs text-muted-foreground mb-5">${parts.join(' / ')}</nav>`;
}

function wrapMain(inner) {
  return `<div class="min-h-screen bg-background"><main class="max-w-4xl mx-auto px-4 py-8" id="main-content">${inner}</main></div>`;
}

export function renderBlogIndexBody({ posts = [], categoryMeta = {}, latestCount = 6, afterIntroHtml = '' } = {}) {
  const sorted = sortPostsByDate(posts);
  const categories = categoriesWithPosts(sorted, categoryMeta);
  const sections = categories
    .map((category) => {
      const inCategory = postsInCategory(sorted, category.slug);
      return `<section class="mt-10"><h2 class="font-serif text-2xl mb-3"><a href="/blogg/kategori/${escapeHtml(category.slug)}">${escapeHtml(category.label)}</a></h2>${renderPostList(inCategory, { withExcerpt: false })}</section>`;
    })
    .join('');
  const uncategorized = sorted.filter((post) => !categoryMeta[post.category]);
  const otherSection = uncategorized.length
    ? `<section class="mt-10"><h2 class="font-serif text-2xl mb-3">Fler artiklar</h2>${renderPostList(uncategorized, { withExcerpt: false })}</section>`
    : '';
  return wrapMain(`${renderBreadcrumb([{ name: 'Hem', href: '/' }, { name: 'Blogg' }])}
<h1 class="text-3xl sm:text-4xl font-serif text-foreground mb-3">${escapeHtml(BLOG_INDEX_H1)}</h1>
<p class="text-muted-foreground max-w-xl">${escapeHtml(BLOG_INDEX_INTRO)}</p>
${renderCategoryNav(categories)}
${afterIntroHtml}
<section class="mt-8"><h2 class="font-serif text-2xl mb-3">Senaste artiklarna</h2>${renderPostList(sorted.slice(0, latestCount))}</section>
${sections}${otherSection}`);
}

export function renderCategoryBody({ slug, meta, posts = [], categoryMeta = {} }) {
  const inCategory = postsInCategory(posts, slug);
  const list = inCategory.length
    ? renderPostList(inCategory)
    : '<p class="text-muted-foreground">Inga artiklar i den här kategorin ännu. <a href="/blogg" class="underline">Se alla artiklar</a>.</p>';
  return wrapMain(`${renderBreadcrumb([{ name: 'Hem', href: '/' }, { name: 'Blogg', href: '/blogg' }, { name: meta.label }])}
<h1 class="text-3xl sm:text-4xl font-serif text-foreground mb-3">${escapeHtml(meta.label)}</h1>
<p class="text-muted-foreground max-w-xl">${escapeHtml(meta.description)}</p>
${renderCategoryNav(categoriesWithPosts(posts, categoryMeta), slug)}
${list}`);
}

export function tagDisplayName(tag = '') {
  return tag.charAt(0).toUpperCase() + tag.slice(1);
}

export function renderTagBody({ tag, posts = [] }) {
  const tagged = postsWithTag(posts, tag);
  const display = tagDisplayName(tag);
  return wrapMain(`${renderBreadcrumb([{ name: 'Hem', href: '/' }, { name: 'Blogg', href: '/blogg' }, { name: display }])}
<h1 class="text-3xl sm:text-4xl font-serif text-foreground mb-3">${escapeHtml(display)}</h1>
<p class="text-muted-foreground">${tagged.length} ${tagged.length === 1 ? 'artikel' : 'artiklar'} taggade med "${escapeHtml(tag)}"</p>
${renderPostList(tagged)}`);
}

export function renderRelatedPosts(related = []) {
  if (!related.length) return '';
  return `<section class="mt-14 pt-8 border-t border-border/50" aria-labelledby="fler-artiklar"><h2 id="fler-artiklar" class="font-serif text-xl text-foreground mb-5">Fler artiklar</h2>${renderPostList(related)}</section>`;
}

/** CollectionPage + ItemList + BreadcrumbList graph for a hub page. */
export function collectionJsonLd({ name, description, path, posts = [], breadcrumbs = [] }) {
  const url = `${BASE_URL}${path}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': url,
        name,
        description,
        url,
        isPartOf: { '@id': `${BASE_URL}/#website` },
        inLanguage: 'sv-SE',
        ...(posts.length ? {
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: posts.length,
            itemListElement: posts.map((post, index) => ({ '@type': 'ListItem', position: index + 1, url: `${BASE_URL}/blogg/${post.slug}`, name: post.title })),
          },
        } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: `${BASE_URL}${crumb.path === '/' ? '' : crumb.path}` })),
      },
    ],
  };
}
