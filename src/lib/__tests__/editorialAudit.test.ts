import { describe, expect, it } from 'vitest';
import {
  auditDescription,
  auditPosts,
  auditTitle,
  EDITORIAL_LIMITS,
  extractInternalArticleLinks,
  markdownWordCount,
} from '../editorialAudit';

const LONG_TITLE = 'x'.repeat(EDITORIAL_LIMITS.titleMax + 1);
const GOOD_DESC = 'y'.repeat(100);

describe('markdownWordCount', () => {
  it('counts words without markdown syntax, images or code blocks', () => {
    const md = '# Rubrik\n\nDetta är **fet** text med [en länk](/artikel/x) och ![alt](/bild.jpg).\n\n```\nkod kod kod\n```';
    // Rubrik(1) Detta2 är3 fet4 text5 med6 en7 länk8 och9 → 9 ord (kodblocket räknas ej, 'alt' ej heller)
    expect(markdownWordCount(md)).toBe(9);
  });

  it('handles empty input', () => {
    expect(markdownWordCount('')).toBe(0);
    expect(markdownWordCount(null)).toBe(0);
    expect(markdownWordCount(undefined)).toBe(0);
  });
});

describe('extractInternalArticleLinks', () => {
  it('finds markdown and html article links, deduped and lowercased', () => {
    const md = 'Se [A](/artikel/Foder-Tips) och <a href="/artikel/vinterhons">B</a> samt [igen](/artikel/foder-tips).';
    expect(extractInternalArticleLinks(md)).toEqual(['foder-tips', 'vinterhons']);
  });

  it('ignores external and non-article links', () => {
    expect(extractInternalArticleLinks('[x](https://example.com/artikel/y) [z](/guider/abc)')).toEqual([]);
  });
});

describe('auditTitle / auditDescription', () => {
  it('classifies titles', () => {
    expect(auditTitle('')).toEqual({ ok: false, issue: 'missing' });
    expect(auditTitle('  ')).toEqual({ ok: false, issue: 'missing' });
    expect(auditTitle(LONG_TITLE)).toEqual({ ok: false, issue: 'too_long' });
    expect(auditTitle('Bra titel')).toEqual({ ok: true, issue: null });
  });

  it('classifies descriptions', () => {
    expect(auditDescription(null)).toEqual({ ok: false, issue: 'missing' });
    expect(auditDescription('kort')).toEqual({ ok: false, issue: 'too_short' });
    expect(auditDescription('z'.repeat(EDITORIAL_LIMITS.descriptionMax + 1))).toEqual({ ok: false, issue: 'too_long' });
    expect(auditDescription(GOOD_DESC)).toEqual({ ok: true, issue: null });
  });
});

describe('auditPosts', () => {
  const goodPost = {
    slug: 'bra-artikel',
    title: 'En bra artikel om höns',
    meta_description: GOOD_DESC,
    content: Array(350).fill('ord').join(' '),
    category: 'skötsel',
    tags: ['foder'],
    cover_image_url: '/x.jpg',
  };

  it('passes a healthy post with no findings', () => {
    const report = auditPosts([goodPost]);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.total).toBe(1);
  });

  it('flags duplicate slugs and titles as errors', () => {
    const report = auditPosts([goodPost, { ...goodPost }]);
    expect(report.errors.some((e) => e.type === 'duplicate_slug')).toBe(true);
    expect(report.errors.some((e) => e.type === 'duplicate_title')).toBe(true);
  });

  it('flags broken internal article links as errors', () => {
    const report = auditPosts([{ ...goodPost, content: `${goodPost.content} [x](/artikel/finns-inte)` }]);
    expect(report.errors.some((e) => e.type === 'broken_internal_link' && e.detail.includes('finns-inte'))).toBe(true);
    // Länk till existerande slug → inget fel
    const ok = auditPosts([goodPost, { ...goodPost, slug: 'annan', title: 'Annan titel', content: `[x](/artikel/bra-artikel) ${goodPost.content}` }]);
    expect(ok.errors).toEqual([]);
  });

  it('warns on thin content and missing metadata without erroring', () => {
    const thin = { ...goodPost, slug: 'tunn', title: 'Tunn artikel', content: 'bara några ord här', word_count: null, category: null, tags: [], cover_image_url: null, feature_image_url: null, meta_description: '' };
    const report = auditPosts([thin]);
    expect(report.errors).toEqual([]);
    const types = report.warnings.map((w) => w.type);
    expect(types).toContain('thin_content');
    expect(types).toContain('missing_category');
    expect(types).toContain('missing_tags');
    expect(types).toContain('missing_cover');
    expect(types).toContain('description_missing');
  });

  it('falls back to counting content when word_count is missing', () => {
    const longContent = Array(400).fill('höns').join(' ');
    const report = auditPosts([{ ...goodPost, content: longContent, word_count: null }]);
    expect(report.warnings.some((w) => w.type === 'thin_content')).toBe(false);
  });
});
