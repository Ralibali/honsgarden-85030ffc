import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import {
  ArrowRight,
  BarChart3,
  BellRing,
  Bird,
  CalendarDays,
  CloudSun,
  Egg,
  MessageCircle,
  Plus,
  ReceiptText,
  Sparkles,
  Users,
  Wheat,
} from 'lucide-react';

function formatDateLabel() {
  return new Date().toLocaleDateString('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 9) return 'God morgon';
  if (hour < 12) return 'God förmiddag';
  if (hour < 18) return 'God eftermiddag';
  return 'God kväll';
}

export default function MobileAppDashboardHero() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs(), staleTime: 60_000 });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens(), staleTime: 60_000 });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => api.getTransactions(), staleTime: 60_000 });
  const { data: feedRecords = [] } = useQuery({ queryKey: ['feed-records'], queryFn: () => api.getFeedRecords(), staleTime: 60_000 });

  const today = new Date().toISOString().split('T')[0];
  const todayEggs = useMemo(
    () => (eggs as any[]).filter((egg) => egg.date === today).reduce((sum, egg) => sum + (egg.count || 0), 0),
    [eggs, today]
  );

  const weekEggs = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return (eggs as any[])
      .filter((egg) => new Date(egg.date) >= weekAgo)
      .reduce((sum, egg) => sum + (egg.count || 0), 0);
  }, [eggs]);

  const activeHens = useMemo(() => (hens as any[]).filter((hen) => hen.is_active !== false).length, [hens]);

  const monthValue = useMemo(() => {
    const now = new Date();
    return (transactions as any[])
      .filter((transaction) => transaction.type === 'income' && new Date(transaction.date).getMonth() === now.getMonth() && new Date(transaction.date).getFullYear() === now.getFullYear())
      .reduce((sum, transaction) => sum + (transaction.amount || 0), 0);
  }, [transactions]);

  const hasFeedData = (feedRecords as any[]).length > 0;

  const metrics = [
    { label: 'Ägg idag', value: String(todayEggs), icon: Egg, hint: `${weekEggs} denna vecka`, path: '/app/eggs' },
    { label: 'Hönor', value: String(activeHens), icon: Bird, hint: 'aktiva i flocken', path: '/app/hens' },
    { label: 'Värde', value: `${Math.round(monthValue)} kr`, icon: ReceiptText, hint: 'denna månad', path: '/app/egg-sales' },
    { label: 'Foder', value: hasFeedData ? 'Aktivt' : 'Starta', icon: Wheat, hint: 'kostnad per ägg', path: '/app/feed' },
  ];

  const shortcuts = [
    { label: 'Logga ägg', icon: Plus, path: '/app/eggs', primary: true },
    { label: 'Sälj ägg', icon: ReceiptText, path: '/app/egg-sales' },
    { label: 'Rapport', icon: Sparkles, path: '/app/smart-report' },
    { label: 'Community', icon: MessageCircle, path: '/app/community' },
    { label: 'Väder', icon: CloudSun, path: '/app/weather' },
    { label: 'Kalender', icon: CalendarDays, path: '/app/calendar' },
  ];

  const firstName = user?.name?.split(' ')[0];

  return (
    <section className="max-w-5xl mx-auto">
      <Card className="relative overflow-hidden rounded-[2rem] border-primary/15 bg-gradient-to-br from-[#f7f3eb] via-card to-primary/8 shadow-sm">
        <div className="absolute right-[-5rem] top-[-5rem] h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute left-[-4rem] bottom-[-4rem] h-36 w-36 rounded-full bg-warning/10 blur-3xl" />
        <CardContent className="relative p-4 sm:p-6 lg:p-7">
          <div className="grid lg:grid-cols-[1fr_0.95fr] gap-5 lg:gap-7 items-start">
            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold mb-1">
                    {formatDateLabel()}
                  </p>
                  <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-foreground leading-tight">
                    {getGreeting()}{firstName ? `, ${firstName}` : ''} 🐔
                  </h1>
                  <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
                    Här är dagens överblick: ägg, flock, foder, försäljning, väder och nästa steg samlat på ett ställe.
                  </p>
                </div>
                <Badge className="rounded-full bg-primary/10 text-primary border-primary/20 shrink-0">
                  Dashboard
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {metrics.map((metric) => (
                  <button
                    key={metric.label}
                    type="button"
                    onClick={() => navigate(metric.path)}
                    className="rounded-2xl border border-border/60 bg-background/85 p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <metric.icon className="h-4 w-4 text-primary" />
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                    </div>
                    <p className="text-lg sm:text-xl font-bold text-foreground leading-none truncate">{metric.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{metric.label}</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{metric.hint}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-border/60 bg-background/80 p-3.5 sm:p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-serif text-base text-foreground leading-none">Snabbstart</p>
                    <p className="text-[11px] text-muted-foreground mt-1">Samma funktioner på mobil och desktop</p>
                  </div>
                </div>
                <BellRing className="h-4 w-4 text-warning" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                {shortcuts.map((shortcut) => (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => navigate(shortcut.path)}
                    className={`rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                      shortcut.primary
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card border-border/60 hover:bg-muted/40'
                    }`}
                  >
                    <shortcut.icon className={`h-4 w-4 mb-2 ${shortcut.primary ? 'text-primary-foreground' : 'text-primary'}`} />
                    <span className={`text-xs font-medium ${shortcut.primary ? 'text-primary-foreground' : 'text-foreground'}`}>
                      {shortcut.label}
                    </span>
                  </button>
                ))}
              </div>

              <Button variant="ghost" className="w-full mt-3 rounded-xl justify-between" onClick={() => navigate('/app/overview')}>
                Öppna full översikt
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
