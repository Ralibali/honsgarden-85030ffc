import { describe, expect, it } from 'vitest';
import DOMPurify from 'dompurify';
import { GUIDE_NEXT_STEPS, injectGuideNextSteps } from '../guideNextSteps.mjs';

const original = '<h2>Sammanfattning</h2><p>Artikelns ursprungliga text.</p>';

describe('guide next steps across prerender and client sanitization', () => {
  it.each(Object.entries(GUIDE_NEXT_STEPS))('%s keeps the article and both usable links', (slug, guide) => {
    const html = injectGuideNextSteps(original, slug);
    expect(html.startsWith(original)).toBe(true);
    const container = document.createElement('div');
    container.innerHTML = DOMPurify.sanitize(html);
    const section = container.querySelector('#guide-next-steps');
    expect(section?.querySelector('h2')?.textContent).toBe(guide.title);
    expect(section?.querySelectorAll('a')).toHaveLength(2);
    for (const item of [guide.primary, guide.related]) {
      const anchor = section?.querySelector(`a[href="${item.href}"]`);
      expect(anchor?.textContent).toBe(item.label);
    }
    expect(injectGuideNextSteps(html, slug)).toBe(html);
  });

  it('leaves other slugs and empty input untouched', () => {
    for (const slug of [undefined, null, '', 'unknown', 'bast-honsras-sverige', 'constructor', '__proto__']) {
      expect(injectGuideNextSteps(original, slug)).toBe(original);
    }
    expect(injectGuideNextSteps('', 'klacka-agg')).toBe('');
  });
});
