import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ArticleCta from '@/components/blog/ArticleCta';
import StickySidebarCta from '@/components/blog/StickySidebarCta';
import { REGISTER_HREF } from '@/components/blog/BlogConversionPopup';
import { parseAnalyticsSource } from '@/lib/analytics';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

function hrefOf(name: RegExp): string {
  const link = screen.getByRole('link', { name });
  return link.getAttribute('href') ?? '';
}

describe('blogg-CTA:er länkar till registrering med korrekt source', () => {
  beforeEach(() => {
    (window as unknown as { plausible?: unknown }).plausible = vi.fn();
  });
  afterEach(() => {
    delete (window as unknown as { plausible?: unknown }).plausible;
  });

  it('ArticleCta inline pekar på mode=register och source=blog_inline', () => {
    renderWithRouter(<ArticleCta variant="inline" />);
    const href = hrefOf(/skapa gratis konto/i);
    expect(href).toContain('mode=register');
    expect(href).toContain('source=blog_inline');
  });

  it('ArticleCta final pekar på mode=register och source=blog_final', () => {
    renderWithRouter(<ArticleCta variant="final" />);
    const href = hrefOf(/skapa gratis konto/i);
    expect(href).toContain('mode=register');
    expect(href).toContain('source=blog_final');
  });

  it('StickySidebarCta pekar på mode=register och source=blog_sidebar', () => {
    renderWithRouter(<StickySidebarCta />);
    const href = hrefOf(/skapa konto/i);
    expect(href).toContain('mode=register');
    expect(href).toContain('source=blog_sidebar');
  });

  it('ArticleCta skickar CTA Register Clicked med rätt source vid klick', () => {
    renderWithRouter(<ArticleCta variant="inline" />);
    screen.getByRole('link', { name: /skapa gratis konto/i }).click();
    expect(window.plausible).toHaveBeenCalledWith('CTA Register Clicked', {
      props: { source: 'blog_inline' },
    });
  });
});

describe('BlogConversionPopup konto-CTA', () => {
  it('använder mode=register och source=blog_popup', () => {
    expect(REGISTER_HREF).toContain('mode=register');
    expect(REGISTER_HREF).toContain('source=blog_popup');
  });

  it('innehåller inga /auth-länkar längre', () => {
    const file = readFileSync(
      path.resolve(process.cwd(), 'src/components/blog/BlogConversionPopup.tsx'),
      'utf8',
    );
    expect(file).not.toMatch(/["'`]\/auth\b/);
  });
});

describe('parseAnalyticsSource', () => {
  it('accepterar tillåtna blogg-sources', () => {
    expect(parseAnalyticsSource('blog_inline')).toBe('blog_inline');
    expect(parseAnalyticsSource('blog_header')).toBe('blog_header');
  });

  it('faller tillbaka på signup_form för okänd eller saknad input', () => {
    expect(parseAnalyticsSource(null)).toBe('signup_form');
    expect(parseAnalyticsSource('')).toBe('signup_form');
    expect(parseAnalyticsSource('<script>evil</script>')).toBe('signup_form');
  });

  it('respekterar egen fallback', () => {
    expect(parseAnalyticsSource(undefined, 'blog_popup')).toBe('blog_popup');
  });
});
