import { resolveWeatherLocation, type WeatherSettings } from '@/lib/weatherLocation';
import { withRequestTimeout } from '@/lib/requestTimeout';
import QueryNotice from '@/components/QueryNotice';
import { isActiveHen } from '@/lib/farmMetrics';
import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bird,
  CalendarCheck,
  ChevronRight,
  Egg,
  Sparkles,
  ThermometerSun,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { api } from '@/lib/api';
import { localCalendarDate } from '@/lib/datetime';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import QuickEggLogCard from '@/components/dashboard/QuickEggLogCard';
import HenRaceCard from '@/components/dashboard/HenRaceCard';
import OnboardingChecklistCard from '@/components/dashboard/OnboardingChecklistCard';
import StreakRescueCard from '@/components/dashboard/StreakRescueCard';
import TrialExpiryBanner from '@/components/TrialExpiryBanner';
import DiaryCard from '@/components/diary/DiaryCard';
import FarmPulseCard from '@/components/dashboard/FarmPulseCard';
import TodayChoresInline from '@/components/dashboard/TodayChoresInline';
import WeekRingCard from '@/components/dashboard/WeekRingCard';
import MonthRecapCard from '@/components/dashboard/MonthRecapCard';
import WeekInsightLine from '@/components/dashboard/WeekInsightLine';
import { computeMonthRecap, isRecapWindow } from '@/lib/monthRecap';
import { buildPremiumInsights } from '@/lib/premiumInsights';
import { hasCapability } from '@/lib/entitlements';
import { computeLogStreak, computeWeekProgress } from '@/lib/logStreak';
import { buildFarmPulse, computeMonthPace } from '@/lib/farmPulse';
import { computeFeedForecast } from '@/lib/feedForecast';
import { getSeasonalMode, trackSeasonalModeIfChanged } from '@/lib/seasonalMode';
import { fetchReminders, isOpenReminder, REMINDERS_QUERY_KEY, type ReminderLike } from '@/lib/reminderSchedule';

type WeatherSnapshot = {
  temperature: number;
  code: number;
};

function getGreeting(date: Date) {
  const hour = date.getHours();
  if (hour < 5 || hour >= 22) return 'God natt';
  if (hour < 10) return 'God morgon';
  if (hour < 12) return 'God förmiddag';
  if (hour < 17) return 'God eftermiddag';
  return 'God kväll';
}

