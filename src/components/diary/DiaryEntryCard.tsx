import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import type { HealthLog, Hen } from '@/lib/api';
import { diaryDateLabel, diaryHenIds, DIARY_MILESTONES } from '@/lib/diary';
import { Button } from '@/components/ui/button';
import DiaryImages from './DiaryImages';

export default function DiaryEntryCard({ entry, hens, onEdit, demo = false }: { entry: HealthLog; hens: Hen[]; onEdit: () => void; demo?: boolean }) {
  const milestone = DIARY_MILESTONES[entry.milestone as keyof typeof DIARY_MILESTONES];
  return <article data-private-content className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm space-y-3">
    <div className="flex items-center justify-between gap-3"><time dateTime={entry.date} className="text-sm font-medium text-primary">{diaryDateLabel(entry.date)}</time><Button variant="ghost" size="sm" className="gap-1.5 min-h-11" aria-label={`Redigera inlägg från ${diaryDateLabel(entry.date)}`} onClick={onEdit}><Pencil className="h-3.5 w-3.5" /><span>Redigera</span></Button></div>
    {milestone && <p className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">{milestone}</p>}
    <p className="whitespace-pre-wrap break-words leading-relaxed text-foreground/90">{entry.description || 'Tomt dagboksinlägg'}</p>
    <DiaryImages paths={entry.image_paths ?? []} />
    <div className="flex flex-wrap gap-2">{diaryHenIds(entry).map(id => {
      const hen = hens.find(h => h.id === id);
      return hen ? demo ? <span key={id} className="rounded-full bg-muted px-3 py-1 text-sm">{hen.name}</span> : <Link key={id} className="rounded-full bg-muted px-3 py-2 text-sm hover:bg-primary/10" to={`/app/hens/${id}`}>{hen.name}</Link> : null;
    })}</div>
  </article>;
}
