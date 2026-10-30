import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MonthRecap } from '@/lib/monthRecap';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/api', () => ({ api: { getTransactions: async () => [] } }));

import MonthRecapCard from '@/components/dashboard/MonthRecapCard';

const recap: MonthRecap = {
  monthKey: '2026-10', monthLabel: 'oktober', previousMonthLabel: 'september',
  totalEggs: 116, loggedDays: 31, bestDay: { date: '2026-10-03', count: 5 }, changePct: 12,
  topHen: { name: 'Blanka', eggs: 30 },
};

function renderCard(isPlus: boolean) {
  return render(<MemoryRouter><MonthRecapCard recap={recap} eggs={[]} hens={[]} isPlus={isPlus} /></MemoryRouter>);
}

describe('MonthRecapCard', () => {
  beforeEach(() => localStorage.clear());

  it('ger alla siffrorna och visar PDF:en som Plus för gratisanvändare', () => {
    renderCard(false);
    expect(screen.getByText('Oktober i hönsgården')).toBeInTheDocument();
    expect(screen.getByText('12 % fler ägg per dag än i september')).toBeInTheDocument();
    expect(screen.getByText(/Månadens flitigaste: Blanka/)).toBeInTheDocument();
    expect(screen.getByText(/ingår i Plus/)).toBeInTheDocument();
    expect(screen.queryByText(/Ladda ner/)).not.toBeInTheDocument();
  });

  it('låter Plus ladda ner rapporten', () => {
    renderCard(true);
    expect(screen.getByRole('button', { name: /Ladda ner oktoberrapporten/ })).toBeEnabled();
  });

  it('kan döljas för månaden och förblir dold', () => {
    const { unmount } = renderCard(true);
    fireEvent.click(screen.getByRole('button', { name: 'Dölj månadens bokslut' }));
    expect(screen.queryByText('Oktober i hönsgården')).not.toBeInTheDocument();
    unmount();
    renderCard(true);
    expect(screen.queryByText('Oktober i hönsgården')).not.toBeInTheDocument();
  });
});
