import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ExampleEggSale from '@/pages/ExampleEggSale';
import CreateEggSaleListingDialog from '@/components/CreateEggSaleListingDialog';
import { loginErrorMessage } from '@/lib/loginError';
import { matchRoute } from '@/lib/routeInventory';

const db = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: db.from, auth: { getUser: db.getUser } } }));
vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/components/LandingNavbar', () => ({ default: () => null }));
vi.mock('@/components/LandingFooter', () => ({ default: () => null }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('visitor fixes', () => {
  it('lets visitors try the example without reading or writing seller data', () => {
    render(<ExampleEggSale />);
    expect(screen.getByRole('heading', { name: 'Bergs ägg' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Antal kartor med 12 ägg'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Visa bokningsexempel' }));
    expect(screen.getByRole('status')).toHaveTextContent('3 kartor, 36 ägg, totalt 180 kr');
    expect(screen.getByRole('status')).toHaveTextContent('Inget har skickats eller sparats');
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each(['/funktioner', '/priser', '/villkor'])('redirects %s', (path) => {
    const destinations: Record<string, string> = { '/funktioner': '/#funktioner', '/priser': '/#priser', '/villkor': '/terms' };
    expect(matchRoute(path)).toEqual({ kind: 'redirect', destination: destinations[path], statusCode: 308 });
  });

  it('translates invalid login credentials by code and by legacy message', () => {
    for (const error of [{ code: 'invalid_credentials' }, new Error('Invalid login credentials')]) {
      expect(loginErrorMessage(error)).toBe('Felaktig e-post eller fel lösenord');
    }
    expect(loginErrorMessage(new Error('database internal error'))).not.toContain('database');
  });

  it('closes the sales dialog immediately using the Swedish close button and Escape on first opening', async () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><MemoryRouter><CreateEggSaleListingDialog /></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: /Skapa säljsida/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Skapa säljsida/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Stäng', exact: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(db.from).not.toHaveBeenCalled();
    client.clear();
  });
});
