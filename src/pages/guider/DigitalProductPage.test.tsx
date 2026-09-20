import { trackPaidPdfDownload } from '@/lib/paidPdfAnalytics';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DigitalProductPage from './DigitalProductPage';
import MinaForstaHonsTack from './MinaForstaHonsTack';
import MinaForstaHonsHamta from './MinaForstaHonsHamta';
import { NEW_DIGITAL_PRODUCTS } from '@/lib/digitalProducts';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('./useNoReferrer', () => ({ useNoReferrer: vi.fn() }));
vi.mock('@/components/LandingNavbar', () => ({ default: () => null }));
vi.mock('@/components/LandingFooter', () => ({ default: () => null }));
vi.mock('@/lib/nativePlatform', () => ({ isNativePlatform: () => false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('@/lib/paidPdfAnalytics', () => ({ trackPaidPdfDownload: vi.fn().mockResolvedValue(undefined) }));
afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('digital product storefront', () => {
  it.each(NEW_DIGITAL_PRODUCTS.filter(p => p.saleStatus !== 'preparing'))('$title shows the real sample and requires country and consent before checkout', async product => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: new Error('Offline test') } as never);
    render(<MemoryRouter><DigitalProductPage productSlug={product.slug} /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: product.title, level: 1 })).toBeVisible();
    expect(screen.getByRole('link', { name: /Gratis smakprov/ })).toHaveAttribute('href', product.sample);
    const buy = screen.getByRole('button', { name: `Köp PDF – ${product.price} kr` });
    expect(buy).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SE' } });
    expect(buy).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(buy).toBeEnabled();
    fireEvent.click(buy);
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledWith('digital-checkout', { body: { productSlug: product.slug, country: 'SE', consent: true, termsVersion: '2026-09-08' } }));
  });
  it('does not offer payment before the paid asset is ready', () => {
    render(<MemoryRouter><DigitalProductPage productSlug="fran-honsgard-till-aggbod" /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Försäljningen öppnar');
    expect(screen.queryByRole('button', { name: /Köp PDF/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Gratis smakprov/ })).toHaveAttribute('href', '/downloads/fran-honsgard-till-aggbod-smakprov.pdf');
  });
  it('uses the verified order product for the delivered page count', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { paid: true, productSlug: 'klackdagboken', orderNumber: 'HG-TEST', token: 'a'.repeat(64) }, error: null } as never);
    render(<MemoryRouter initialEntries={['/?session_id=cs_test_mock']}><MinaForstaHonsTack productSlug="vinterklar-honsgard" /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Ladda ner PDF:en (16 sidor)' })).toBeVisible();
    expect(screen.queryByText(/24 sidor/)).toBeNull();
  });
  it('recovers the selected product without requesting links for unrelated purchases', async () => {
    vi.mocked(supabase.functions.invoke).mockResolvedValue({ data: { ok: true }, error: null } as never);
    render(<MemoryRouter><MinaForstaHonsHamta productSlug="aggbodens-saljpaket" /></MemoryRouter>);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'test@example.se' } });
    fireEvent.click(screen.getByRole('button', { name: 'Skicka min nedladdningslänk' }));
    await waitFor(() => expect(supabase.functions.invoke).toHaveBeenCalledWith('digital-resend-link', { body: { email: 'test@example.se', productSlug: 'aggbodens-saljpaket' } }));
  });
});


describe.each(['thank_you', 'email_link'] as const)('paid PDF download from %s', source => {
  it.each(['success', 'error', 'missing_url'])('only counts a successful issued link: %s', async outcome => {
    vi.mocked(supabase.functions.invoke).mockImplementation(async name => {
      if (name === 'digital-order-status') return { data: { paid: true, productSlug: 'klackdagboken', token: 'test-token' }, error: null } as never;
      return { data: outcome === 'success' ? { url: '#download' } : {}, error: outcome === 'error' ? new Error('test failure') : null } as never;
    });
    render(<MemoryRouter initialEntries={['/?t=test-token&session_id=test-session']}>
      {source === 'thank_you' ? <MinaForstaHonsTack /> : <MinaForstaHonsHamta />}
    </MemoryRouter>);
    fireEvent.click(await screen.findByRole('button', { name: /Ladda ner PDF:en/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Ladda ner PDF:en/ })).toBeEnabled());
    if (outcome === 'success') {
      expect(trackPaidPdfDownload).toHaveBeenCalledExactlyOnceWith('klackdagboken', source);
    } else {
      expect(trackPaidPdfDownload).not.toHaveBeenCalled();
    }
  });
});
