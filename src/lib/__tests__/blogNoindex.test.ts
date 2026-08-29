import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BLOG_ROBOTS,
  NOINDEX_BLOG_ROBOTS,
  NOINDEX_BLOG_SLUGS,
  isNoindexBlogSlug,
  robotsMetaForBlogSlug,
} from '../blogNoindex';

const CHICKEN_CONTROL_SLUG = 'kvalster-hons';

describe('blogNoindex leftover off-topic slugs', () => {
  it('locks the five leftover slugs to robots noindex', () => {
    expect([...NOINDEX_BLOG_SLUGS]).toEqual([
      'packlista-vandring-sverige',
      'svampplockning-sverige',
      'bygga-eldstad-tradgard',
      'odla-gronsaker-nybojare',
      'kompostera-hemma',
    ]);

    for (const slug of NOINDEX_BLOG_SLUGS) {
      expect(isNoindexBlogSlug(slug)).toBe(true);
      expect(robotsMetaForBlogSlug(slug)).toBe(NOINDEX_BLOG_ROBOTS);
      expect(robotsMetaForBlogSlug(slug)).toMatch(/noindex/i);
    }
  });

  it('does not noindex the chicken control URL /blogg/kvalster-hons', () => {
    expect(isNoindexBlogSlug(CHICKEN_CONTROL_SLUG)).toBe(false);
    expect(robotsMetaForBlogSlug(CHICKEN_CONTROL_SLUG)).toBe(DEFAULT_BLOG_ROBOTS);
    expect(robotsMetaForBlogSlug(CHICKEN_CONTROL_SLUG)).not.toMatch(/noindex/i);
    expect(NOINDEX_BLOG_SLUGS).not.toContain(CHICKEN_CONTROL_SLUG);
  });

  it('prerender and GuideArticle use the same slug lock', () => {
    const prerenderSource = readFileSync(
      path.resolve(process.cwd(), 'scripts/prerender-blog-posts.mjs'),
      'utf8',
    );
    const articleSource = readFileSync(
      path.resolve(process.cwd(), 'src/pages/GuideArticle.tsx'),
      'utf8',
    );

    expect(prerenderSource).toMatch(/from ['"]\.\.\/src\/lib\/blogNoindex\.mjs['"]/);
    expect(prerenderSource).toMatch(/function buildArticleHead[\s\S]*noindex:\s*isNoindexBlogSlug\(post\.slug\)/);
    expect(articleSource).toContain('robotsMetaForBlogSlug(post.slug)');
    expect(articleSource).not.toMatch(
      /setMeta\('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'\)/,
    );
  });
});
