import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PublicEggSaleV3 from '../PublicEggSaleV3';

vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: vi.fn(),
  },
}));

function openListing(packsAvailable: number, pricePerPack: number, tiers: unknown[] = []) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const listing = {
    id: 'garden', user_id: 'seller', slug: 'exempel', eggs_per_pack: 6,
    price_per_pack: pricePerPack, p12_price: 54, packs_available: packsAvailable,
    swish_number: '0700000000', price_tiers: tiers,
  };
  client.setQueryData(['public-egg-sale-listing-v3', listing.slug], listing);
  client.setQueryData(['public-egg-sale-reserved-packs-v3', listing.id], 0);
  client.setQueryData(['public-egg-sale-slots-v3', listing.id], []);
  client.setQueryData(['public-egg-sale-reviews-v3', listing.id], []);
  client.setQueryData(['public-egg-sale-social-proof-v3', listing.id], { bookings_today: 0 });
  client.setQueryData(['public-egg-sale-verified-v3', listing.user_id], false);
  render(<QueryClientProvider client={client}>
    <MemoryRouter initialEntries={['/s/exempel']}>
      <Routes><Route path="/s/:slug" element={<PublicEggSaleV3 />} /></Routes>
    </MemoryRouter>
  </QueryClientProvider>);
}

describe('ägghandelns publika pris och lagersaldo', () => {
  it('använder säljarens sexpackspris med ören och tillämpar mängdpris först vid rätt antal', () => {
    openListing(10, 27.75, [{ min_qty: 3, max_qty: null, price_per_pack: 24.50 }]);
    const quantity = screen.getByRole('spinbutton', { name: 'Antal kartor' });
    expect(screen.getByRole('button', { name: /Öppna Swish \(27[.,]75 kr\)/ })).toBeEnabled();
    fireEvent.change(quantity, { target: { value: '2' } });
    expect(screen.getByRole('button', { name: /Öppna Swish \(55[.,]5 kr\)/ })).toBeEnabled();
    fireEvent.change(quantity, { target: { value: '3' } });
    expect(screen.getByRole('button', { name: /Öppna Swish \(73[.,]5 kr\)/ })).toBeEnabled();
  });

  it('visar väntelistan när säljaren har noll kartor i lager', () => {
    openListing(0, 0);
    expect(screen.queryByRole('button', { name: /Skicka bokningsförfrågan/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Anmäl mig' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Öppna Swish \(0 kr\)/ })).toBeDisabled();
  });
});
