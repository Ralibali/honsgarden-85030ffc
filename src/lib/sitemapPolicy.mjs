/**
 * Sitemap-policy: sitemap === publika, robots-tillåtna sidor.
 *
 * VIKTIGT: Håll denna fil i sync med `src/lib/sitemapPolicy.ts` (samma logik).
 *  - .ts  används av tester
 *  - .mjs används av scripts/prerender-blog-posts.mjs och scripts/generate-sitemap.mjs
 *
 * Google prefix-matchar Disallow: /app mot /app-for-honsagare. Använd /app/.
 * Intern matchning strippar avslutande slash, så /app/ blockerar /app och /app/dashboard.
 */

export function pathnameFromLoc(loc = '') {
  const value = String(loc).trim();
  if (!value) return '';
  try {
    if (/^https?:\/\//i.test(value)) return new URL(value).pathname || '/';
  } catch {
    /* fall through */
  }
  return value.startsWith('/') ? value : `/${value}`;
}

export function parseStarDisallows(robotsTxt = '') {
  const disallows = [];
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

export function pathMatchesDisallow(pathname, disallow) {
  const path = pathnameFromLoc(pathname);
  const rule = String(disallow || '').trim();
  if (!path || !rule) return false;

  const normalizedPath = path === '/' ? '/' : path.replace(/\/+$/, '');
  const normalizedRule = rule === '/' ? '/' : rule.replace(/\/+$/, '');
  if (normalizedRule === '/') return true;

  return normalizedPath === normalizedRule || normalizedPath.startsWith(`${normalizedRule}/`);
}

export function isRobotsDisallowed(loc, disallows = []) {
  const path = pathnameFromLoc(loc);
  return disallows.some((rule) => pathMatchesDisallow(path, rule));
}

export function extractBlogArticlePosts(xml = '') {
  const posts = [];
  const seen = new Set();
  const locRe = /<loc>\s*https?:\/\/[^<\s]+\/blogg\/([^</\s]+)\s*<\/loc>/gi;
  let match;
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

export function mergeBlogPosts(...lists) {
  const bySlug = new Map();
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const post of list) {
      if (!post?.slug) continue;
      bySlug.set(post.slug, { ...bySlug.get(post.slug), ...post });
    }
  }
  return [...bySlug.values()];
}

export function filterSitemapXml(xml = '', disallows = []) {
  return String(xml).replace(/[ \t]*<url>\s*<loc>([^<]+)<\/loc>[\s\S]*?<\/url>\s*/g, (block, loc) => (
    isRobotsDisallowed(loc, disallows) ? '' : block
  ));
}

/* ------------------------------------------------------------------ */
/* Indexhygiene (V2 Swarm C)                                           */
/*                                                                     */
/* Samma policy används på tre ställen:                                */
/*  1. scripts/prerender-blog-posts.mjs (byggtidens sitemap + meta)    */
/*  2. supabase/functions/sitemap/index.ts (dynamisk sitemap, speglad) */
/*  3. src/pages/BlogTag.tsx + src/pages/SaljaAggOrt.tsx (runtime)     */
/* ------------------------------------------------------------------ */

/** Minsta antal publicerade artiklar för att en taggsida ska indexeras. */
export const TAG_MIN_POSTS = 2;

/** Räknar publicerade artiklar per tagg. Kategorier räknas inte som taggar. */
export function countPostsPerTag(posts = []) {
  const counts = new Map();
  for (const post of posts) {
    if (!Array.isArray(post?.tags)) continue;
    for (const tag of post.tags) {
      if (!tag) continue;
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }
  return counts;
}

/** Taggar med minst `minPosts` artiklar — de enda som får sitemap-post och indexeras. */
export function indexableTags(posts = [], minPosts = TAG_MIN_POSTS) {
  const counts = countPostsPerTag(posts);
  return [...counts.entries()]
    .filter(([, count]) => count >= minPosts)
    .map(([tag]) => tag)
    .sort();
}

/**
 * Normaliserar fritext-ort ("Örnsköldsvik", "Göteborg kommun") till samma
 * form som ort-slugarna i src/data/saljaAggOrter.ts ("ornskoldsvik").
 */
export function normalizeOrtKey(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Sant om minst en aktiv annonsplats matchar ort-slugen på ordgräns.
 * Matchar t.ex. slug "goteborg" mot platsen "Göteborg" men inte "lund"
 * mot "Lundby".
 */
export function ortHasSupply(ortSlug, activeLocations = []) {
  const key = normalizeOrtKey(ortSlug);
  if (!key) return false;
  const boundary = new RegExp(`(^|-)${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(-|$)`);
  return activeLocations.some((location) => boundary.test(normalizeOrtKey(location)));
}
