/**
 * Påminnelser: bocka av en påminnelse och skapa nästa tillfälle för
 * återkommande påminnelser. Används både av Påminnelser-sidan och av
 * Idag-vyn så att återkommande påminnelser beter sig likadant överallt.
 */
import { supabase } from '@/integrations/supabase/client';
import { nextReminderDate, type ReminderLike } from '@/lib/reminderRules';

export { isOpenReminder, nextReminderDate } from '@/lib/reminderRules';
export type { ReminderLike, ReminderRecurrence } from '@/lib/reminderRules';

/** Delad react-query-nyckel så att Idag och Påminnelser läser samma cache. */
export const REMINDERS_QUERY_KEY = ['reminders'] as const;

/** Alla påminnelser som inte är arkiverade, tidigast förfallodag först. */
export async function fetchReminders<T = ReminderLike & { completed_at: string | null; created_at: string; updated_at: string; user_id: string }>(): Promise<T[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .neq('status', 'archived')
    .order('due_date', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

/**
 * Markerar en påminnelse som klar och skapar nästa tillfälle om den är
 * återkommande. Kastar fel om något steg misslyckas, så att UI:t kan
 * visa ett riktigt felmeddelande i stället för att tyst tappa nästa tillfälle.
 */
export async function completeReminder(row: ReminderLike, userId: string): Promise<{ nextDueDate: string | null }> {
  const { error } = await supabase
    .from('reminders')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', row.id);
  if (error) throw new Error(error.message);

  const nextDueDate = nextReminderDate(row.due_date, row.recurrence);
  if (nextDueDate) {
    const { error: insertError } = await supabase.from('reminders').insert({
      user_id: userId,
      title: row.title,
      notes: row.notes ?? null,
      reminder_type: row.reminder_type,
      recurrence: row.recurrence,
      due_date: nextDueDate,
      status: 'upcoming',
      hen_id: row.hen_id ?? null,
      flock_id: row.flock_id ?? null,
    });
    if (insertError) throw new Error(`Påminnelsen är klar, men nästa tillfälle kunde inte skapas: ${insertError.message}`);
  }
  return { nextDueDate };
}
