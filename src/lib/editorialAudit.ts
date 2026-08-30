/**
 * Redaktionell kvalitetsgrind (Swarm D) — typad spegel.
 *
 * HÅLLS I SYNK med editorialAudit.mjs (skriptvarianten som
 * scripts/editorial-audit.mjs importerar) — ändras den ena ändras den
 * andra. Testerna körs mot denna fil.
 */

export const EDITORIAL_LIMITS = {
  titleMax: 60,
  descriptionMin: 70,
  descriptionMax: 160,
  thinWords: 300,
} as const;

export interface AuditablePost {
  slug?: string | null;
  title?: string | null;
  content?: string | null;
  excerpt?: string | null;
  meta_description?: string | null;
  category?: string | null;
  tags?: string[] | null;
  cover_image_url?: string | null;
  feature_image_url?: string | null;
  word_count?: number | null;
}

export interface AuditFinding {
  type: string;
  slug: string;
  detail: string;
}

export interface AuditReport {
  total: number;
  errors: AuditFinding[];
  warnings: AuditFinding[];
}

export type LengthIssue = 'missing' | 'too_short' | 'too_long' | null;

/** Räknar ord i markdown/HTML-brödtext utan att räkna syntax. */
export function markdownWordCount(markdown: string | null | undefined): number {
  if (!markdown) return 0;
  let text = String(markdown);
  text = text.replace(/```[\s\S]*?```/g, ' '); // kodblock
  text = text.replace(/<[^>]+>/g, ' '); // html-taggar
  text = text.replace(/!\[[^\]]*\]\([^)]*\)/g, ' '); // bilder
  text = text.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // länkar → ankartext
  text = text.replace(/[#>*_`~|]/g, ' ');
  return text.split(/\s+/).filter((w) => /[a-zåäöA-ZÅÄÖ0-9]/.test(w)).length;
}

/** Interna /artikel/-länkar i brödtext (markdown + html). */
export function extractInternalArticleLinks(markdown: string | null | undefined): string[] {
  if (!markdown) return [];
  const found = new Set<string>();
  const re = /\]\(\/artikel\/([a-z0-9-]+)[)\s#?]|href="\/artikel\/([a-z0-9-]+)["#?]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(markdown)))) {
    found.add((m[1] || m[2]).toLowerCase());
  }
  return Array.from(found);
}

export function auditTitle(title: string | null | undefined): { ok: boolean; issue: LengthIssue } {
  if (!title || !String(title).trim()) return { ok: false, issue: 'missing' };
  if (String(title).trim().length > EDITORIAL_LIMITS.titleMax) return { ok: false, issue: 'too_long' };
  return { ok: true, issue: null };
}

export function auditDescription(
  description: string | null | undefined,
): { ok: boolean; issue: LengthIssue } {
  const d = (description || '').trim();
  if (!d) return { ok: false, issue: 'missing' };
  if (d.length < EDITORIAL_LIMITS.descriptionMin) return { ok: false, issue: 'too_short' };
  if (d.length > EDITORIAL_LIMITS.descriptionMax) return { ok: false, issue: 'too_long' };
  return { ok: true, issue: null };
}

/**
 * Granskar en uppsättning artiklar.
 * errors: dubblett-slug, dubblett-titel, trasiga interna artikellänkar.
 * warnings: tunt innehåll, titel/desc-längd, saknad kategori/taggar/omslagsbild.
 */
export function auditPosts(posts: AuditablePost[]): AuditReport {
  const errors: AuditFinding[] = [];
  const warnings: AuditFinding[] = [];
  const bySlug = new Map<string, boolean>();
  const byTitle = new Map<string, boolean>();
  const slugs = new Set<string>();

  for (const p of posts) {
    const slug = (p.slug || '').toLowerCase();
    if (slug) slugs.add(slug);
    if (bySlug.has(slug)) errors.push({ type: 'duplicate_slug', slug, detail: 'Slug används av flera artiklar' });
    bySlug.set(slug, true);
    const titleKey = (p.title || '').trim().toLowerCase();
    if (titleKey) {
      if (byTitle.has(titleKey)) {
        errors.push({ type: 'duplicate_title', slug, detail: `Titeln "${p.title}" används av flera artiklar` });
      }
      byTitle.set(titleKey, true);
    }
  }

  for (const p of posts) {
    const slug = (p.slug || '').toLowerCase();
    const words = p.word_count ?? markdownWordCount(p.content);
    if (words < EDITORIAL_LIMITS.thinWords) {
      warnings.push({ type: 'thin_content', slug, detail: `${words} ord (< ${EDITORIAL_LIMITS.thinWords})` });
    }
    const t = auditTitle(p.title);
    if (!t.ok) warnings.push({ type: `title_${t.issue}`, slug, detail: (p.title || '').slice(0, 80) });
    const desc = auditDescription(p.meta_description || p.excerpt);
    if (!desc.ok) {
      warnings.push({
        type: `description_${desc.issue}`,
        slug,
        detail: `${(p.meta_description || p.excerpt || '').length} tecken`,
      });
    }
    if (!p.category) warnings.push({ type: 'missing_category', slug, detail: '' });
    if (!Array.isArray(p.tags) || p.tags.length === 0) {
      warnings.push({ type: 'missing_tags', slug, detail: '' });
    }
    if (!p.cover_image_url && !p.feature_image_url) {
      warnings.push({ type: 'missing_cover', slug, detail: '' });
    }

    for (const target of extractInternalArticleLinks(p.content)) {
      if (!slugs.has(target)) {
        errors.push({ type: 'broken_internal_link', slug, detail: `Länkar till /artikel/${target} som inte finns` });
      }
    }
  }

  return { total: posts.length, errors, warnings };
}
