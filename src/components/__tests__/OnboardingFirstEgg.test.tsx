import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import OnboardingGuide from '../OnboardingGuide';

// ---- kedjbar supabase-mock ----
const { eggInsert, henInsertSingle, henInsert, mockGetFlocks } = vi.hoisted(() => {
  const henInsertSingle = vi.fn().mockResolvedValue({ data: { id: 'hen-1' }, error: null });
  return {
    eggInsert: vi.fn().mockResolvedValue({ error: null }),
    henInsertSingle,
    henInsert: vi.fn().mockReturnValue({
      select: () => ({ single: henInsertSingle }),
    }),
    mockGetFlocks: vi.fn().mockResolvedValue([]),
  };
});

function chain(result: { data?: unknown; error?: unknown }) {
  const resolved = { data: result.data ?? null, error: result.error ?? null };
  const obj: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update']) {
    obj[m] = vi.fn().mockReturnValue(obj);
  }
  obj.single = vi.fn().mockResolvedValue(resolved);
  obj.maybeSingle = vi.fn().mockResolvedValue(resolved);
  obj.then = (fn: (v: unknown) => unknown) => Promise.resolve(fn(resolved));
  return obj;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => {
      if (table === 'profiles') return chain({ data: { preferences: {} } });
      if (table === 'hens') {
        const c = chain({ data: [], error: null });
        (c.insert as ReturnType<typeof vi.fn>).mockImplementation(henInsert);
        return c;
      }
      if (table === 'egg_logs') {
        const c = chain({ data: [], error: null });
        (c.insert as ReturnType<typeof vi.fn>).mockImplementation(eggInsert);
        return c;
      }
      return chain({ data: [] });
    },
  },
}));

vi.mock('@/lib/api', () => ({
  api: {
    getFlocks: (...args: unknown[]) => mockGetFlocks(...args),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'test@test.se', name: 'Test' } }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/haptics', () => ({ hapticSuccess: vi.fn() }));

function renderGuide() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OnboardingGuide />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OnboardingGuide – första ägget på 30 sekunder', () => {
  beforeEach(() => {
    localStorage.clear();
    eggInsert.mockClear();
    henInsertSingle.mockClear();
    henInsert.mockClear();
    mockGetFlocks.mockReset();
    mockGetFlocks.mockResolvedValue([]);
  });

  it('guidar från första hönan till loggat ägg utan att lämna dialogen', async () => {
    renderGuide();

    // steg 0: välkommen (dialogen öppnas efter en kort fördröjning)
    fireEvent.click(await screen.findByText('Lägg till höna', {}, { timeout: 3000 }));

    // steg 1: namnge hönan och spara
    fireEvent.change(await screen.findByPlaceholderText(/Greta/i), { target: { value: 'Blanka' } });
    fireEvent.click(screen.getByText('Spara hönan'));

    // steg 2: första-ägg-knappen syns direkt i dialogen
    const eggBtn = await screen.findByText(/Lägg Blankas första ägg!/i);
    fireEvent.click(eggBtn);

    await waitFor(() => expect(eggInsert).toHaveBeenCalledTimes(1));
    expect(henInsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Blanka', user_id: 'user-1', flock_id: null }),
    );
    expect(eggInsert).toHaveBeenCalledWith(
      expect.objectContaining({ count: 1, hen_id: 'hen-1', user_id: 'user-1' }),
    );

    // firande-läge + möjlighet att logga ett till
    expect(await screen.findByText(/Första ägget loggat!/i)).toBeInTheDocument();
    expect(screen.getByText(/din streak har officiellt börjat/i)).toBeInTheDocument();
    expect(screen.getByText(/Logga ett ägg till \(1\)/i)).toBeInTheDocument();
  }, 10000);

  it('kopplar första hönan till flocken som valts i onboardingen', async () => {
    mockGetFlocks.mockResolvedValue([{ id: 'flock-honsuset', name: 'Hönshuset' }]);
    renderGuide();

    fireEvent.click(await screen.findByText('Lägg till höna', {}, { timeout: 3000 }));
    fireEvent.change(await screen.findByPlaceholderText(/Greta/i), { target: { value: 'Blanka' } });
    fireEvent.click(screen.getByText('Spara hönan'));

    await waitFor(() => expect(henInsert).toHaveBeenCalled());
    expect(henInsert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Blanka', flock_id: 'flock-honsuset' }),
    );
  }, 10000);
});
