import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ArrowRight, Pencil } from 'lucide-react';
import { api } from '@/lib/api';
import { diaryDateLabel, diaryEntries } from '@/lib/diary';
import { Button } from '@/components/ui/button';

export default function DiaryCard({ demo = false }: { demo?: boolean }) {
  const { data: logs = [], isPending, isError } = useQuery({ queryKey: ['health-logs', 'diary'], queryFn: () => api.getDiaryLogs() });
  const latest = diaryEntries(logs)[0];
  const path = demo ? '/demo?view=diary' : '/app/dagbok';
  return <section data-private-content className="rounded-2xl border border-primary/15 bg-card p-5 sm:p-6" aria-labelledby="diary-heading">
    <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><BookOpen className="h-5 w-5 text-primary" /><h2 id="diary-heading" className="font-serif text-xl">Dagbok</h2></div><Link to={path} className="text-sm text-primary inline-flex items-center gap-1 min-h-11">Alla inlägg<ArrowRight className="h-4 w-4" /></Link></div>
    {isPending ? <p role="status" className="text-sm text-muted-foreground py-3">Hämtar din dagbok…</p> : isError ? <p className="text-sm text-muted-foreground py-3">Dagboken kunde inte hämtas. Öppna alla inlägg för att försöka igen.</p> : latest ? <Link to={path} className="block py-3"><time dateTime={latest.date} className="text-xs text-muted-foreground">{diaryDateLabel(latest.date)}</time><p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm leading-relaxed">{latest.description}</p></Link> : <p className="text-sm text-muted-foreground py-3">Första ägget, en ny höna eller en lugn stund. Spara det du vill minnas.</p>}
    <Button asChild variant="outline" className="rounded-xl gap-2 min-h-11"><Link to={`${path}${demo ? '&' : '?'}write=1`}><Pencil className="h-4 w-4" />Skriv i dagboken</Link></Button>
  </section>;
}
