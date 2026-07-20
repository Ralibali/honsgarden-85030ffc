import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Shop from '@/pages/Shop';

const mockAdminCheck = vi.fn();
const mockInvoke = vi.fn();
const mockToast = vi.fn();

const PRODUCTS = [
  {
    id: 'p1', name: 'Hönsgården T-shirt', description: 'Mjuk tröja', emoji: '👕',
    image_url: null, price_ore: 24900, stock: 10, active: true, sort_order: 1,
    created_at: '2026-07-21T00:00:00Z', updated_at: '2026-07-21T00:00:00Z',
  },
  {
    id: 'p2', name: 'Hönsgården mugg', description: '', emoji: '☕',
    image_url: null, price_ore: 14900, stock: 0, active: true, sort_order: 2,
    created_at: '2026-07-21T00:00:00Z', updated_at: '2026-07-21T00:00:00Z',
  },
];

/** Kedjebar supabase-mock: varje metod returnerar samma kedja, await ger { data, error: null }. */
function chain(data: unknown) {
  const c: Record<string, unknown> = {};
  const handler = () => c;
  ['select', 'order', 'eq', 'limit', 'insert', 'update', 'delete', 'in'].forEach((m) => { c[m] = handler; });
  c.maybeSingle = () => Promise.resolve({ data: null, error: null });
  c.single = () => Promise.resolve({ data, error: null });
  c.then = (resolve: (v: unknown) => unknown) => resolve({ data, error: null });
  return c;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => chain(table === 'shop_products' ? PRODUCTS : []),
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: (...args: unknown[]) => mockToast(...args) }));
vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: { adminCheck: (...args: unknown[]) => mockAdminCheck(...args) },
}));

function renderShop() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/app/butik']}>
        <Shop />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Shop – webbshoppen', () => {
  beforeEach(() => {
    localStorage.clear();
    mockAdminCheck.mockReset();
    mockInvoke.mockReset();
  });

  it('visar låsskärm för icke-admin', async () => {
    mockAdminCheck.mockResolvedValue({ is_admin: false });
    renderShop();
    expect(await screen.findByText('Butiken är låst')).toBeInTheDocument();
    expect(screen.queryByText('Hönsgården T-shirt')).not.toBeInTheDocument();
  });

  it('admin ser produkter och kan lägga i varukorg', async () => {
    mockAdminCheck.mockResolvedValue({ is_admin: true });
    renderShop();

    expect(await screen.findByText('Hönsgården T-shirt')).toBeInTheDocument();
    // Slutsåld produkt kan inte läggas i varukorgen
    expect(screen.getByText('Slutsåld')).toBeDisabled();

    fireEvent.click(screen.getByText('Lägg i varukorg'));
    expect(await screen.findByText('Varukorg')).toBeInTheDocument();
  });

  it('checkout anropar shop-checkout med varukorgens innehåll', async () => {
    mockAdminCheck.mockResolvedValue({ is_admin: true });
    mockInvoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.com/test' }, error: null });
    renderShop();

    fireEvent.click(await screen.findByText('Lägg i varukorg'));
    fireEvent.click(await screen.findByText('Varukorg'));
    fireEvent.click(await screen.findByText('Betala med Stripe'));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith(
      'shop-checkout',
      { body: { items: [{ product_id: 'p1', quantity: 1 }] } },
    ));
  });
});
