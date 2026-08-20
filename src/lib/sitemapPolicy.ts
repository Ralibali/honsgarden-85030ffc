/**
 * Sitemap-policy: sitemap === publika, robots-tillåtna sidor.
 *
 * VIKTIGT: Håll denna fil i sync med `src/lib/sitemapPolicy.mjs` (samma logik).
 *  - .ts  används av tester
 *  - .mjs används av scripts/prerender-blog-posts.mjs och scripts/generate-sitemap.mjs
 *
 * Disallow: /app matchar /app och /app/dashboard, men inte /app-for-honsagare.
 */

export function pathnameFromLoc(loc = ''): string {
  const value = String(loc).trim();
  if (!value) return '';
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value).pathname || '/';
  } catch {
    /* fall through */
  }
  return value.startsWith('/') ? value : `/${value}`;
}

export function parseStarDisallows(robotsTxt = ''): string[] {
  const disallows: string[] = [];
  let inStarGroup = false;
  let seenUserAgent = false;

  for (const rawLine of String(robotsTxt).split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    if (!line) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === 'user-agent') {
      seenUserAgent = true;
      inStarGroup = value === '*';
      continue;
    }
    if (!seenUserAgent) continue;
    if (inStarGroup && field === 'disallow' && value) {
      disallows.push(value);
    }
  }

  return disallows;
}

export function pathMatchesDisallow(pathname: string, disallow: string): boolean {
  const path = pathnameFromLoc(pathname);
  const rule = String(disallow || '').trim();
  if (!path || !rule) return false;

  const normalizedPath = path === '/' ? '/' : path.replace(/\/+$/, '');
  const normalizedRule = rule === '/' ? '/' : rule.replace(/\/+$/, '');
  if (normalizedRule === '/') return true;

  return normalizedPath === normalizedRule || normalizedPath.startsWith(`${normalizedRule}/`);
}

export function isRobotsDisallowed(loc: string, disallows: string[] = []): boolean {
  const path = pathnameFromLoc(loc);
  return disallows.some((rule) => pathMatchesDisallow(path, rule));
}

export function extractBlogArticlePosts(xml = ''): { slug: string }[] {
  const posts: { slug: string }[] = [];
  const seen = new Set<string>();
  const locRe = /<loc>\s*https?:\/\/[^<\s]+\/blogg\/([^</\s]+)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locRe.exec(String(xml)))) {
    let slug = match[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      /* keep raw slug */
    }
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    posts.push({ slug });
  }
  return posts;
}

export function mergeBlogPosts<T extends { slug?: string }>(...lists: Array<T[] | null | undefined>): T[] {
  const bySlug = new Map<string, T>();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const post of list) {
      if (!post?.slug) continue;
      bySlug.set(post.slug, { ...bySlug.get(post.slug), ...post });
    }
  }
  return [...bySlug.values()];
}

export function filterSitemapXml(xml = '', disallows: string[] = []): string {
  return String(xml).replace(/[ \t]*<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>\s*/g, (block, loc) => (
    isRobotsDisallowed(loc, disallows) ? '' : block
  ));
}
