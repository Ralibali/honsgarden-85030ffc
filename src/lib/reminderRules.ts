/**
 * Rena regler för påminnelser (inga nätverksanrop) – delas av
 * Påminnelser-sidan, Idag-vyn och tester.
 */
import { parseIsoDate, toIsoDate } from '@/lib/tools/hatchCalculator';
import { addDaysIso } from '@/lib/isoDay';

export type ReminderRecurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface ReminderLike {
  id: string;
  title: string;
  notes?: string | null;
  reminder_type: string;
  recurrence: string;
  due_date: string;
  status: string;
  hen_id?: string | null;
  flock_id?: string | null;
}

/** Påminnelser som fortfarande väntar på att bli gjorda. */
export function isOpenReminder(status: string | null | undefined): boolean {
  return status === 'upcoming' || status === 'overdue';
}

function addMonthsClamped(iso: string, months: number): string | null {
  const date = parseIsoDate(iso);
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  return toIsoDate(new Date(Date.UTC(year, month, day, 12)));
}

/**
 * Nästa förfallodag för en återkommande påminnelse. Månadssteg stannar på
 * månadens sista dag i stället för att rinna över (31 jan → 28/29 feb).
 * Returnerar null för engångspåminnelser eller ogiltiga datum.
 */
export function nextReminderDate(dueIso: string, recurrence: string): string | null {
  switch (recurrence) {
    case 'daily': return addDaysIso(dueIso, 1);
    case 'weekly': return addDaysIso(dueIso, 7);
    case 'monthly': return addMonthsClamped(dueIso, 1);
    case 'quarterly': return addMonthsClamped(dueIso, 3);
    case 'yearly': return addMonthsClamped(dueIso, 12);
    default: return null;
  }
}
