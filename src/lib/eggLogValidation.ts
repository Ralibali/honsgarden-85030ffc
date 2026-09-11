import { todayLocal } from '@/lib/datetime';

export function eggLogValidationError(date: string, count: number): string | null {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return 'Välj ett giltigt datum.';
  }
  if (date > todayLocal()) return 'Välj idag eller ett tidigare datum.';
  if (!Number.isInteger(count) || count < 0 || count > 2147483647) {
    return 'Ange ett helt antal ägg, minst 0.';
  }
  return null;
}
