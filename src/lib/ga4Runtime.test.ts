import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const originalPush = history.pushState;
const originalReplace = history.replaceState;
let runtime: typeof import('./ga4Runtime');
const commands = () => (window as unknown as { dataLayer: ArrayLike<unknown>[] }).dataLayer.map(row => Array.from(row));
const events = () => commands().filter(row => row[0] === 'event');
beforeEach(async () => {
  vi.resetModules();
  history.pushState = originalPush;
  history.replaceState = originalReplace;
  history.replaceState({}, '', '/?email=private@example.com#token');
  document.head.querySelectorAll('script').forEach(el => el.remove());
  localStorage.clear();
  delete (window as unknown as { gtag?: unknown }).gtag;
  (window as unknown as { dataLayer: unknown[] }).dataLayer = [];
  runtime = await import('./ga4Runtime');
  runtime.initGa4({ measurementId: 'G-TEST123456', hosts: [location.hostname], excluded: ['/admin','/stay'], consentKey: 'ga-test' });
});
afterEach(() => { history.pushState = originalPush; history.replaceState = originalReplace; });
describe('GA4 transport', () => {
  it('does not load Google or queue any events before consent', () => {
    runtime.sendAnalyticsEvent('Signup Completed', { props: { source: 'landing' } });
    expect(events()).toEqual([]);
    expect(document.querySelector('script[src*="googletagmanager"]')).toBeNull();
  });
  it('loads once and sends exactly one pageview per SPA navigation', () => {
    runtime.setAnalyticsConsent(true);
    runtime.setAnalyticsConsent(true);
    runtime.sendAnalyticsEvent('pageview');
    history.pushState({}, '', '/pricing?email=secret@example.com');
    runtime.sendAnalyticsEvent('pageview');
    expect(events().map(row => row[1])).toEqual(['page_view','page_view']);
    expect(document.querySelectorAll('script[src*="googletagmanager"]')).toHaveLength(1);
    expect(JSON.stringify(events())).not.toContain('email=');
    expect(JSON.stringify(events())).not.toContain('token');
  });
  it('blocks internal pageviews and redacts custom-event route context', () => {
    runtime.setAnalyticsConsent(true);
    history.pushState({}, '', '/admin/customers/secret');
    runtime.sendAnalyticsEvent('pageview');
    runtime.sendAnalyticsEvent('Subscription Purchased', { props: { plan: 'plus' } });
    expect(events().filter(row => row[1] === 'page_view')).toHaveLength(1);
    expect(JSON.stringify(events())).not.toContain('/admin');
    expect(events().at(-1)?.[1]).toBe('subscription_purchased');
  });
  it('stops events after revocation and does not replay refused events', () => {
    runtime.setAnalyticsConsent(true);
    runtime.setAnalyticsConsent(false);
    runtime.sendAnalyticsEvent('Signup Completed');
    history.pushState({}, '', '/pricing');
    expect(events()).toHaveLength(1);
    runtime.setAnalyticsConsent(true);
    expect(events().map(row => row[1])).toEqual(['page_view','page_view']);
  });
  it('maps names, filters personal data and preserves allowed funnel properties', () => {
    runtime.setAnalyticsConsent(true);
    runtime.sendAnalyticsEvent('Paid PDF Download', { props: { product: 'mina-forsta-hons', source: 'thank_you', email: 'a@b.se', note: 'a@b.se' } });
    expect(events().at(-1)).toEqual(['event', 'paid_pdf_download', expect.objectContaining({ product: 'mina-forsta-hons', source: 'thank_you', send_to: 'G-TEST123456' })]);
    expect(JSON.stringify(events())).not.toContain('a@b.se');
  });
  it('resolves delivery callbacks even when analytics is refused', () => {
    const done = vi.fn();
    runtime.sendAnalyticsEvent('Paid PDF Download', { callback: done });
    expect(done).toHaveBeenCalledOnce();
  });
});
