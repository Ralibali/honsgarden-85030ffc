export interface BlogCategoryMeta {
  label: string;
  title: string;
  description: string;
  ogImage: string;
}

export const BLOG_CATEGORY_META: Record<string, BlogCategoryMeta>;
export const BLOG_POST_CATEGORY: Record<string, string>;

export function canonicalBlogCategory(value: string | null | undefined): string | null;
export function blogCategoryOf(post: { slug?: string | null; category?: string | null } | null | undefined): string | null;
export function withBlogCategory<T extends { slug?: string | null; category?: string | null }>(post: T): T;
export function blogCategoryLabel(category: string | null | undefined): string | undefined;
