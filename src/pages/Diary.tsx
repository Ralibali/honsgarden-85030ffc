import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Pencil, Plus, Search, Loader2 } from 'lucide-react';
import { api, type HealthLog } from '@/lib/api';
import { diaryDateLabel, diaryEntries } from '@/lib/diary';
import { usePageTitle } from '@/hooks/usePageTitle';
import PageHeader from '@/components/PageHeader';
import DiaryEditor from '@/components/diary/DiaryEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Diary({ demo = false }: { demo?: boolean }) {
  usePageTitle('Dagbok');
  const [params, setParams] = useSearchParams();
  const [open, setOpen] = useState(() => params.get('write') === '1');
  const [editing, setEditing] = useState<HealthLog | null>(null);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(30);
  const { data: logs = [], isPending, isError, refetch } = useQuery({ queryKey: ['health-logs', 'diary'], queryFn: () => api.getDiaryLogs() });
  const entries = useMemo(() => diaryEntries(logs, search), [logs, search]);
  const total = useMemo(() => diaryEntries(logs).length, [logs]);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next && params.has('write')) { const nextParams = new URLSearchParams(params); nextParams.delete('write'); setParams(nextParams, { replace: true }); }
  }

  return <div data-private-content className="max-w-2xl mx-auto space-y-6 pb-8">
    <PageHeader title="Dagbok" emoji="📖" subtitle="Små minnen. Stora händelser. Din flock, med dina ord." actions={<Button className="gap-2 min-h-11 rounded-xl" onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" />Skriv i dagboken</Button>} />
    <div className="rounded-2xl border border-primary/15 bg-primary/5 p-4 flex gap-3">
      <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
      <div><p className="text-sm font-medium">Din berättelse om hönsgården</p><p className="text-sm text-muted-foreground mt-1">Dagboken ingår gratis. Här finns även dina tidigare dagboksinlägg samlade.</p></div>
    </div>
    <div className="relative"><Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" aria-hidden="true" /><Input aria-label="Sök i dagboken" placeholder="Sök bland minnen och datum…" className="pl-10 h-11 rounded-xl" value={search} onChange={(event) => { setSearch(event.target.value); setLimit(30); }} /></div>
    {isPending ? <p role="status" className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Hämtar din dagbok…</p> : isError ? <div role="alert" className="rounded-xl border p-5 space-y-3"><p>Vi kunde inte hämta dagboken just nu.</p><Button variant="outline" onClick={() => void refetch()}>Försök igen</Button></div> : <>
      <p className="text-xs text-muted-foreground" role="status">{search ? `${entries.length} ${entries.length === 1 ? 'träff' : 'träffar'} av ${total} inlägg` : `${total} inlägg i din dagbok`}</p>
      {entries.length === 0 ? <section className="text-center rounded-2xl border border-dashed p-8 sm:p-12">
        <BookOpen className="h-9 w-9 text-primary/60 mx-auto mb-4" />
        <h2 className="font-serif text-2xl">{search ? 'Inga inlägg matchade sökningen' : 'Vad vill du minnas från idag?'}</h2>
        <p className="text-muted-foreground text-sm mt-2 mb-5">{search ? 'Prova ett annat ord eller rensa sökningen.' : 'Det behöver inte vara märkvärdigt. Ett par rader räcker.'}</p>
        <Button variant="outline" onClick={() => { if (search) setSearch(''); else { setEditing(null); setOpen(true); } }}>{search ? 'Rensa sökningen' : 'Skriv ditt första inlägg'}</Button>
      </section> : <div className="space-y-4">
        {entries.slice(0, limit).map((entry) => <article key={entry.id} className="rounded-2xl border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3 mb-3"><time dateTime={entry.date} className="text-sm font-medium text-primary">{diaryDateLabel(entry.date)}</time><Button variant="ghost" size="sm" className="gap-1.5 min-h-11" aria-label={`Redigera inlägg från ${diaryDateLabel(entry.date)}`} onClick={() => { setEditing(entry); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /><span>Redigera</span></Button></div>
          <p className="whitespace-pre-wrap break-words leading-relaxed text-foreground/90">{entry.description || 'Tomt dagboksinlägg'}</p>
        </article>)}
        {entries.length > limit && <Button className="w-full" variant="outline" onClick={() => setLimit((value) => value + 30)}>Visa fler inlägg</Button>}
      </div>}
    </>}
    <DiaryEditor open={open} onOpenChange={changeOpen} entry={editing} demo={demo} />
  </div>;
}
