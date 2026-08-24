import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';
import { Bird, CheckCircle2, Egg, ReceiptText, Wheat, X } from 'lucide-react';

export default function ProductOnboardingChecklist() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(() => readScoped(user?.id, 'product-onboarding-checklist-dismissed') === '1');

  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens().catch(() => []), staleTime: 60_000 });
  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs().catch(() => []), staleTime: 60_000 });
  const { data: feedRecords = [] } = useQuery({ queryKey: ['feed-records'], queryFn: () => api.getFeedRecords().catch(() => []), staleTime: 60_000 });

  const steps = useMemo(() => {
    const hasHens = (hens as any[]).length > 0;
    const hasEggs = (eggs as any[]).length > 0;
    const hasFeed = (feedRecords as any[]).length > 0;
    return [
      { id: 'hens', done: hasHens, title: 'Lägg till första hönan', text: 'Gör appen personlig och lås upp bättre statistik.', icon: Bird, action: 'Lägg till höna', path: '/app/hens' },
      { id: 'eggs', done: hasEggs, title: 'Logga första ägget', text: 'Starta din historik, streak och veckostatistik.', icon: Egg, action: 'Logga ägg', path: '/app/eggs' },
      { id: 'feed', done: hasFeed, title: 'Lägg in första foderköpet', text: 'Börja räkna kostnad per ägg.', icon: Wheat, action: 'Lägg till foder', path: '/app/feed' },
      { id: 'sales', done: false, title: 'Testa Agdas Bod', text: 'Skapa en säljsida om du säljer ägg lokalt.', icon: ReceiptText, action: 'Skapa säljsida', path: '/app/egg-sales', optional: true },
    ];
  }, [hens, eggs, feedRecords]);

  const requiredSteps = steps.filter((s) => !s.optional);
  const completedRequired = requiredSteps.filter((s) => s.done).length;
  const progress = Math.round((completedRequired / requiredSteps.length) * 100);
  const isComplete = completedRequired === requiredSteps.length;

  if (dismissed || isComplete) return null;

  const dismiss = () => {
    writeScoped(user?.id, 'product-onboarding-checklist-dismissed', '1');
    setDismissed(true);
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/8 via-card to-accent/5 shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="data-label mb-1">Kom igång</p>
            <h2 className="font-serif text-lg text-foreground">Gör Hönsgården användbar på riktigt</h2>
            <p className="text-sm text-muted-foreground mt-1">Följ de första stegen så börjar dashboard, statistik och råd ge mer värde.</p>
          </div>
          <button onClick={dismiss} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Dölj kom igång-lista">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{completedRequired} av {requiredSteps.length} grundsteg klara</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div key={step.id} className={`rounded-2xl border p-3 flex items-start gap-3 ${step.done ? 'bg-success/5 border-success/20' : 'bg-background/70 border-border/60'}`}>
                <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${step.done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>
                  {step.done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    {step.optional && <span className="text-[10px] text-muted-foreground">valfritt</span>}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{step.text}</p>
                  {!step.done && (
                    <Button size="sm" variant="outline" className="mt-2 h-8 rounded-xl text-xs" onClick={() => navigate(step.path)}>
                      {step.action}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
