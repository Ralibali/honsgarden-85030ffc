import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Check,
  ArrowRight,
  X,
  Users,
  Bird,
  Egg,
  Wheat,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

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
  const [showJourney, setShowJourney] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setDismissed(localStorage.getItem(getDismissKey(user.id)) === '1');
    }
  }, [user?.id]);

  const { data: flocks = [] } = useQuery({
    queryKey: ['flocks'],
    queryFn: () => api.getFlocks(),
    staleTime: 60_000,
  });

  const steps: Step[] = useMemo(() => [
    {
      key: 'flock',
      label: 'Ge hönsgården en plats',
      description: 'Skapa en flock, till exempel “Hönshuset”. Då får allt som händer en tydlig hemvist.',
      cta: 'Skapa flock',
      icon: Users,
      done: flocks.length > 0,
      href: '/app/hens?create=flock',
    },
    {
      key: 'hens',
      label: 'Presentera dina hönor',
      description: 'Ett namn räcker. Bilder, ras och mer kan du fylla i när du känner för det.',
      cta: 'Lägg till höna',
      icon: Bird,
      done: hensCount > 0,
      href: '/app/hens?create=hen',
    },
    {
      key: 'egg',
      label: 'Logga första ägget',
      description: 'Här börjar Hönsgården lära känna rytmen i din flock. Det tar bara några sekunder.',
      cta: 'Logga ägg',
      icon: Egg,
      done: eggsCount > 0,
      href: '/app/eggs',
    },
    {
      key: 'feed',
      label: 'Låt ekonomin bli begriplig',
      description: 'Lägg in ett foderinköp så kan Hönsgården börja räkna på ungefärlig kostnad per ägg.',
      cta: 'Lägg in foder',
      icon: Wheat,
      done: feedRecordsCount > 0,
      href: '/app/feed',
    },
    {
      key: 'insights',
      label: 'Låt mönstren växa fram',
      description: 'Efter några loggningar kan du börja se hur värpningen förändras från vecka till vecka.',
      cta: 'Se insikter',
      icon: Sparkles,
      done: eggsCount >= 7,
      href: '/app/statistics',
    },
  ], [flocks.length, hensCount, eggsCount, feedRecordsCount]);

  const doneCount = steps.filter((step) => step.done).length;
  const allDone = doneCount === steps.length;
  const nextStep = steps.find((step) => !step.done);
  const progress = Math.round((doneCount / steps.length) * 100);

  useEffect(() => {
    if (allDone && !dismissed && user?.id) {
      const timer = setTimeout(() => {
        localStorage.setItem(getDismissKey(user.id), '1');
        setDismissed(true);
      }, 7000);
      return () => clearTimeout(timer);
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
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="first-week-journey"
      >
        <Card className="first-week-journey__card overflow-hidden">
          <CardContent className="p-0">
            <div className="first-week-journey__top p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="first-week-journey__eyebrow">
                    <span aria-hidden="true">🌱</span>
                    Din första tid i Hönsgården
                  </p>
                  <h2 className="font-serif text-xl sm:text-2xl text-foreground leading-tight mt-1.5">
                    {allDone ? 'Nu känner Hönsgården din flock' : 'En liten sak i taget räcker'}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1.5 max-w-xl">
                    {allDone
                      ? 'Grunden är på plats. Nu blir Hönsgården bättre ju mer vardag du låter den följa.'
                      : 'Du behöver inte ställa in allt på en gång. Gör nästa lilla steg när det passar – resten kan vänta.'}
                  </p>
                </div>
                <button
                  aria-label="Dölj introduktionen"
                  className="first-week-journey__dismiss"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex items-center gap-3 mt-4">
                <Progress value={progress} className="h-1.5 flex-1" />
                <span className="text-[11px] font-medium text-muted-foreground tabular-nums shrink-0">
                  {doneCount} av {steps.length}
                </span>
              </div>
            </div>

            {nextStep && (
              <div className="first-week-journey__next mx-3 mb-3 sm:mx-4 sm:mb-4 p-4 sm:p-5">
                <div className="flex items-start gap-3.5">
                  <span className="first-week-journey__next-icon">
                    <nextStep.icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-primary/80">Nästa naturliga steg</p>
                    <h3 className="font-serif text-lg text-foreground mt-1">{nextStep.label}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">{nextStep.description}</p>
                    <button
                      type="button"
                      onClick={() => navigate(nextStep.href)}
                      className="first-week-journey__cta mt-3"
                    >
                      {nextStep.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => setShowJourney((value) => !value)}
                className="first-week-journey__toggle"
                aria-expanded={showJourney}
              >
                <span>{showJourney ? 'Dölj resan' : 'Se hela resan'}</span>
                {showJourney ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              <AnimatePresence initial={false}>
                {showJourney && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <ul className="first-week-journey__steps pt-3">
                      {steps.map((step) => {
                        const Icon = step.icon;
                        return (
                          <li key={step.key}>
                            <button
                              type="button"
                              onClick={() => !step.done && navigate(step.href)}
                              disabled={step.done}
                              className="first-week-journey__step"
                            >
                              <span className={`first-week-journey__step-icon ${step.done ? 'is-done' : ''}`}>
                                {step.done ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className={`block text-sm ${step.done ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>
                                  {step.label}
                                </span>
                              </span>
                              {step.done ? (
                                <span className="text-[11px] text-primary/70">klart</span>
                              ) : (
                                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
