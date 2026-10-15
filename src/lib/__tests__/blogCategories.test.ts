import { describe, expect, it } from 'vitest';
import {
  BLOG_CATEGORY_META,
  BLOG_POST_CATEGORY,
  blogCategoryLabel,
  blogCategoryOf,
  canonicalBlogCategory,
  withBlogCategory,
} from '@/data/blogCategories.mjs';
import { consolidatedBlogTarget } from '@/data/blogConsolidation.mjs';
import { categoriesWithPosts } from '@/lib/prerenderBlogHub.mjs';

describe('blog categories', () => {
  it('maps the spellings found in the database to one category page', () => {
    expect(canonicalBlogCategory('hälsa')).toBe('halsa');
    expect(canonicalBlogCategory('halsa')).toBe('halsa');
    expect(canonicalBlogCategory('Raser')).toBe('raser');
    expect(canonicalBlogCategory('nybörjare')).toBe('nyborjare');
    expect(canonicalBlogCategory('Hönshus & utrustning')).toBe('utrustning');
    expect(canonicalBlogCategory(' Regler & lagar ')).toBe('nyborjare');
    expect(canonicalBlogCategory('skotsel')).toBeNull();
    expect(canonicalBlogCategory(undefined)).toBeNull();
  });

  it('places buying guides under equipment whatever the database says', () => {
    expect(blogCategoryOf({ slug: 'vattenautomat-hons', category: 'tips' })).toBe('utrustning');
    expect(blogCategoryOf({ slug: 'bast-honsras-sverige', category: 'Raser' })).toBe('raser');
    expect(blogCategoryOf({ slug: 'ny-artikel', category: 'hälsa' })).toBe('halsa');
    expect(blogCategoryOf({ slug: 'ny-artikel', category: 'okänd' })).toBeNull();
  });

  it('only points posts at categories that exist, and never at merged posts', () => {
    for (const [slug, category] of Object.entries(BLOG_POST_CATEGORY)) {
      expect(BLOG_CATEGORY_META[category], slug).toBeDefined();
      expect(consolidatedBlogTarget(slug), slug).toBeNull();
    }
  });

  it('keeps the post object when nothing changes', () => {
    const post = { slug: 'kvalster-hons', category: 'halsa' };
    expect(withBlogCategory(post)).toBe(post);
    expect(withBlogCategory({ slug: 'regler-hons-sverige', category: 'Regler & lagar' }).category).toBe('nyborjare');
    expect(blogCategoryLabel('utrustning')).toBe('Hönshus & utrustning');
  });

  it('lists a category on the blog index once its posts are normalized', () => {
    const posts = [
      { slug: 'bast-honsras-sverige', category: 'Raser' },
      { slug: 'honshalsa-vanliga-sjukdomar', category: 'hälsa' },
    ].map(withBlogCategory);
    expect(categoriesWithPosts(posts, BLOG_CATEGORY_META).map((category: { slug: string }) => category.slug)).toEqual(['raser', 'halsa']);
  });
});
