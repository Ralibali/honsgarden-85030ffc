import type { HealthLog } from '@/lib/api';

/** Keep the original health-log storage so entries from earlier app versions survive. */
export function diaryEntries(logs: HealthLog[], search = ''): HealthLog[] {
  const query = search.trim().toLocaleLowerCase('sv-SE');
  return logs
    .filter((entry) => entry.type === 'diary')
    .filter((entry) => !query || `${entry.description ?? ''} ${entry.date}`.toLocaleLowerCase('sv-SE').includes(query))
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
}

export function diaryDateLabel(date: string): string {
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${date}T12:00:00`));
}

export const DIARY_MILESTONES = {
  first_egg: 'Första ägget', arrival: 'Flyttade in', brooding: 'Började ruva', hatching: 'Kläckning', other: 'Annat',
} as const;
export function diaryHenIds(entry: HealthLog): string[] {
  return [...new Set([...(entry.diary_entry_hens ?? []).map(link => link.hen_id), ...(entry.hen_id ? [entry.hen_id] : [])])];
}
