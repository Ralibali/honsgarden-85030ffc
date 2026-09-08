import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BlogConversionPopup from './BlogConversionPopup';
import { useAuth } from '@/hooks/useAuth';
import { isNativePlatform } from '@/lib/nativePlatform';
import { trackEvent } from '@/lib/analytics';
import { selectBlogOffer } from '@/lib/blogOffers';

vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/nativePlatform', () => ({ isNativePlatform: vi.fn(() => false) }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
const auth = (loading = false, isAuthenticated = false) => vi.mocked(useAuth).mockReturnValue({ loading, isAuthenticated } as ReturnType<typeof useAuth>);
const view = (slug = 'framtida-artikel-2030') => <MemoryRouter><BlogConversionPopup key={slug} articleSlug={slug} category="guide" /></MemoryRouter>;
let day = 0;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2030, 0, 1 + (++day * 2)));
  localStorage.clear(); sessionStorage.clear();
  auth(); vi.mocked(isNativePlatform).mockReturnValue(false);
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: 2000, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.clearAllMocks(); });
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('blog product popup', () => {
  it('shows the priced product and sample after reading, without blocking the article', () => {
    render(view('hons-for-nyborjare'));
    expect(screen.queryByRole('dialog')).toBeNull();
    Object.defineProperty(window, 'scrollY', { value: 600, configurable: true });
    fireEvent.scroll(window);
    advance(14_999);
    expect(screen.queryByRole('dialog')).toBeNull();
    advance(1);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false');
    expect(screen.getByRole('link', { name: /Se guiden/ })).toHaveAttribute('href', '/guider/mina-forsta-hons');
    expect(screen.getByRole('link', { name: /Gratis smakprov/ })).toHaveAttribute('href', '/guider/mina-forsta-hons-smakprov.pdf');
    expect(trackEvent).toHaveBeenCalledWith('Blog Offer Shown', expect.objectContaining({ product: 'mina-forsta-hons' }));
  });
  it.each(['loading', 'signed-in', 'native'] as const)('never opens for %s visitors', (state) => {
    auth(state === 'loading', state === 'signed-in');
    vi.mocked(isNativePlatform).mockReturnValue(state === 'native');
    render(view()); advance(60_000);
    fireEvent.mouseLeave(document, { clientY: 0 });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
  });
  it('cancels the pending timer when authentication changes and hides an open offer on sign-in', () => {
    const { rerender } = render(view()); advance(20_000);
    auth(false, true); rerender(view()); advance(60_000);
    expect(screen.queryByRole('dialog')).toBeNull();
    auth(); rerender(view()); advance(45_000);
    expect(screen.getByRole('dialog')).toBeVisible();
    auth(false, true); rerender(view());
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('closes with Escape and does not reappear on the next article', () => {
    const { rerender } = render(view()); advance(45_000);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(view('another-future-article')); advance(60_000);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('Blog Offer Clicked', expect.objectContaining({ action: 'dismiss' }));
  });
  it('respects the 24-hour cap across sessions', () => {
    localStorage.setItem('hg-blog-offer-v2', String(Date.now() - 3600_000));
    render(view()); advance(60_000);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('does not stack on another dialog or open in a hidden tab', () => {
    const { rerender } = render(<><div role="dialog">Another dialog</div>{view()}</>);
    advance(45_000);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    rerender(view());
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    advance(45_000);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('supports future and unrelated article categories with varied, honest copy', () => {
    const variants = new Set(Array.from({ length: 20 }, (_, i) => selectBlogOffer(`future-${i}`, 'tradgard').id));
    expect(variants.size).toBeGreaterThan(4);
    const first = selectBlogOffer('some-future-post');
    expect(selectBlogOffer('some-future-post', undefined, first.id).id).not.toBe(first.id);
    expect(selectBlogOffer('hons-pa-vintern').product).toBe('vinterklar-honsgard');
    expect(selectBlogOffer('salja-agg-hemma').product).toBe('aggbodens-saljpaket');
    expect(selectBlogOffer('skyltar-aggbod').product).toBe('aggbodens-saljpaket');
    expect(selectBlogOffer('klacka-agg').product).toBe('klackdagboken');
  });
  it('tracks a product click and dismisses the offer', () => {
    render(view()); advance(45_000);
    fireEvent.click(screen.getByRole('link', { name: /Se guiden/ }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith('Blog Offer Clicked', expect.objectContaining({ action: 'product' }));
  });
});