function formatDate(date: Date) {
  const value = new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function fetchLocalWeather(settings?: WeatherSettings | null): Promise<WeatherSnapshot | null> {
  const { lat, lon } = await resolveWeatherLocation(settings);
  return withRequestTimeout(async (signal) => {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto&forecast_days=1`, { signal });
    if (!response.ok) return null;
    const json = await response.json();
    const temperature = Number(json?.current?.temperature_2m);
    const code = Number(json?.current?.weathercode ?? 0);
    return Number.isFinite(temperature) ? { temperature, code } : null;
  });
}

function weatherIcon(code: number) {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 67) return '🌧️';
  if (code <= 77) return '🌨️';
  if (code <= 82) return '🌦️';
  return '⛈️';
}

function weatherSentence(weather: WeatherSnapshot | null | undefined) {
  if (!weather) return null;
  if (weather.temperature < 0) return 'Kallt ute – kika gärna till vattnet.';
  if (weather.temperature > 25) return 'Varm dag – vatten och skugga gör gott.';
  if (weather.code >= 60 && weather.code <= 82) return 'Blött ute – flocken kanske tar det lugnare idag.';
  return 'En helt vanlig dag att pyssla om flocken.';
}

function agdaSentence({
  activeHens,
  todayEggs,
  weekEggs,
  previousWeekEggs,
  pendingChores,
}: {
  activeHens: number;
  todayEggs: number;
  weekEggs: number;
  previousWeekEggs: number;
  pendingChores: number;
}) {
  if (activeHens === 0) {
    return 'När du lagt in dina första hönor kan jag börja lära känna flockens rytm tillsammans med dig.';
  }
  if (todayEggs === 0) {
    return pendingChores > 0
      ? `Inga ägg är loggade ännu idag. Du har också ${pendingChores} ${pendingChores === 1 ? 'syssla' : 'sysslor'} kvar på gården.`
      : 'Inga ägg är loggade ännu idag. Det kan vara en helt vanlig lugn morgon i redena.';
  }
  if (previousWeekEggs > 0 && weekEggs > previousWeekEggs) {
    return `Flocken ligger över förra veckans takt just nu. Fortsätt logga som vanligt så ser vi om trenden håller i sig.`;
  }
  if (previousWeekEggs > 0 && weekEggs < previousWeekEggs) {
    return `Värpningen ligger lite lugnare än förra veckan. Det behöver inte betyda något – årstid, väder och ruggning spelar ofta in.`;
  }
  return `${todayEggs} ägg idag. Jag håller koll på mönstret medan du tar hand om hönsen.`;
}

export default function DashboardV3({ demo = false }: { demo?: boolean }) {
  usePageTitle('Idag');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  const { data: eggs = [], isPending: eggsLoading, isError: eggsError, refetch: reloadEggs } = useQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs(),
  });
  const { data: hens = [], isPending: hensLoading, isError: hensError, refetch: reloadHens } = useQuery({
    queryKey: ['hens'],
    queryFn: () => api.getHens(),
  });
  const { data: chores = [] } = useQuery({
    queryKey: ['daily-chores'],
    queryFn: () => api.getDailyChores(),
  });
  const { data: feedRecords = [] } = useQuery({
    queryKey: ['feed-records'],
    queryFn: () => api.getFeedRecords(),
  });
  const { data: hatchings = [] } = useQuery({
    queryKey: ['hatchings'],
    queryFn: () => api.getHatchings(),
    staleTime: 60_000,
  });
  const { data: reminders = [] } = useQuery({
    queryKey: REMINDERS_QUERY_KEY,
    queryFn: () => fetchReminders<ReminderLike>(),
    enabled: !demo,
    staleTime: 60_000,
  });
  const settingsQuery = useQuery({ queryKey: ['coop-settings'], queryFn: () => api.getCoopSettings(), enabled: !demo });
  const { data: weather, isLoading: weatherLoading } = useQuery({
    queryKey: ['dashboard-local-weather', user?.id, settingsQuery.data?.city, settingsQuery.data?.postal_code],
    queryFn: () => fetchLocalWeather(settingsQuery.data),
    enabled: !demo && settingsQuery.isSuccess,
    staleTime: 20 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const firstName = useMemo(() => {
    const name = user?.name || user?.email?.split('@')[0] || '';
    return String(name).trim().split(/\s+/)[0] || '';
  }, [user]);

  const todayKey = localCalendarDate(now, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localCalendarDate(yesterday, Intl.DateTimeFormat().resolvedOptions().timeZone);

  const todayRows = eggs.filter((egg) => egg.date === todayKey).map((egg) => egg.id);
  const todayEggs = eggs
    .filter((egg) => egg.date === todayKey)
    .reduce((sum, egg) => sum + (egg.count || 0), 0);
  const yesterdayEggs = eggs
    .filter((egg) => egg.date === yesterdayKey)
    .reduce((sum, egg) => sum + (egg.count || 0), 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  const previousWeekStart = new Date(now);
  previousWeekStart.setDate(previousWeekStart.getDate() - 13);
  const previousWeekEnd = new Date(now);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);

  const weekStartKey = localCalendarDate(weekStart, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const previousWeekStartKey = localCalendarDate(previousWeekStart, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const previousWeekEndKey = localCalendarDate(previousWeekEnd, Intl.DateTimeFormat().resolvedOptions().timeZone);

  const weekEggs = eggs
    .filter((egg) => egg.date >= weekStartKey && egg.date <= todayKey)
    .reduce((sum, egg) => sum + (egg.count || 0), 0);
  const previousWeekEggs = eggs
    .filter((egg) => egg.date >= previousWeekStartKey && egg.date <= previousWeekEndKey)
    .reduce((sum, egg) => sum + (egg.count || 0), 0);
  const weekDelta = weekEggs - previousWeekEggs;

  const activeHens = hens.filter(isActiveHen).length;
  const pendingChores = chores.filter((chore: any) => !chore.completed).length;
  const streakInfo = useMemo(() => computeLogStreak(eggs, todayKey), [eggs, todayKey]);
  const streak = streakInfo.current;
  const loggedToday = streakInfo.loggedToday;
  const weekProgress = useMemo(() => computeWeekProgress(eggs, todayKey), [eggs, todayKey]);
  const showStreakRescue = hens.length > 0 && eggs.length > 0 && streak > 0 && !loggedToday;
  const weatherText = weatherSentence(weather);
  const season = getSeasonalMode(now);
  const feedForecast = useMemo(() => computeFeedForecast(feedRecords, eggs, todayKey), [feedRecords, eggs, todayKey]);
  const openReminders = useMemo(() => reminders.filter((r) => isOpenReminder(r.status)), [reminders]);
  const pulseItems = useMemo(() => buildFarmPulse({
    todayIso: todayKey,
    season,
    reminders: openReminders,
    feed: feedForecast,
    hatchings,
    eggs,
  }), [todayKey, season, openReminders, feedForecast, hatchings, eggs]);
  const monthPace = useMemo(() => computeMonthPace(eggs, todayKey), [eggs, todayKey]);
  const isPlusUser = user?.subscription_status === 'premium';
  const canSeeInsights = isPlusUser || hasCapability(user?.premium_type ?? null, 'advanced_analytics');
  const canDownloadReports = isPlusUser || hasCapability(user?.premium_type ?? null, 'reports');
  // Insikterna räknas för alla: Plus ser dem, gratis ser vilken sorts insikt som väntar.
  const weekInsights = useMemo(
    () => buildPremiumInsights(eggs, hens, feedRecords.map((f) => ({ date: f.date, cost_sek: f.cost })), todayKey),
    [eggs, hens, feedRecords, todayKey],
  );
  const monthRecap = useMemo(
    () => (isRecapWindow(todayKey) ? computeMonthRecap(eggs, hens, todayKey) : null),
    [eggs, hens, todayKey],
  );
  const seasonKey = `${season}-${season === 'winter' && now.getMonth() <= 2 ? now.getFullYear() - 1 : now.getFullYear()}`;

  useEffect(() => {
    if (!demo) trackSeasonalModeIfChanged(season);
  }, [demo, season]);
  const agdaText = agdaSentence({
    activeHens,
    todayEggs,
    weekEggs,
    previousWeekEggs,
    pendingChores,
  });

  if (eggsError || hensError) return <QueryNotice title="Kunde inte läsa dagens översikt" onRetry={() => { void reloadEggs(); void reloadHens(); }} />;
  if (eggsLoading || hensLoading) return <QueryNotice loading title="Hämtar din hönsgård…" />;

  return (
    <div className="today-v3 max-w-2xl mx-auto pb-8" aria-labelledby="today-heading">
      <TrialExpiryBanner />

      <section className="today-v3__hero hg-today-hero" aria-label="Min hönsgård idag">
        <div className="today-v3__hero-stars" aria-hidden="true" />
        <div className="today-v3__hero-meteor" aria-hidden="true" />
        <div className="today-v3__hero-copy">
          <p className="today-v3__date data-label">{formatDate(now)}</p>
          <h1 id="today-heading">
            {getGreeting(now)}{firstName ? `, ${firstName}` : ''}!
          </h1>
          <p className="today-v3__hero-status">
            {activeHens === 0
              ? 'Här börjar din hönsgård.'
              : todayEggs > 0
                ? `${todayEggs} ägg loggade idag · ${activeHens} aktiva hönor`
                : `${activeHens} aktiva hönor · dagen är fortfarande din`}
          </p>
        </div>
        {(weather || weatherLoading) && (
          <div className="today-v3__weather" aria-label="Vädret just nu">
            <span aria-hidden="true">{weather ? weatherIcon(weather.code) : '…'}</span>
            <strong>{weather ? `${Math.round(weather.temperature)}°` : '–'}</strong>
          </div>
        )}
      </section>

      <section className="today-v3__egg" aria-label="Logga dagens ägg">
        <QuickEggLogCard todayEggs={todayEggs} todayEggRowIds={todayRows} loggedToday={loggedToday} allowZeroDay={activeHens > 0} />
      </section>

      <FarmPulseCard items={pulseItems} reminders={openReminders} seasonKey={seasonKey} />

      {weekProgress && activeHens > 0 && eggs.length > 0 && (
        <WeekRingCard week={weekProgress} streak={streak} winter={season === 'winter'} demo={demo} />
      )}

      {monthRecap && (
        <MonthRecapCard recap={monthRecap} eggs={eggs} hens={hens} isPlus={canDownloadReports} demo={demo} />
      )}

      <section className="today-v3__adaptive" aria-label="Kom igång">
        <OnboardingChecklistCard hensCount={hens.length} eggsCount={eggs.length} feedRecordsCount={feedRecords.length} />
      </section>

      {showStreakRescue && (
        <section className="today-v3__adaptive" aria-label="Dagens loggserie">
          <StreakRescueCard streak={streak} todayEggs={todayEggs} loggedToday={loggedToday} />
        </section>
      )}

      <section className="today-v3__journal" aria-labelledby="farm-today-heading">
        <div className="today-v3__section-heading">
          <div><p className="today-v3__eyebrow">Precis nu</p><h2 id="farm-today-heading">Dagens gård</h2></div>
          <button type="button" onClick={() => navigate('/app/tasks')}>Gården <ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="today-v3__journal-lines">
          <button type="button" className="today-v3__journal-line" onClick={() => navigate('/app/eggs')}>
            <span className="today-v3__line-icon"><Egg className="h-5 w-5" /></span>
            <span className="today-v3__line-copy"><strong>{todayEggs} ägg idag</strong><small>{yesterdayEggs === todayEggs ? 'Samma som igår hittills' : `${yesterdayEggs} loggades igår`}</small></span>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="today-v3__journal-line" onClick={() => navigate('/app/hens')}>
            <span className="today-v3__line-icon"><Bird className="h-5 w-5" /></span>
            <span className="today-v3__line-copy"><strong>{activeHens} aktiva hönor</strong><small>{activeHens > 0 ? 'Flocken finns samlad på ett ställe' : 'Lägg till din första höna'}</small></span>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" className="today-v3__journal-line" onClick={() => navigate('/app/tasks')}>
            <span className="today-v3__line-icon"><CalendarCheck className="h-5 w-5" /></span>
            <span className="today-v3__line-copy"><strong>{pendingChores === 0 ? 'Inga måsten just nu' : `${pendingChores} ${pendingChores === 1 ? 'syssla' : 'sysslor'} kvar`}</strong><small>{pendingChores === 0 ? 'Gården ser lugn ut' : 'Bocka av när du är färdig'}</small></span>
            <ChevronRight className="h-4 w-4" />
          </button>
          {(weatherText || weatherLoading) && (
            <div className="today-v3__journal-line is-static">
              <span className="today-v3__line-icon"><ThermometerSun className="h-5 w-5" /></span>
              <span className="today-v3__line-copy"><strong>{weather ? `${weatherIcon(weather.code)} ${Math.round(weather.temperature)}° ute` : 'Kollar vädret…'}</strong><small>{weatherText ?? 'En liten stund bara'}</small></span>
            </div>
          )}
        </div>
        <TodayChoresInline chores={chores} />
      </section>

      <DiaryCard demo={demo} />

      <section className="today-v3__agda" aria-labelledby="agda-heading">
        <div className="today-v3__agda-mark" aria-hidden="true">A</div>
        <div className="today-v3__agda-copy"><p className="today-v3__eyebrow">Agda har kikat på gården</p><h2 id="agda-heading">“{agdaText}”</h2><button type="button" onClick={() => navigate('/app/agda')}>Fråga Agda <ChevronRight className="h-4 w-4" /></button></div>
        <Sparkles className="today-v3__agda-sparkle" aria-hidden="true" />
      </section>

      {eggs.length > 0 && (
        <section className="today-v3__week" aria-labelledby="week-heading">
          <div className="today-v3__section-heading">
            <div><p className="today-v3__eyebrow">Senaste sju dagarna</p><h2 id="week-heading">Flockens vecka</h2></div>
            <button type="button" onClick={() => navigate('/app/statistics')}>Insikter <ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="today-v3__week-story">
            <div><strong>{weekEggs}</strong><span>ägg på sju dagar</span></div>
            <p className={weekDelta > 0 ? 'is-up' : weekDelta < 0 ? 'is-down' : ''}>
              {previousWeekEggs === 0 ? <>Fortsätt logga så börjar vi snart kunna jämföra veckorna.</> : weekDelta > 0 ? <><TrendingUp className="h-4 w-4" /> {weekDelta} fler än perioden innan</> : weekDelta < 0 ? <><TrendingDown className="h-4 w-4" /> {Math.abs(weekDelta)} färre än perioden innan</> : <>Precis samma nivå som perioden innan.</>}
            </p>
          </div>
          {monthPace && monthPace.soFar > 0 && (
            <p className="mt-3 flex items-center gap-2 px-1 text-sm text-muted-foreground" data-testid="month-pace">
              <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <strong className="font-semibold text-foreground">{monthPace.monthLabel.charAt(0).toUpperCase() + monthPace.monthLabel.slice(1)}: {monthPace.soFar} ägg hittills</strong>
                {monthPace.projected !== null && monthPace.projected > monthPace.soFar ? ` · takten pekar mot ca ${monthPace.projected}` : ''}
              </span>
            </p>
          )}
          <WeekInsightLine insights={weekInsights} isPlus={canSeeInsights} demo={demo} />
        </section>
      )}

      <section className="today-v3__race" aria-label="Veckans värptävling"><HenRaceCard eggs={eggs} hens={hens} /></section>

      <footer className="today-v3__footer-note"><span aria-hidden="true">🌿</span><p>Du behöver inte hålla koll på allt. Logga det som hjälper dig – Hönsgården tar hand om resten.</p></footer>
    </div>
  );
}
