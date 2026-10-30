import { describe, expect, it, vi } from 'vitest';

const updateEq = vi.fn(async () => ({ error: null }));
const insert = vi.fn(async () => ({ error: null }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: updateEq }),
      insert,
    }),
  },
}));

import { completeReminder, isOpenReminder, nextReminderDate } from '@/lib/reminderSchedule';

describe('nextReminderDate', () => {
  it('stegar dagar och veckor', () => {
    expect(nextReminderDate('2026-10-30', 'daily')).toBe('2026-10-31');
    expect(nextReminderDate('2026-10-30', 'weekly')).toBe('2026-11-06');
  });

  it('stannar på månadens sista dag i stället för att rinna över', () => {
    expect(nextReminderDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextReminderDate('2028-01-31', 'monthly')).toBe('2028-02-29');
    expect(nextReminderDate('2026-11-30', 'quarterly')).toBe('2027-02-28');
    expect(nextReminderDate('2028-02-29', 'yearly')).toBe('2029-02-28');
  });

  it('klarar sommartidsskiftet utan att tappa en dag', () => {
    expect(nextReminderDate('2026-10-24', 'weekly')).toBe('2026-10-31');
    expect(nextReminderDate('2026-03-28', 'daily')).toBe('2026-03-29');
  });

  it('returnerar null för engångspåminnelser och trasiga datum', () => {
    expect(nextReminderDate('2026-10-30', 'none')).toBeNull();
    expect(nextReminderDate('inte-ett-datum', 'weekly')).toBeNull();
  });
});

describe('isOpenReminder', () => {
  it('räknar bara kommande och försenade som öppna', () => {
    expect(isOpenReminder('upcoming')).toBe(true);
    expect(isOpenReminder('overdue')).toBe(true);
    expect(isOpenReminder('done')).toBe(false);
    expect(isOpenReminder('archived')).toBe(false);
  });
});

describe('completeReminder', () => {
  it('skapar nästa tillfälle för återkommande påminnelser', async () => {
    const result = await completeReminder({
      id: 'r1', title: 'Kvalsterkoll', reminder_type: 'cleaning', recurrence: 'monthly',
      due_date: '2026-10-31', status: 'overdue', hen_id: null, flock_id: 'f1',
    }, 'u1');
    expect(updateEq).toHaveBeenCalledWith('id', 'r1');
    expect(result.nextDueDate).toBe('2026-11-30');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ due_date: '2026-11-30', status: 'upcoming', flock_id: 'f1', user_id: 'u1' }));
  });

  it('säger tydligt till om nästa tillfälle inte kunde sparas', async () => {
    insert.mockResolvedValueOnce({ error: { message: 'nekad' } } as never);
    await expect(completeReminder({
      id: 'r2', title: 'Avmaskning', reminder_type: 'deworming', recurrence: 'quarterly',
      due_date: '2026-10-01', status: 'overdue',
    }, 'u1')).rejects.toThrow(/nästa tillfälle/);
  });
});
