import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Premium from '@/pages/Premium';
import svPremium from '@/i18n/locales/sv/premium.json';

const mockInvoke = vi.fn();
const authState = vi.hoisted(() => ({
  user: {
    id: 'user-1',
    premium_type: null as 'free' | 'trial' | 'paid' | 'lifetime' | null,
    subscription_end: null as string | null,
  },
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: authState.user, refreshSubscription: vi.fn() }),
}));
vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/hooks/useTracking', () => ({ trackClick: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    getEggs: vi.fn().mockResolvedValue([]),
    getHens: vi.fn().mockResolvedValue([]),
  },
}));

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return (acc as Record<string, unknown>)[part];
    return undefined;
  }, svPremium);
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { returnObjects?: boolean; count?: number; brand?: string }) => {
      const value = lookup(key);
      if (opts?.returnObjects) return Array.isArray(value) ? value : [];
      if (typeof value !== 'string') return key;
      return value
        .replace('{{count}}', String(opts?.count ?? ''))
        .replace('{{brand}}', opts?.brand ?? 'Hönsgården');
    },
    i18n: { language: 'sv' },
  }),
}));

function renderPremium() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/app/premium']}>
        <Premium />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const FREE_TRIAL_COPY = /prova plus gratis|prova plus i lugn och ro|sju dagar|7 dagar/i;

describe('Premium – trial vs free-trial CTA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/session' }, error: null });
    authState.user = {
      id: 'user-1',
      premium_type: null,
      subscription_end: null,
    };
  });

  it('visar inte ny-trial-CTA när användaren redan har aktiv Plus-trial', () => {
    authState.user = {
      id: 'user-1',
      premium_type: 'trial',
      subscription_end: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    };

    renderPremium();

    expect(screen.queryByText(FREE_TRIAL_COPY)).not.toBeInTheDocument();
    expect(screen.queryByText(svPremium.sticky_cta)).not.toBeInTheDocument();
    expect(screen.queryByText(svPremium.hero.free_trial)).not.toBeInTheDocument();
    expect(screen.getByText(/du har plus-trial/i)).toBeInTheDocument();
    expect(screen.getByText(/dagar kvar av din plus-trial/i)).toBeInTheDocument();
    expect(screen.getByText(svPremium.active.manage)).toBeInTheDocument();
  });

  it('visar gratis-trial-CTA för användare som inte är på trial', () => {
    authState.user = {
      id: 'user-1',
      premium_type: 'free',
      subscription_end: null,
    };

    renderPremium();

    expect(screen.getByText(svPremium.hero.free_trial)).toBeInTheDocument();
    expect(screen.queryByText(/du har plus-trial/i)).not.toBeInTheDocument();
    expect(screen.getByText(svPremium.plans.monthly.cta)).toBeInTheDocument();
    expect(screen.getByText(svPremium.plans.yearly.cta)).toBeInTheDocument();
  });
});
