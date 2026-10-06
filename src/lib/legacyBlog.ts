import { consolidatedBlogTarget } from '@/data/blogConsolidation.mjs';

/** Keep published Soro links usable after the embed is retired. */
export function canonicalBlogSlug(slug: string): string {
  return slug === 'spåra-varpning-per-hona' ? 'spara-varpning-per-hona' : slug;
}

export function legacyBlogTarget(search: string): string | null {
  const post = new URLSearchParams(search).get('post');
  if (!post || !/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(post) || post.length > 180) return null;
  const slug = canonicalBlogSlug(post);
  // Merged articles go straight to their target, without a second redirect.
  return consolidatedBlogTarget(slug) ?? `/blogg/${encodeURIComponent(slug)}`;
}
