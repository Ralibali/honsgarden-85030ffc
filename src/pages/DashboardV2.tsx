import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Egg, Bird, CalendarDays, Lightbulb, ArrowRight, BookOpen, Loader2, Plus,
  TrendingUp, Sparkles, Feather, Award, Bell, ChevronDown,
  ChevronUp, Thermometer,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { todayLocal, localCalendarDate } from '@/lib/datetime';
import { DailySummaryModal } from '@/components/DailySummaryModal';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { useAuth } from '@/hooks/useAuth';
import Achievements from '@/components/Achievements';
import ShareCard from '@/components/ShareCard';
import ReferralCard from '@/components/ReferralCard';
import OnboardingGuide, { useOnboardingVisible } from '@/components/OnboardingGuide';
import AchievementNudge from '@/components/AchievementNudge';
import TrialExpiryBanner from '@/components/TrialExpiryBanner';
import { motion } from 'framer-motion';
import { buildAchievements } from '@/components/Achievements';
import EggGoalsWidget from '@/components/EggGoalsWidget';
import DashboardAICoach from '@/components/DashboardAICoach';
import AIDeviationAlerts from '@/components/AIDeviationAlerts';
import { StreakFlame } from '@/components/StreakFlame';
import YearReportPromoCard from '@/components/dashboard/YearReportPromoCard';
import { CountUp } from '@/components/CountUp';
import FirstEggActivationCard from '@/components/FirstEggActivationCard';
import SinceLastVisitCard from '@/components/SinceLastVisitCard';
import InstallAppCard from '@/components/InstallAppCard';
import FrostAlertCard from '@/components/FrostAlertCard';
import { usePageTitle } from '@/hooks/usePageTitle';

function getGreeting() {
  const now = new Date();
  const t = now.getHours() + now.getMinutes() / 60;
  if (t < 9) return 'God morgon';
  if (t < 12) return 'God förmiddag';
  if (t < 17.5) return 'God eftermiddag';
  return 'God kväll';
}

