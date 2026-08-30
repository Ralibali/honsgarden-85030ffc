/**
 * Redaktionell kvalitetsgrind (Swarm D) — skriptvariant.
 *
 * Ren policy för innehållskvalitet över publicerade bloggartiklar.
 * Används av scripts/editorial-audit.mjs. HÅLLS I SYNK med
 * editorialAudit.ts (typad spegel som testerna kör mot) — ändras den
 * ena ändras den andra.
 *
 * Principen: granskningen stoppar aldrig publicering automatiskt;
 * den gör kvalitetsläget synligt (errors = bör åtgärdas, warnings =
 * bör granskas redaktionellt).
 */

export const EDITORIAL_LIMITS = {
  titleMax: 60,
  descriptionMin: 70,
  descriptionMax: 160,
  thinWords: 300,
};

/** Räknar ord i markdown/HTML-brödtext utan att räkna syntax. */
export function markdownWordCount(markdown) {
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
export function extractInternalArticleLinks(markdown) {
  if (!markdown) return [];
  const found = new Set();
  const re = /\]\(\/artikel\/([a-z0-9-]+)[)\s#?]|href="\/artikel\/([a-z0-9-]+)["#?]/gi;
  let m;
  while ((m = re.exec(String(markdown)))) {
    found.add((m[1] || m[2]).toLowerCase());
  }
  return Array.from(found);
}

export function auditTitle(title) {
  if (!title || !String(title).trim()) return { ok: false, issue: 'missing' };
  if (String(title).trim().length > EDITORIAL_LIMITS.titleMax) return { ok: false, issue: 'too_long' };
  return { ok: true, issue: null };
}

export function auditDescription(description) {
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
export function auditPosts(posts) {
  const errors = [];
  const warnings = [];
  const bySlug = new Map();
  const byTitle = new Map();
  const slugs = new Set();

  for (const p of posts) {
    const slug = (p.slug || '').toLowerCase();
    if (slug) slugs.add(slug);
    if (bySlug.has(slug)) errors.push({ type: 'duplicate_slug', slug, detail: `Slug används av flera artiklar` });
    bySlug.set(slug, true);
    const titleKey = (p.title || '').trim().toLowerCase();
    if (titleKey) {
      if (byTitle.has(titleKey)) errors.push({ type: 'duplicate_title', slug, detail: `Titeln "${p.title}" används av flera artiklar` });
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
    if (!desc.ok) warnings.push({ type: `description_${desc.issue}`, slug, detail: `${(p.meta_description || p.excerpt || '').length} tecken` });
    if (!p.category) warnings.push({ type: 'missing_category', slug, detail: '' });
    if (!Array.isArray(p.tags) || p.tags.length === 0) warnings.push({ type: 'missing_tags', slug, detail: '' });
    if (!p.cover_image_url && !p.feature_image_url) warnings.push({ type: 'missing_cover', slug, detail: '' });

    for (const target of extractInternalArticleLinks(p.content)) {
      if (!slugs.has(target)) {
        errors.push({ type: 'broken_internal_link', slug, detail: `Länkar till /artikel/${target} som inte finns` });
      }
    }
  }

  return { total: posts.length, errors, warnings };
}
