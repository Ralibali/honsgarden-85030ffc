import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ContextualRegisterCta from '@/components/ContextualRegisterCta';
import { CONTEXTUAL_CTAS } from '@/lib/contextualRegisterCtas';

vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/components/LandingNavbar', () => ({ default: () => <nav>navbar</nav> }));
vi.mock('@/components/LandingFooter', () => ({ default: () => <footer>footer</footer> }));

import HonsrasLanding from '@/pages/HonsrasLanding';

describe('ContextualRegisterCta', () => {
  it.each(CONTEXTUAL_CTAS)('renderar exakt knapptext och href för $path', (cta) => {
    render(
      <MemoryRouter>
        <ContextualRegisterCta body={cta.body} button={cta.button} href={cta.href} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: cta.button })).toHaveAttribute('href', cta.href);
    expect(screen.getByText(cta.body)).toBeInTheDocument();
  });
});

describe('HonsrasLanding hydrerar samma register-CTA som prerender', () => {
  it.each([
    ['orpington', 'Hur många ägg lägger en orpington per år?', 'Logga ägg från din Orpington — gratis', '/login?mode=register&source=orpington'],
    ['sussex', 'Hur många ägg lägger en sussex per år?', 'Logga ägg från din Sussex — gratis', '/login?mode=register&source=sussex'],
  ] as const)('%s visar CTA efter FAQ-frågan', (slug, question, button, href) => {
    render(
      <MemoryRouter>
        <HonsrasLanding slug={slug} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: question })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: button })).toHaveAttribute('href', href);
  });

  it('andra rassidor saknar de ras-specifika register-CTA:erna', () => {
    render(
      <MemoryRouter>
        <HonsrasLanding slug="wyandotte" />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('link', { name: 'Logga ägg från din Orpington — gratis' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Logga ägg från din Sussex — gratis' })).toBeNull();
  });
});
