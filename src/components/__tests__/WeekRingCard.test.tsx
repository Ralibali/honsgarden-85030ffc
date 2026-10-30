import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { computeWeekProgress } from '@/lib/logStreak';
import { onUnlockCelebration } from '@/lib/unlockBus';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import WeekRingCard from '@/components/dashboard/WeekRingCard';

const days = (dates: string[], count = 1) => dates.map((date) => ({ date, count }));
const FULL_WEEK = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'];

describe('WeekRingCard', () => {
  beforeEach(() => localStorage.clear());

  it('visar hur långt det är kvar till en perfekt vecka', () => {
    const week = computeWeekProgress(days(FULL_WEEK.slice(0, 3)), '2026-11-05')!;
    render(<WeekRingCard week={week} streak={3} winter />);
    expect(screen.getByTestId('week-ring-summary')).toHaveTextContent('3 av 7 dagar · 4 kvar till perfekt vecka');
    expect(screen.getByText('Vinterläge: äggfria dagar räknas')).toBeInTheDocument();
    expect(screen.getByLabelText('3 dagar i rad')).toBeInTheDocument();
  });

  it('firar en perfekt vecka en gång – även med äggfria dagar', () => {
    const celebrations: string[] = [];
    const off = onUnlockCelebration((c) => celebrations.push(c.title));
    const week = computeWeekProgress(days(FULL_WEEK, 0), '2026-11-08')!;
    const first = render(<WeekRingCard week={week} streak={7} winter />);
    expect(screen.getByTestId('week-ring-summary')).toHaveTextContent('Perfekt vecka – alla sju dagar!');
    first.unmount();
    render(<WeekRingCard week={week} streak={7} winter />);
    off();
    expect(celebrations).toEqual(['Perfekt vecka!']);
  });

  it('firar inte i demoläget', () => {
    const celebrations: string[] = [];
    const off = onUnlockCelebration((c) => celebrations.push(c.title));
    const week = computeWeekProgress(days(FULL_WEEK), '2026-11-08')!;
    render(<WeekRingCard week={week} streak={7} winter={false} demo />);
    off();
    expect(celebrations).toEqual([]);
  });
});
