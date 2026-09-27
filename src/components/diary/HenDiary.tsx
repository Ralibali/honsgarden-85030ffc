import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, type HealthLog } from '@/lib/api';
import { diaryEntries, diaryHenIds } from '@/lib/diary';
import { Button } from '@/components/ui/button';
import DiaryEditor from './DiaryEditor';
import DiaryEntryCard from './DiaryEntryCard';

export default function HenDiary({ henId, henName }: { henId: string; henName: string }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<HealthLog | null>(null);
  const [limit, setLimit] = useState(5);
  const { data: logs = [], isPending, isError, refetch } = useQuery({ queryKey: ['health-logs', 'diary'], queryFn: () => api.getDiaryLogs() });
  const { data: hens = [] } = useQuery({ queryKey: ['farm-hens'], queryFn: () => api.getFarmHens() });
  const entries = diaryEntries(logs).filter(entry => diaryHenIds(entry).includes(henId));
  return <section data-private-content aria-label={`Dagbok om ${henName}`} className="space-y-3 rounded-2xl border p-4">
    <div className="flex flex-wrap justify-between items-center gap-2"><h3 className="font-serif text-lg">Dagbok om {henName}</h3><Button variant="outline" className="min-h-11" onClick={() => { setEditing(null); setOpen(true); }}>Skriv inlägg om {henName}</Button></div>
    {isPending ? <p role="status" className="text-sm">Hämtar dagboken…</p> : isError ? <p role="alert">Dagboken kunde inte hämtas. <Button variant="link" onClick={() => void refetch()}>Försök igen</Button></p> : entries.length ? entries.slice(0, limit).map(entry => <DiaryEntryCard key={entry.id} entry={entry} hens={hens} onEdit={() => { setEditing(entry); setOpen(true); }} />) : <p className="text-sm text-muted-foreground">Samla bilder, minnen och milstolpar från {henName}s liv.</p>}
    {entries.length > limit && <Button variant="outline" onClick={() => setLimit(n => n + 10)}>Visa fler inlägg</Button>}
    <DiaryEditor open={open} onOpenChange={setOpen} entry={editing} defaultHenId={henId} />
  </section>;
}
