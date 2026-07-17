import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Check, ArrowRight, X, Users, Bird, Egg, Wheat, BarChart3, Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

// Nyckeln scopes per användare så att flera användare på samma enhet
// får var sin checklista (och att en ny användare inte ärver "dold"-status).
const DISMISS_KEY = 'honsgarden-onboarding-checklist-dismissed';
const getDismissKey = (userId: string) => `${DISMISS_KEY}-${userId}`;

interface Props {
  hensCount: number;
  eggsCount: number;
  feedRecordsCount: number;
}

interface Step {
  key: string;
  label: string;
  description: string;
  cta: string;
  icon: React.ElementType;
  done: boolean;
  href: string;
}

export default function OnboardingChecklistCard({ hensCount, eggsCount, feedRecordsCount }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Läs dismiss-status när användaren har laddats in (auth är asynkront).
  useEffect(() => {
    if (user?.id) {
      setDismissed(localStorage.getItem(getDismissKey(user.id)) === '1');
    }
  }, [user?.id]);

  const { data: flocks = [] } = useQuery({ queryKey: ['flocks'], queryFn: () => api.getFlocks(), staleTime: 60_000 });

  const steps: Step[] = useMemo(() => [
    {
      key: 'flock',
      label: 'Skapa din första flock',
      description: 'Samla hönorna i en flock – t.ex. "Hönshuset".',
      cta: 'Skapa flock',
      icon: Users,
      done: flocks.length > 0,
      href: '/app/hens',
    },
    {
      key: 'hens',
      label: 'Lägg till hönor',
      description: 'Namn och ras – då kan du följa varje höna.',
      cta: 'Lägg till',
      icon: Bird,
      done: hensCount > 0,
      href: '/app/hens',
    },
    {
      key: 'egg',
      label: 'Logga första ägget',
      description: 'Ett tryck – sen börjar statistiken växa fram.',
      cta: 'Logga ägg',
      icon: Egg,
      done: eggsCount > 0,
      href: '/app/eggs',
    },
    {
      key: 'feed',
      label: 'Ange foderkostnad',
      description: 'Då räknar vi ut vad varje ägg kostar dig.',
      cta: 'Lägg till',
      icon: Wheat,
      done: feedRecordsCount > 0,
      href: '/app/feed',
    },
    {
      key: 'stats',
      label: 'Utforska din statistik',
      description: 'Kurvor, trender och smarta insikter om flocken.',
      cta: 'Visa',
      icon: BarChart3,
      done: eggsCount >= 7,
      href: '/app/statistics',
    },
  ], [flocks.length, hensCount, eggsCount, feedRecordsCount]);

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const nextStep = steps.find((s) => !s.done);
  const progress = Math.round((doneCount / steps.length) * 100);

  // Fira kort när allt blivit klart, spara sedan "dold" per användare.
  useEffect(() => {
    if (allDone && !dismissed && user?.id) {
      const t = setTimeout(() => {
        localStorage.setItem(getDismissKey(user.id), '1');
        setDismissed(true);
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [allDone, dismissed, user?.id]);

  if (dismissed) return null;

  const handleDismiss = () => {
    if (user?.id) localStorage.setItem(getDismissKey(user.id), '1');
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25 }}
      >
        <Card className="border-primary/20 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-sm overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-primary mb-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Kom igång · {doneCount}/{steps.length} klart
                </p>
                <h2 className="font-serif text-lg text-foreground leading-tight">
                  {allDone ? '🎉 Allt klart – snyggt jobbat!' : 'Kom igång på fem minuter'}
                </h2>
                {allDone && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Du har lagt grunden – fortsätt logga äggen så fylls insikterna på.
                  </p>
                )}
              </div>
              <button
                aria-label="Dölj checklista"
                className="shrink-0 h-6 w-6 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition flex items-center justify-center"
                onClick={handleDismiss}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <Progress value={progress} className="h-2" />

            <ul className="mt-3 space-y-1">
              {steps.map((step) => {
                const Icon = step.icon;
                const isNext = nextStep?.key === step.key;
                return (
                  <li key={step.key}>
                    <button
                      type="button"
                      onClick={() => !step.done && navigate(step.href)}
                      className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        step.done
                          ? 'opacity-60 cursor-default'
                          : isNext
                            ? 'bg-primary/10 hover:bg-primary/15'
                            : 'hover:bg-muted/60'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          step.done ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {step.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className={`block text-sm font-medium ${step.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {step.label}
                        </span>
                        {isNext && (
                          <span className="block text-xs text-muted-foreground truncate">{step.description}</span>
                        )}
                      </span>
                      {!step.done && (
                        <span className="flex items-center gap-1 text-xs font-medium text-primary shrink-0">
                          {step.cta} <ArrowRight className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
