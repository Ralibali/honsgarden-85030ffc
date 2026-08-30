import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackEvent } from '@/lib/analytics';

function mockPlausible() {
  const calls: Array<{ event: string; props?: Record<string, unknown> }> = [];
  window.plausible = ((event: string, options?: { props?: Record<string, unknown> }) => {
    calls.push({ event, props: options?.props });
  }) as typeof window.plausible;
  return calls;
}

afterEach(() => {
  delete window.plausible;
  vi.unstubAllGlobals();
});

describe('V2 funnel event catalog (swarm U)', () => {
  it('sends demo funnel events with low-cardinality props', () => {
    const calls = mockPlausible();
    trackEvent('Demo Opened', { source: 'landing_hero' });
    trackEvent('Demo Feature Used', { feature: 'egg_log' });
    trackEvent('Demo To Signup', { feature: 'agda_preview' });
    expect(calls.map((c) => c.event)).toEqual(['Demo Opened', 'Demo Feature Used', 'Demo To Signup']);
    expect(calls[1].props).toEqual({ feature: 'egg_log' });
  });

  it('sends activation funnel events', () => {
    const calls = mockPlausible();
    trackEvent('First Hen Added', { source: 'quick_fab' });
    trackEvent('Onboarding Step Completed', { step: 'first_egg' });
    trackEvent('Onboarding Completed');
    expect(calls).toHaveLength(3);
    expect(calls[2].props).toBeUndefined();
  });

  it('sends push lifecycle events', () => {
    const calls = mockPlausible();
    trackEvent('Push Prompt Shown', { source: 'dashboard' });
    trackEvent('Push Permission Result', { result: 'accepted' });
    trackEvent('Push Subscription Created');
    trackEvent('Notification Clicked', { channel: 'push' });
    expect(calls.map((c) => c.event)).toEqual([
      'Push Prompt Shown',
      'Push Permission Result',
      'Push Subscription Created',
      'Notification Clicked',
    ]);
  });

  it('sends premium gate, seasonal, referral and marketplace events', () => {
    const calls = mockPlausible();
    trackEvent('Plus Gate Shown', { feature: 'agda' });
    trackEvent('Plus Gate Clicked', { feature: 'agda' });
    trackEvent('Seasonal Mode Changed', { mode: 'winter' });
    trackEvent('Referral Link Shared');
    trackEvent('Referral Signup');
    trackEvent('Marketplace Listing Created');
    trackEvent('Marketplace Contact Clicked');
    expect(calls).toHaveLength(7);
  });

  it('drops empty/undefined props instead of sending noise', () => {
    const calls = mockPlausible();
    trackEvent('Demo Feature Used', { feature: undefined });
    expect(calls[0].props).toBeUndefined();
  });

  it('never sends events from excluded internal paths', () => {
    const calls = mockPlausible();
    const original = window.location;
    // jsdom tillåter inte att vi skriver location direkt – stubba via defineProperty
    Object.defineProperty(window, 'location', {
      value: { ...original, pathname: '/app/admin' },
      configurable: true,
    });
    trackEvent('Demo Opened');
    expect(calls).toHaveLength(0);
    Object.defineProperty(window, 'location', { value: original, configurable: true });
  });

  it('fails silently when plausible is not loaded', () => {
    expect(() => trackEvent('Demo Opened')).not.toThrow();
  });
});
