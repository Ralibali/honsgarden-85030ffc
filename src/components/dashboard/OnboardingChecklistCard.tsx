import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Check, Circle, ArrowRight, X } from 'lucide-react';
import { api } from '@/lib/api';

const DISMISS_KEY = 'honsgarden-onboarding-checklist-dismissed';

interface Props {
  hensCount: number;
  eggsCount: number;
  feedRecordsCount: number;
}

export default function OnboardingChecklistCard({ hensCount, eggsCount, feedRecordsCount }: Props) {
  const { data: flocks = [] } = useQuery({ queryKey: ['flocks'], queryFn: () => api.getFlocks(), staleTime: 60_000 });

  const steps = useMemo(() => [
    { key: 'flock', label: 'Skapa din första flock', done: flocks.length > 0, href: '/app/flocks' },
    { key: 'hens', label: 'Lägg till hönor', done: hensCount > 0, href: '/app/hens' },
    { key: 'egg', label: 'Logga första ägget', done: eggsCount > 0, href: '/app/eggs' },
    { key: 'feed', label: 'Ange foderkostnad', done: feedRecordsCount > 0, href: '/app/feed' },
  ], [flocks.length, hensCount, eggsCount, feedRecordsCount]);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const dismissed = typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1';

  if (allDone || dismissed) return null;

  const nextStep = steps.find((s) => !s.done);
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <Card className="border-primary/20 bg-primary/[0.04] shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1">Kom igång ({doneCount}/{steps.length})</p>
            <h2 className="font-serif text-lg text-foreground leading-tight">Grundbygg din hönsgård</h2>
          </div>
          <button
            aria-label="Dölj checklista"
            className="shrink-0 h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition flex items-center justify-center"
            onClick={() => {
              localStorage.setItem(DISMISS_KEY, '1');
              window.dispatchEvent(new Event('storage'));
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <ul className="space-y-1.5 mb-4">
          {steps.map((s) => (
            <li key={s.key}>
              <Link
                to={s.href}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition ${s.done ? 'text-muted-foreground line-through' : 'text-foreground hover:bg-primary/10'}`}
              >
                {s.done ? (
                  <span className="h-5 w-5 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </span>
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                )}
                <span className="flex-1">{s.label}</span>
                {!s.done && s === nextStep && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
