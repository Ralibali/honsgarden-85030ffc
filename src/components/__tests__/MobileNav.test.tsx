import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { MobileNav } from '@/components/MobileNav';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/hooks/useTheme', () => ({ useTheme: () => ({ theme: 'light', setTheme: () => {} }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: () => Promise.resolve({ data: false }) } }));

function Location() {
  return <output aria-label="Aktuell sida">{useLocation().pathname}</output>;
}

function setup(path = '/app') {
  return render(<MemoryRouter initialEntries={[path]}><MobileNav /><Location /></MemoryRouter>);
}

describe('Mobile navigation', () => {
  it('opens the diary directly and marks it as the current page', () => {
    setup();
    fireEvent.click(screen.getByRole('link', { name: 'Dagbok' }));
    expect(screen.getByRole('status', { name: 'Aktuell sida' })).toHaveTextContent('/app/dagbok');
    expect(screen.getByRole('link', { name: 'Dagbok' })).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('supports Escape and restores focus to the More button', async () => {
    setup();
    const more = screen.getByRole('button', { name: 'Visa fler delar av Hönsgården' });
    fireEvent.click(more);
    const dialog = await screen.findByRole('dialog', { name: 'Mer i Hönsgården' });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(more).toHaveFocus());
  });

  it('keeps farm routines reachable and closes More after navigation', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Visa fler delar av Hönsgården' }));
    fireEvent.click(await screen.findByRole('link', { name: /Gården Sysslor och rutiner/ }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status', { name: 'Aktuell sida' })).toHaveTextContent('/app/tasks');
    expect(screen.getByRole('button', { name: 'Visa fler delar av Hönsgården' })).toHaveClass('is-active');
  });
});
