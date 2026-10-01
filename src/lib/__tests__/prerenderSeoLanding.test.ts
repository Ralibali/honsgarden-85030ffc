import { describe, expect, it } from 'vitest';
import { SEO_LANDING_PAGES } from '@/data/seoLandingPages.mjs';
import { renderSeoLandingBody } from '@/lib/prerenderSeoLanding.mjs';
import { extractH1Texts } from '@/lib/prerenderTopicPages.mjs';

describe('crawlable public product landings', () => {
  it.each(Object.values(SEO_LANDING_PAGES))('renders the shared copy for $path without requiring JavaScript', (page: any) => {
    const body = renderSeoLandingBody(page);
    expect(extractH1Texts(body)).toEqual([page.h1]);
    const document = new DOMParser().parseFromString(body, 'text/html');
    expect(document.body.textContent).toContain(page.intro);
    for (const section of page.sections) expect(document.body.textContent).toContain(section.body);
    for (const faq of page.faq) expect(document.body.textContent).toContain(faq.a);
    expect(document.querySelector('a[href="/login?mode=register"]')).not.toBeNull();
  });
  it('escapes shared copy instead of injecting it as markup', () => {
    const page = { ...SEO_LANDING_PAGES.agglogg, intro: '<script>bad()</script>' };
    expect(renderSeoLandingBody(page)).toContain('&lt;script&gt;bad()&lt;/script&gt;');
  });
});
