import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PulseItem } from '@/lib/farmPulse';

const completeReminder = vi.fn(async () => ({ nextDueDate: '2026-12-01' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/lib/reminderSchedule', () => ({
  completeReminder: (...args: unknown[]) => completeReminder(...(args as [])),
  REMINDERS_QUERY_KEY: ['reminders'],
}));
vi.mock('@/lib/haptics', () => ({ hapticSuccess: () => {} }));

import FarmPulseCard from '@/components/dashboard/FarmPulseCard';

function renderCard(items: PulseItem[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <FarmPulseCard
          items={items}
          seasonKey="winter-2026"
          reminders={[{ id: 'r1', title: 'Kvalsterkoll', reminder_type: 'cleaning', recurrence: 'monthly', due_date: '2026-10-28', status: 'overdue' }]}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const reminderItem: PulseItem = { id: 'reminder-r1', kind: 'reminder', tone: 'urgent', reminderId: 'r1', title: 'Kvalsterkoll', detail: 'Försenad 2 dagar', priority: 92 };
const seasonItem: PulseItem = { id: 'season-winter', kind: 'season', tone: 'calm', title: 'Vinterläge på gården', detail: 'Färre ägg är normalt nu.', href: '/honskalender', ctaLabel: 'Vinterrutiner', priority: 10 };

describe('FarmPulseCard', () => {
  beforeEach(() => {
    localStorage.clear();
    completeReminder.mockClear();
  });

  it('renderar ingenting när allt är lugnt', () => {
    const { container } = renderCard([]);
    expect(container).toBeEmptyDOMElement();
  });

  it('bockar av en försenad påminnelse direkt från Idag', async () => {
    renderCard([reminderItem]);
    expect(screen.getByText('Behöver dig idag')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Markera Kvalsterkoll som klar' }));
    await waitFor(() => expect(completeReminder).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }), 'u1'));
  });

  it('låter användaren dölja vinterläget för säsongen och minns valet', () => {
    const { unmount } = renderCard([seasonItem]);
    fireEvent.click(screen.getByRole('button', { name: 'Dölj för den här säsongen' }));
    expect(screen.queryByText('Vinterläge på gården')).not.toBeInTheDocument();
    unmount();
    const again = renderCard([seasonItem]);
    expect(again.container).toBeEmptyDOMElement();
  });
});
