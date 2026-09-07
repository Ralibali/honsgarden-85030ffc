import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DigitalGuideCard from './DigitalGuideCard';
import { useAuth } from '@/hooks/useAuth';
import { isNativePlatform } from '@/lib/nativePlatform';
import { trackEvent } from '@/lib/analytics';
import { digitalGuideAudienceForArticle, renderDigitalGuidePlacement } from '@/lib/digitalGuidePlacements.mjs';

vi.mock('@/lib/nativePlatform', () => ({ isNativePlatform: vi.fn(() => false) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn(() => ({ isAuthenticated: false, loading: false })) }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.mocked(isNativePlatform).mockReturnValue(false);
  vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, loading: false } as ReturnType<typeof useAuth>);
});

describe('PDF placements', () => {
  it('matches actual chicken articles and excludes unrelated beginner content', () => {
    expect(digitalGuideAudienceForArticle('skaffa-hons-nyborjare')).toBe('beginner');
    expect(digitalGuideAudienceForArticle('bast-honsras-sverige')).toBe('breed');
    expect(digitalGuideAudienceForArticle('odla-gronsaker-nybojare')).toBeNull();
    expect(digitalGuideAudienceForArticle('__proto__')).toBeNull();
  });
  it('shows a priced offer and a free sample, with contextual copy and anonymous tracking', () => {
    render(<MemoryRouter><DigitalGuideCard audience="breed" placement="blog_article" /></MemoryRouter>);
    expect(screen.getByRole('heading').textContent).toContain('När du valt ras');
    const link = screen.getByRole('link', { name: 'Se guiden – 199 kr' });
    expect(link.getAttribute('href')).toBe('/guider/mina-forsta-hons');
    expect(screen.getByRole('link', { name: /Gratis smakprov/ }).getAttribute('href')).toMatch(/\.pdf$/);
    fireEvent.click(link);
    expect(trackEvent).toHaveBeenCalledWith('Guide CTA Clicked', { placement: 'blog_article', audience: 'breed', action: 'product' });
  });
  it('does not advertise external digital purchases in the native app', () => {
    vi.mocked(isNativePlatform).mockReturnValue(true);
    const { container } = render(<MemoryRouter><DigitalGuideCard placement="blog_index" /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });
  it.each(['blog_index', 'blog_article', 'beginner_guide', 'breed_guide'] as const)('hides the offer for signed-in visitors at %s', (placement) => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, loading: false } as ReturnType<typeof useAuth>);
    const { container } = render(<MemoryRouter><DigitalGuideCard placement={placement} /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
    expect(trackEvent).not.toHaveBeenCalled();
  });
  it('waits for authentication, shows the offer to guests and removes it after sign-in', () => {
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, loading: true } as ReturnType<typeof useAuth>);
    const card = <MemoryRouter><DigitalGuideCard placement="blog_index" /></MemoryRouter>;
    const { container, rerender } = render(card);
    expect(container.innerHTML).toBe('');
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: false, loading: false } as ReturnType<typeof useAuth>);
    rerender(<MemoryRouter><DigitalGuideCard placement="blog_index" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Se guiden – 199 kr' })).toBeVisible();
    vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, loading: false } as ReturnType<typeof useAuth>);
    rerender(<MemoryRouter><DigitalGuideCard placement="blog_index" /></MemoryRouter>);
    expect(container.innerHTML).toBe('');
  });
  it('keeps the static offer hidden until the visitor is confirmed signed out', () => {
    const html = renderDigitalGuidePlacement('breed');
    const { container } = render(<div dangerouslySetInnerHTML={{ __html: html }} />);
    expect(container.querySelector('[data-digital-guide]')).not.toBeVisible();
    expect(html).toContain('När du valt ras');
    expect(html).toContain('199 kr inkl. moms');
    expect(html).toContain('href="/guider/mina-forsta-hons"');
    expect(html).toContain('href="/guider/mina-forsta-hons-smakprov.pdf"');
    expect(renderDigitalGuidePlacement('unrelated')).toBe('');
  });
});