function getFormattedDate() {
  const days = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  const months = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  const now = new Date();
  return `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
}

function getMonthName(month: number) {
  const months = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
  return months[month];
}

async function getUserCoords(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: 59.33, lon: 18.07 });
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve({ lat: 59.33, lon: 18.07 }),
      { timeout: 5000, maximumAge: 30 * 60 * 1000 }
    );
  });
}

async function fetchWeather() {
  const { lat, lon } = await getUserCoords();
  const [weatherRes, geoRes] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto&forecast_days=5`),
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=sv`).catch(() => null),
  ]);
  if (!weatherRes.ok) throw new Error('Weather fetch failed');
  const weather = await weatherRes.json();
  let cityName: string | null = null;
  if (geoRes?.ok) {
    const geo = await geoRes.json();
    cityName = geo.address?.city || geo.address?.town || geo.address?.village || geo.address?.municipality || null;
  }
  return { ...weather, cityName };
}

function getWeatherIcon(code: number) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}

function getWeatherTip(temp: number, code: number): string {
  if (temp < 0) return 'Kontrollera att vattnet inte fryser i hönshuset!';
  if (temp < 5) return 'Kallt ute – se till att hönshuset är välisolerat.';
  if (code >= 60 && code <= 67) return 'Regnigt väder – hönsen kanske stannar inne.';
  if (code >= 70 && code <= 77) return 'Snöfall – håll ingången fri.';
  if (temp > 25) return 'Varmt – extra vatten och skugga är viktigt!';
  if (temp >= 10 && temp <= 20) return 'Bra väder för dina höns idag!';
  return 'Lagom väder – bra dag för hönsen att vara ute.';
}

function getSeasonalTip(): { text: string; emoji: string } {
  const month = new Date().getMonth();
  if (month >= 2 && month <= 4) return { text: 'Vårens ökade dagsljus stimulerar värpningen – förvänta fler ägg!', emoji: '🌱' };
  if (month >= 5 && month <= 7) return { text: 'Sommarens värme kan minska aptiten. Erbjud fryst frukt som godis.', emoji: '☀️' };
  if (month >= 8 && month <= 10) return { text: 'Höstens ruggning pågår – extra protein i fodret hjälper fjädertillväxten.', emoji: '🍂' };
  return { text: 'Kort dagsljus minskar värpningen. Överväg belysning i hönshuset.', emoji: '❄️' };
}

function calculateStreak(eggs: any[]): number {
  const todayStr = todayLocal();
  const today = new Date(`${todayStr}T12:00:00`);
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = localCalendarDate(d);
    const hasEggs = eggs.some((e: any) => e.date === dateStr && e.count > 0);
    if (hasEggs) streak++;
    else if (i > 0) break;
    else continue;
  }
  return streak;
}

function getTopHen(eggs: any[], hens: any[]): { name: string; count: number } | null {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekEggs = eggs.filter((e: any) => e.hen_id && new Date(e.date) >= weekAgo);
  const henCounts: Record<string, number> = {};
  weekEggs.forEach((e: any) => { henCounts[e.hen_id] = (henCounts[e.hen_id] || 0) + e.count; });
  const topId = Object.entries(henCounts).sort(([, a], [, b]) => b - a)[0];
  if (!topId) return null;
  const hen = hens.find((h: any) => h.id === topId[0]);
  return hen ? { name: hen.name, count: topId[1] } : null;
}

function getDayName(dateStr: string): string {
  const days = ['Sön', 'Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör'];
  return days[new Date(dateStr).getDay()];
}

function getDailyTipCard(currentTemp: number | null, weatherCode: number, aiTip: any, seasonal: { text: string; emoji: string }) {
  if (currentTemp != null && (currentTemp < 0 || currentTemp > 25 || (weatherCode >= 60 && weatherCode <= 77))) {
    return { emoji: currentTemp < 0 ? '🥶' : currentTemp > 25 ? '🥵' : '🌧️', label: 'Vädervarning', text: getWeatherTip(currentTemp, weatherCode) };
  }
  if (aiTip?.tip_text) return { emoji: '✨', label: 'Dagens tips', text: aiTip.tip_text };
  return { emoji: seasonal.emoji, label: 'Säsongens tips', text: seasonal.text };
}

/** Insight accordion row — collapsed shows icon + title + 1-line preview + chevron. */
function InsightRow({
  id, icon: Icon, title, preview, badge, defaultOpen, openIds, setOpenIds, children,
}: {
  id: string;
  icon: any;
  title: string;
  preview: string;
  badge?: { label: string; tone?: 'warning' | 'primary' };
  defaultOpen?: boolean;
  openIds: Set<string>;
  setOpenIds: (s: Set<string>) => void;
  children: React.ReactNode;
}) {
  const isOpen = openIds.has(id) || (defaultOpen && !openIds.has(`__closed_${id}`));
  const toggle = () => {
    const next = new Set(openIds);
    if (isOpen) {
      next.delete(id);
      if (defaultOpen) next.add(`__closed_${id}`);
    } else {
      next.add(id);
      next.delete(`__closed_${id}`);
    }
    setOpenIds(next);
  };
  const toneBg = badge?.tone === 'warning' ? 'bg-warning/10 text-warning border-warning/20' : 'bg-primary/10 text-primary border-primary/20';

  return (
    <Collapsible open={!!isOpen} onOpenChange={toggle}>
      <CollapsibleTrigger className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-muted/40 rounded-xl transition-colors active:scale-[0.99]">
        <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{title}</p>
            {badge && (
              <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border ${toneBg}`}>
                {badge.label}
              </span>
            )}
          </div>
          {!isOpen && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{preview}</p>
          )}
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="px-1 pb-2 pt-1 animate-fade-in">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function DashboardV2() {
  usePageTitle('Dashboard');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [diaryOpen, setDiaryOpen] = useState(false);
  const [diaryText, setDiaryText] = useState('');
  const [weatherSheetOpen, setWeatherSheetOpen] = useState(false);
  const [showMoreSection, setShowMoreSection] = useState(false);
  const [tipSheetOpen, setTipSheetOpen] = useState(false);
  const [openInsights, setOpenInsights] = useState<Set<string>>(new Set());
  const now = new Date();
  const onboardingVisible = useOnboardingVisible();

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs(), staleTime: 60_000 });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens(), staleTime: 60_000 });
  const { data: healthLogs = [] } = useQuery({ queryKey: ['health-logs'], queryFn: () => api.getHealthLogs(), staleTime: 60_000 });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => api.getTransactions(), staleTime: 60_000 });
  const { data: feedRecords = [] } = useQuery({ queryKey: ['feed-records'], queryFn: () => api.getFeedRecords(), staleTime: 60_000 });
  const { data: weatherData, isLoading: weatherLoading } = useQuery({ queryKey: ['weather'], queryFn: fetchWeather, staleTime: 30 * 60 * 1000, retry: 2 });
  const { data: aiTip } = useQuery({ queryKey: ['daily-tip'], queryFn: () => api.getDailyTip(), staleTime: 60 * 60 * 1000, retry: 1 });
  const { data: chores = [] } = useQuery({ queryKey: ['daily-chores'], queryFn: () => api.getDailyChores(), staleTime: 60_000 });

  const currentTemp = weatherData?.current?.temperature_2m;
  const weatherCode = weatherData?.current?.weathercode ?? 0;

  const todayStr = now.toISOString().split('T')[0];
  const todayEggs = eggs.filter((e: any) => e.date === todayStr).reduce((s: number, e: any) => s + (e.count || 0), 0);

  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0];
  const yesterdayEggs = eggs.filter((e: any) => e.date === yesterdayStr).reduce((s: number, e: any) => s + (e.count || 0), 0);

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekEggs = eggs.filter((e: any) => new Date(e.date) >= weekAgo).reduce((s: number, e: any) => s + (e.count || 0), 0);

  // Previous week (8-14 days ago) for "mot förra"
  const twoWeeksAgo = new Date(now);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const prevWeekEggs = eggs
    .filter((e: any) => new Date(e.date) >= twoWeeksAgo && new Date(e.date) < weekAgo)
    .reduce((s: number, e: any) => s + (e.count || 0), 0);
  const weekDelta = weekEggs - prevWeekEggs;
  const eggsPerDay = weekEggs / 7;

  const activeHens = (hens as any[]).filter((h: any) => h.is_active && h.hen_type !== 'rooster').length;
  const activeRoosters = (hens as any[]).filter((h: any) => h.is_active && h.hen_type === 'rooster').length;
  const streak = calculateStreak(eggs);
  const topHen = getTopHen(eggs, hens as any[]);
  const seasonal = getSeasonalTip();

  const achievements = useMemo(
    () => buildAchievements(eggs, hens as any[], streak, feedRecords as any[], transactions as any[], chores as any[]),
    [eggs, hens, streak, feedRecords, transactions, chores]
  );

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const startOffset = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const eggCalendarData: Record<number, number> = {};
  eggs.forEach((e: any) => {
    const d = new Date(e.date);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      const day = d.getDate();
      eggCalendarData[day] = (eggCalendarData[day] || 0) + (e.count || 0);
    }
  });

  const getEggColor = (count: number) => {
    if (count === 0) return 'bg-muted/40 text-muted-foreground';
    if (count <= 2) return 'bg-primary/10 text-primary';
    if (count <= 5) return 'bg-primary/20 text-primary font-semibold';
    return 'bg-primary/30 text-primary font-bold';
  };

  const diaryMutation = useMutation({
    mutationFn: (text: string) => api.createHealthLog({ date: now.toISOString().split('T')[0], type: 'diary', description: text }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['health-logs'] }); toast({ title: '📝 Dagboksinlägg sparat!' }); setDiaryOpen(false); setDiaryText(''); },
    onError: (err: any) => toast({ title: 'Fel', description: err.message, variant: 'destructive' }),
  });

  const diaryEntries = (healthLogs as any[])
    .filter((l: any) => l.type === 'diary' && l.description)
    .slice(0, 4)
    .map((l: any) => ({
      date: new Date(l.date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }),
      text: l.description,
    }));

  const stats = [
    { value: todayEggs, label: 'Idag' },
    { value: yesterdayEggs, label: 'Igår' },
    { value: activeHens, label: 'Hönor' },
  ];

  const forecast = weatherData?.daily;

  // Adaptive nudges
  const firstEggDate = eggs.length > 0 ? new Date(Math.min(...eggs.map((e: any) => new Date(e.date).getTime()))) : null;
  const daysSinceFirstEgg = firstEggDate ? Math.floor((Date.now() - firstEggDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const hasImported = localStorage.getItem('honsgarden-imported') === '1';
  const showImportCard = !hasImported && daysSinceFirstEgg < 7;
  const hasFeedRecords = (feedRecords as any[]).length > 0;
  const hasTransactions = (transactions as any[]).length > 0;
  const feedDismissed = localStorage.getItem('dashboard-feed-nudge-dismissed') === '1';
  const financeDismissed = localStorage.getItem('dashboard-finance-nudge-dismissed') === '1';
  const showFeedNudge = !hasFeedRecords && !feedDismissed;
  const showFinanceNudge = !hasTransactions && !financeDismissed;
  const showDiary = daysSinceFirstEgg >= 7 || (healthLogs as any[]).some((l: any) => l.type === 'diary');
  const showCalendar = eggs.length > 0;

  const tipCard = getDailyTipCard(currentTemp ?? null, weatherCode, aiTip, seasonal);

  // Chores for reminders
  const upcomingChores = useMemo(() => {
    const now24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return (chores as any[]).filter((c: any) => {
      if (!c.next_due_at || c.completed) return false;
      return new Date(c.next_due_at) <= now24h;
    });
  }, [chores]);
  const pastDueChores = upcomingChores.filter((c: any) => new Date(c.next_due_at) < new Date());

  const reminderCount = upcomingChores.length;
  const hasReminders = reminderCount > 0;

  // Insights count for header
  const insightsCount = (hasReminders ? 1 : 0) + 2 + (topHen ? 1 : 0);

  return (
    <motion.div
      className="max-w-2xl mx-auto space-y-5 pb-8"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <TrialExpiryBanner />
      <OnboardingGuide />
      {!onboardingVisible && eggs.length > 0 && <DailySummaryModal />}

      {/* Greeting */}
      <div className="pt-1">
        <p className="data-label mb-1.5">{getFormattedDate()}</p>
        <h1 className="text-2xl sm:text-3xl font-serif gradient-text leading-snug">
          {getGreeting()}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
        </h1>
      </div>


      {/* Activation: get first egg logged */}
      {(hens as any[]).length > 0 && eggs.length === 0 && (
        <FirstEggActivationCard henName={(hens as any[])[0]?.name} />
      )}

      {/* Recap of activity since last visit */}
      {eggs.length > 0 && (
        <SinceLastVisitCard eggs={eggs} healthLogs={healthLogs as any[]} />
      )}

      {/* Diskret installationsprompt – visas först vid 3:e dashboardbesöket */}
      <InstallAppCard />

      {/* ─── 1. Dagens hönsgård ─── */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-serif text-lg text-foreground leading-tight">Dagens hönsgård</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">{getFormattedDate()}</p>
            </div>
            <button
              onClick={() => setWeatherSheetOpen(true)}
              className="flex items-center gap-1.5 bg-muted/40 border border-border/50 rounded-full px-3 py-1.5 shrink-0 hover:bg-muted/60 transition-colors active:scale-[0.97]"
              aria-label="Visa väder"
            >
              {weatherLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <span className="text-sm leading-none">{getWeatherIcon(weatherCode)}</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    {currentTemp != null ? `${Math.round(currentTemp)}°` : '–'}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Primary CTA */}
          <Button
            onClick={() => navigate('/app/eggs')}
            className="w-full h-12 rounded-2xl gap-2 text-base font-semibold shadow-sm"
          >
            <Plus className="h-5 w-5" />
            Logga ägg
          </Button>

          {/* 3 stat-rutor */}
          <div className="grid grid-cols-3 gap-2">
            {stats.map((s) => (
              <div key={s.label} className="rounded-xl bg-muted/40 border border-border/30 p-2.5 text-center">
                <p className="text-xl font-bold text-foreground tabular-nums leading-none">
                  <CountUp value={s.value} duration={700} />
                </p>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">{s.label}</p>
              </div>
            ))}
          </div>

          {streak > 0 && <StreakFlame streak={streak} variant="card" />}

          {currentTemp != null && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
              <Thermometer className="h-3 w-3 text-destructive/60 shrink-0" />
              <span className="truncate">{getWeatherTip(currentTemp, weatherCode)}</span>
            </p>
          )}
        </CardContent>
      </Card>

      <YearReportPromoCard />

      <FrostAlertCard daily={weatherData?.daily} />

      {/* ─── 2. Insikter (accordion) ─── */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <h2 className="font-serif text-sm text-foreground">Insikter</h2>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {insightsCount} {insightsCount === 1 ? 'insikt' : 'insikter'}
            </span>
          </div>

          <div className="space-y-1">
            {hasReminders && (
              <InsightRow
                id="reminders"
                icon={Bell}
                title="Påminnelser"
                preview={`${reminderCount} uppgift${reminderCount > 1 ? 'er' : ''} förfaller snart`}
                badge={{ label: 'Påminnelse', tone: 'warning' }}
                defaultOpen
                openIds={openInsights}
                setOpenIds={setOpenInsights}
              >
                <div className={`rounded-xl p-3 ${pastDueChores.length > 0 ? 'bg-destructive/5' : 'bg-warning/5'} border border-border/40`}>
                  <div className="space-y-1.5">
                    {upcomingChores.slice(0, 3).map((chore: any) => {
                      const isPast = new Date(chore.next_due_at) < new Date();
                      return (
                        <div key={chore.id} className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${isPast ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                            {isPast ? '⚠️ Försenad' : '📌 Idag'}
                          </span>
                          <span className="text-xs text-foreground">{chore.title}</span>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => navigate('/app/tasks')} className="text-xs text-warning hover:underline mt-2.5 font-medium">
                    Se alla uppgifter →
                  </button>
                </div>
              </InsightRow>
            )}

            <InsightRow
              id="weekly"
              icon={TrendingUp}
              title="Senaste 7 dagarna"
              preview={`${weekEggs} ägg · ${eggsPerDay.toFixed(1)}/dag${weekDelta !== 0 ? ` · ${weekDelta > 0 ? '+' : ''}${weekDelta} mot föregående 7 dagar` : ''}`}
              openIds={openInsights}
              setOpenIds={setOpenInsights}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-muted/40 border border-border/30 p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums leading-none">{weekEggs}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">7 dagar</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 border border-border/30 p-3 text-center">
                    <p className="text-lg font-bold text-foreground tabular-nums leading-none">{eggsPerDay.toFixed(1)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">Ägg/dag</p>
                  </div>
                  <div className="rounded-xl bg-muted/40 border border-border/30 p-3 text-center">
                    <p className={`text-lg font-bold tabular-nums leading-none ${weekDelta >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {weekDelta > 0 ? '+' : ''}{weekDelta}
                    </p>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1.5">Mot föregående 7</p>
                  </div>
                </div>
                <EggGoalsWidget eggs={eggs} />
              </div>
            </InsightRow>




            {topHen && (
              <InsightRow
                id="tophen"
                icon={Award}
                title="Bästa höna senaste 7 dagarna"
                preview={`${topHen.name} · ${topHen.count} ägg`}
                openIds={openInsights}
                setOpenIds={setOpenInsights}
              >
                <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 text-center">
                  <Award className="h-7 w-7 text-primary mx-auto mb-2" />
                  <p className="font-serif text-lg text-foreground">{topHen.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{topHen.count} ägg senaste 7 dagarna</p>
                </div>
              </InsightRow>
            )}

            <InsightRow
              id="advice"
              icon={Lightbulb}
              title="Råd & flockhälsa"
              preview="Hönsgården har märkt mönster i din flock"
              openIds={openInsights}
              setOpenIds={setOpenInsights}
            >
              <div className="space-y-3">
                <DashboardAICoach />
                <AIDeviationAlerts variant="card" />
              </div>
            </InsightRow>
          </div>
        </CardContent>
      </Card>

      {/* ─── 3. Dagens tips ─── */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif text-sm text-foreground">{tipCard.label}</h2>
              <p className="data-label mt-0.5">{tipCard.emoji} Dagens råd</p>
            </div>
          </div>

          <p
            className="text-sm text-foreground leading-relaxed mt-3"
            dangerouslySetInnerHTML={{ __html: tipCard.text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
          />
          {tipCard.text.length > 200 && (
            <Button variant="ghost" size="sm" onClick={() => setTipSheetOpen(true)} className="mt-2 h-8 px-2 rounded-lg text-xs text-primary">
              Läs hela tipset <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ─── 4. Kalender ─── */}
      {showCalendar && (
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/8 flex items-center justify-center">
                  <CalendarDays className="h-4 w-4 text-primary" />
                </div>
                <h2 className="font-serif text-sm text-foreground">{getMonthName(now.getMonth())}</h2>
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {Object.values(eggCalendarData).reduce((a, b) => a + b, 0)} ägg totalt
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((d, i) => (
                <div key={`${d}-${i}`} className={`text-[10px] text-center font-medium ${i >= 5 ? 'text-accent/60' : 'text-muted-foreground'}`}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const eggCount = eggCalendarData[day] || 0;
                const isToday = day === now.getDate();
                const isFuture = day > now.getDate();
                return (
                  <div
                    key={day}
                    className={`rounded-lg text-center py-1.5 text-[11px] transition-all
                      ${isFuture ? 'bg-muted/20 text-muted-foreground/25' : getEggColor(eggCount)}
                      ${isToday ? 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background shadow-sm' : ''}
                    `}
                  >
                    <span className="leading-none">{day}</span>
                    {!isFuture && eggCount > 0 && (
                      <span className="block text-[8px] leading-none opacity-70 mt-0.5">{eggCount}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── 5. Dagbok (mjuk visuell separator via mt + border-top) ─── */}
      {showDiary && (
        <div className="pt-3 mt-2 border-t border-border/40">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-accent/8 flex items-center justify-center">
                    <BookOpen className="h-4 w-4 text-accent" />
                  </div>
                  <h2 className="font-serif text-sm text-foreground">Dagbok</h2>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs text-primary hover:text-primary hover:bg-primary/8 rounded-xl gap-1.5"
                  onClick={() => setDiaryOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Skriv
                </Button>
              </div>
              {diaryEntries.length > 0 ? (
                <div className="space-y-2">
                  {diaryEntries.map((entry, i) => (
                    <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-muted/30 border border-border/30">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5 font-medium bg-muted/60 px-2 py-0.5 rounded-md">{entry.date}</span>
                      <p className="text-sm text-foreground leading-relaxed">{entry.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 card-inset rounded-xl">
                  <Feather className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2.5" />
                  <p className="text-sm text-muted-foreground font-medium">Inga inlägg ännu</p>
                  <p className="text-xs text-muted-foreground/60 mt-0.5">Skriv om vad som händer med dina höns</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* "Visa mer" – behåller alla extra-funktioner från innan */}
      <button
        onClick={() => setShowMoreSection(!showMoreSection)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors active:scale-[0.98]"
      >
        {showMoreSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {showMoreSection ? 'Visa mindre' : 'Visa mer'}
      </button>

      {showMoreSection && (
        <div className="space-y-5 animate-fade-in">
          <AchievementNudge achievements={achievements} />
          {showImportCard && (
            <Card className="border-border/50 shadow-sm card-hover cursor-pointer active:scale-[0.98] transition-transform" onClick={() => navigate('/app/import')}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <Plus className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Importera data</p>
                    <p className="text-[11px] text-muted-foreground">Läs in hönor & ägg från fil eller Google Sheets</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          )}
          {showFeedNudge && (
            <Card className="border-warning/20 bg-warning/3 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3.5">
                <span className="text-2xl shrink-0">🌾</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Spåra foderkostnader</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Vet du vad varje ägg kostar dig? Börja logga foder idag.</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="border-warning/40 text-warning hover:bg-warning/10 rounded-xl text-xs" onClick={() => navigate('/app/feed')}>
                    Prova →
                  </Button>
                  <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => localStorage.setItem('dashboard-feed-nudge-dismissed', '1')}>
                    Göm
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
          {showFinanceNudge && (
            <Card className="border-success/20 bg-success/3 shadow-sm">
              <CardContent className="p-4 flex items-center gap-3.5">
                <span className="text-2xl shrink-0">💰</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Håll koll på ekonomin</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Logga äggförsäljning och utgifter – se om hönsen går med vinst.</p>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="border-success/40 text-success hover:bg-success/10 rounded-xl text-xs" onClick={() => navigate('/app/finance')}>
                    Prova →
                  </Button>
                  <button className="text-[10px] text-muted-foreground hover:text-foreground" onClick={() => localStorage.setItem('dashboard-finance-nudge-dismissed', '1')}>
                    Göm
                  </button>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Card className="border-primary/10 cursor-pointer hover:bg-primary/4 transition-all duration-200 shadow-sm card-hover group active:scale-[0.97] transition-transform" onClick={() => navigate('/app/eggs')}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center group-hover:bg-primary/12 transition-colors shrink-0">
                  <Egg className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Ägghistorik</p>
                  <p className="text-[10px] text-muted-foreground">{todayEggs} idag</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-accent/10 cursor-pointer hover:bg-accent/4 transition-all duration-200 shadow-sm card-hover group active:scale-[0.97] transition-transform" onClick={() => navigate('/app/hens')}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-accent/8 flex items-center justify-center group-hover:bg-accent/12 transition-colors shrink-0">
                  <Bird className="h-4.5 w-4.5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">Mina hönor</p>
                  <p className="text-[10px] text-muted-foreground">{activeHens} {activeHens === 1 ? 'höna' : 'hönor'}{activeRoosters > 0 ? ` · ${activeRoosters} ${activeRoosters === 1 ? 'tupp' : 'tuppar'}` : ''}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <Achievements achievements={achievements} eggs={eggs} hens={hens as any[]} streak={streak} />
          <ShareCard
            weekEggs={weekEggs}
            totalEggs={eggs.reduce((s: number, e: any) => s + (e.count || 0), 0)}
            henCount={activeHens}
            streak={streak}
            userName={user?.name?.split(' ')[0]}
          />
          <ReferralCard />
        </div>
      )}

      {/* Weather sheet (forecast) */}
      <Sheet open={weatherSheetOpen} onOpenChange={setWeatherSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 sm:max-w-lg sm:mx-auto">
          <SheetHeader className="text-left mb-3">
            <SheetTitle className="font-serif text-xl flex items-center gap-2">
              <span className="text-2xl">{getWeatherIcon(weatherCode)}</span>
              Väder {weatherData?.cityName ? `· ${weatherData.cityName}` : ''}
            </SheetTitle>
            <SheetDescription className="text-xs">5-dagars prognos</SheetDescription>
          </SheetHeader>
          {forecast && (
            <div className="grid grid-cols-5 gap-2">
              {forecast.time?.slice(0, 5).map((date: string, i: number) => (
                <div key={date} className="text-center p-2 rounded-xl bg-muted/30 border border-border/20">
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">
                    {i === 0 ? 'Idag' : getDayName(date)}
                  </p>
                  <span className="text-lg">{getWeatherIcon(forecast.weathercode?.[i] ?? 0)}</span>
                  <p className="text-xs font-semibold text-foreground mt-1">{Math.round(forecast.temperature_2m_max?.[i])}°</p>
                  <p className="text-[10px] text-muted-foreground">{Math.round(forecast.temperature_2m_min?.[i])}°</p>
                </div>
              ))}
            </div>
          )}
          {currentTemp != null && (
            <p className="text-xs text-muted-foreground mt-4 flex items-start gap-2">
              <Thermometer className="h-3.5 w-3.5 text-destructive/60 mt-0.5 shrink-0" />
              {getWeatherTip(currentTemp, weatherCode)}
            </p>
          )}
        </SheetContent>
      </Sheet>

      {/* Daily tip sheet */}
      <Sheet open={tipSheetOpen} onOpenChange={setTipSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 sm:max-w-lg sm:mx-auto">
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="font-serif text-xl flex items-center gap-2">
              <span className="text-2xl">{tipCard.emoji}</span>
              {tipCard.label}
            </SheetTitle>
            <SheetDescription className="sr-only">Hela tipset</SheetDescription>
          </SheetHeader>
          <div
            className="text-sm text-foreground leading-relaxed pb-6"
            dangerouslySetInnerHTML={{ __html: tipCard.text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
          />
        </SheetContent>
      </Sheet>

      {/* Diary dialog */}
      <Dialog open={diaryOpen} onOpenChange={setDiaryOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg">Skriv i dagboken</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Vad hände idag med hönsen?"
              value={diaryText}
              onChange={(e) => setDiaryText(e.target.value)}
              className="min-h-[120px] resize-none rounded-xl border-border/60 focus:border-primary/40"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 rounded-xl h-10"
                disabled={!diaryText.trim() || diaryMutation.isPending}
                onClick={() => diaryText.trim() && diaryMutation.mutate(diaryText.trim())}
              >
                {diaryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Spara'}
              </Button>
              <Button variant="outline" className="rounded-xl h-10" onClick={() => setDiaryOpen(false)}>
                Avbryt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
