import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONSOLIDATED_BLOG_POSTS,
  CONSOLIDATED_BLOG_REDIRECTS,
  consolidatedBlogTarget,
  rewriteConsolidatedBlogLinks,
  withoutConsolidatedPosts,
} from '@/data/blogConsolidation.mjs';
import { STATIC_PUBLIC_ROUTES, matchRoute } from '../routeInventory';
import { legacyBlogTarget } from '../legacyBlog';

const root = process.cwd();
const MAP = CONSOLIDATED_BLOG_POSTS as Record<string, string>;
const sources = Object.keys(MAP);

function sourceFiles(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx|mjs)$/.test(entry.name) && !/\.test\./.test(entry.name) && !path.endsWith('blogConsolidation.mjs') ? [path] : [];
  });
}
const publishedSlugs = [...readFileSync(join(root, 'public/sitemap.xml'), 'utf8')
  .matchAll(/<loc>https:\/\/honsgarden\.se\/blogg\/([^<]+)<\/loc>/g)]
  .map((match) => decodeURIComponent(match[1]))
  .filter((slug) => !slug.startsWith('kategori/') && !slug.startsWith('tagg/'));

describe('blog consolidation map', () => {
  it('only merges articles that exist, and never into another merged article', () => {
    for (const [slug, target] of Object.entries(MAP)) {
      expect(publishedSlugs, `${slug} is not a published article`).toContain(slug);
      if (target.startsWith('/blogg/')) {
        const targetSlug = target.slice('/blogg/'.length);
        expect(publishedSlugs, `${slug} → ${target} points at a missing article`).toContain(targetSlug);
        expect(consolidatedBlogTarget(targetSlug), `${slug} → ${target} would chain`).toBeNull();
      } else {
        expect(STATIC_PUBLIC_ROUTES, `${slug} → ${target} is not a public page`).toContain(target);
      }
    }
  });

  it('keeps reviewed editorial articles', () => {
    const dir = join(root, 'content/editorial/articles');
    const reviewed = readdirSync(dir).map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')).slug);
    for (const slug of reviewed) expect(consolidatedBlogTarget(slug), slug).toBeNull();
  });

  it('never merges an article the code links to or places offers on', () => {
    const blogLinkFiles = [...sourceFiles('src'), ...sourceFiles('scripts')];
    const slugListFiles = [
      'src/lib/adtractionPrograms.ts',
      'src/lib/contextualShopPlacements.ts',
      'src/lib/contextualRegisterCtas.ts',
      'src/lib/digitalGuidePlacements.mjs',
      'src/lib/prerenderTopicPages.ts',
      'src/lib/outboundShopClicks.ts',
    ];
    const offenders: string[] = [];
    for (const file of blogLinkFiles) {
      const text = readFileSync(join(root, file), 'utf8');
      for (const slug of sources) if (text.includes(`/blogg/${slug}'`) || text.includes(`/blogg/${slug}"`) || text.includes(`/blogg/${slug}\``)) offenders.push(`${file}: /blogg/${slug}`);
    }
    for (const file of slugListFiles) {
      const text = readFileSync(join(root, file), 'utf8');
      for (const slug of sources) if (text.includes(`'${slug}'`)) offenders.push(`${file}: '${slug}'`);
    }
    expect(offenders).toEqual([]);
  });

  it('redirects permanently at the edge, before the SPA route', () => {
    expect(CONSOLIDATED_BLOG_REDIRECTS).toHaveLength(sources.length);
    expect(matchRoute('/blogg/app-eller-parm-for-hons')).toEqual({ kind: 'redirect', destination: '/blogg/mobilapp-vs-excel-for-hons', statusCode: 308 });
    expect(matchRoute('/blogg/app-for-honsagare')).toEqual({ kind: 'redirect', destination: '/app-for-honsagare', statusCode: 308 });
    expect(matchRoute('/blogg/mobilapp-vs-excel-for-hons').kind).toBe('dynamic');
  });

  it('sends legacy ?post= links straight to the target', () => {
    expect(legacyBlogTarget('?post=gratis-honsapp-jamforelse')).toBe('/app-for-honsagare');
    expect(legacyBlogTarget('?post=kvalster-hons')).toBe('/blogg/kvalster-hons');
  });
});

describe('consolidation helpers', () => {
  it('drops merged posts from lists and keeps the rest in order', () => {
    const posts = [{ slug: 'kvalster-hons' }, { slug: 'app-eller-parm-for-hons' }, { slug: 'mobilapp-vs-excel-for-hons' }, { slug: undefined }];
    expect(withoutConsolidatedPosts(posts).map((post) => post.slug)).toEqual(['kvalster-hons', 'mobilapp-vs-excel-for-hons', undefined]);
    expect(consolidatedBlogTarget('constructor')).toBeNull();
    expect(consolidatedBlogTarget(undefined)).toBeNull();
  });

  it('points internal links at the target without touching other links', () => {
    const html = [
      '<a href="/blogg/app-eller-parm-for-hons">relativ</a>',
      '<a class="x" href="https://honsgarden.se/blogg/digitalt-honsregister#start">absolut</a>',
      "<a href='https://www.honsgarden.se/blogg/basta-appen-for-aggloggning?utm=x'>www</a>",
      '<a href="/blogg/kvalster-hons">behålls</a>',
      '<a href="https://example.com/blogg/app-eller-parm-for-hons">extern</a>',
      '<a href="/blogg/kategori/guide">kategori</a>',
    ].join(' ');
    expect(rewriteConsolidatedBlogLinks(html)).toBe([
      '<a href="/blogg/mobilapp-vs-excel-for-hons">relativ</a>',
      '<a class="x" href="/blogg/hur-startar-man-flockjournal">absolut</a>',
      "<a href='/agglogg'>www</a>",
      '<a href="/blogg/kvalster-hons">behålls</a>',
      '<a href="https://example.com/blogg/app-eller-parm-for-hons">extern</a>',
      '<a href="/blogg/kategori/guide">kategori</a>',
    ].join(' '));
  });
});
