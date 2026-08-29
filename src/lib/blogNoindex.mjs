/**
 * Off-topic leftover blog slugs that must not be treated as Hönsgården expertise.
 * First-byte prerender and client SEO emit robots noindex. URLs stay published.
 *
 * VIKTIGT: Håll denna fil i sync med `src/lib/blogNoindex.ts` (samma logik).
 *  - .ts  används av tester och SPA
 *  - .mjs används av scripts/prerender-blog-posts.mjs
 */

export const NOINDEX_BLOG_SLUGS = [
  'packlista-vandring-sverige',
  'svampplockning-sverige',
  'bygga-eldstad-tradgard',
  'odla-gronsaker-nybojare',
  'kompostera-hemma',
];

const NOINDEX_SLUG_SET = new Set(NOINDEX_BLOG_SLUGS);

export const DEFAULT_BLOG_ROBOTS =
  'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const NOINDEX_BLOG_ROBOTS = 'noindex, nofollow';

export function isNoindexBlogSlug(slug) {
  return Boolean(slug) && NOINDEX_SLUG_SET.has(slug);
}

export function robotsMetaForBlogSlug(slug) {
  return isNoindexBlogSlug(slug) ? NOINDEX_BLOG_ROBOTS : DEFAULT_BLOG_ROBOTS;
}
