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
import { api, type EggLog } from '@/lib/api';
import { localCalendarDate } from '@/lib/datetime';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import QuickEggLogCard from '@/components/dashboard/QuickEggLogCard';
import HenRaceCard from '@/components/dashboard/HenRaceCard';
import OnboardingChecklistCard from '@/components/dashboard/OnboardingChecklistCard';
import StreakRescueCard from '@/components/dashboard/StreakRescueCard';
import TrialExpiryBanner from '@/components/TrialExpiryBanner';

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

function calculateStreak(eggs: EggLog[], now: Date) {
  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dateKey = localCalendarDate(date);
    const hasEggs = eggs.some((egg) => egg.date === dateKey && (egg.count || 0) > 0);
    if (hasEggs) streak += 1;
    else if (i > 0) break;
  }
  return streak;
}

async function fetchLocalWeather(): Promise<WeatherSnapshot | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      () => resolve(null),
      { timeout: 3000, maximumAge: 30 * 60 * 1000 },
    );
  });

  if (!position) return null;

  const { latitude, longitude } = position.coords;
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weathercode&timezone=auto&forecast_days=1`,
  );
  if (!response.ok) return null;

  const json = await response.json();
  const temperature = Number(json?.current?.temperature_2m);
  const code = Number(json?.current?.weathercode ?? 0);
  if (!Number.isFinite(temperature)) return null;
  return { temperature, code };
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
      ? `Inga ägg är loggade ännu idag. Du har också ${pendingChores} syssla${pendingChores === 1 ? '' : 'r'} kvar på gården.`
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

export default function DashboardV3() {
  usePageTitle('Idag');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());

  const { data: eggs = [] } = useQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs(),
  });
  const { data: hens = [] } = useQuery({
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
  const { data: weather, isLoading: weatherLoading } = useQuery({
    queryKey: ['dashboard-local-weather'],
    queryFn: fetchLocalWeather,
    staleTime: 20 * 60 * 1000,
    retry: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const firstName = useMemo(() => {
    const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || '';
    return String(name).trim().split(/\s+/)[0] || '';
  }, [user]);

  const todayKey = localCalendarDate(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localCalendarDate(yesterday);

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

  const weekStartKey = localCalendarDate(weekStart);
  const previousWeekStartKey = localCalendarDate(previousWeekStart);
  const previousWeekEndKey = localCalendarDate(previousWeekEnd);

  const weekEggs = eggs
    .filter((egg) => egg.date >= weekStartKey && egg.date <= todayKey)
    .reduce((sum, egg) => sum + (egg.count || 0), 0);
  const previousWeekEggs = eggs
    .filter((egg) => egg.date >= previousWeekStartKey && egg.date <= previousWeekEndKey)
    .reduce((sum, egg) => sum + (egg.count || 0), 0);
  const weekDelta = weekEggs - previousWeekEggs;

  const activeHens = hens.filter((hen) => hen.is_active && hen.hen_type !== 'rooster').length;
  const pendingChores = chores.filter((chore: any) => !chore.completed).length;
  const streak = calculateStreak(eggs, now);
  const showOnboarding = hens.length === 0 || eggs.length === 0;
  const showStreakRescue = !showOnboarding && streak > 0 && todayEggs === 0;
  const weatherText = weatherSentence(weather);
  const agdaText = agdaSentence({
    activeHens,
    todayEggs,
    weekEggs,
    previousWeekEggs,
    pendingChores,
  });

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
        <QuickEggLogCard todayEggs={todayEggs} todayEggRowIds={todayRows} />
      </section>

      {showOnboarding && (
        <section className="today-v3__adaptive" aria-label="Kom igång">
          <OnboardingChecklistCard hensCount={hens.length} eggsCount={eggs.length} feedRecordsCount={feedRecords.length} />
        </section>
      )}

      {showStreakRescue && (
        <section className="today-v3__adaptive" aria-label="Dagens loggserie">
          <StreakRescueCard streak={streak} todayEggs={todayEggs} />
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
            <span className="today-v3__line-copy"><strong>{pendingChores === 0 ? 'Inga måsten just nu' : `${pendingChores} syssla${pendingChores === 1 ? '' : 'r'} kvar`}</strong><small>{pendingChores === 0 ? 'Gården ser lugn ut' : 'Bocka av när du är färdig'}</small></span>
            <ChevronRight className="h-4 w-4" />
          </button>
          {(weatherText || weatherLoading) && (
            <div className="today-v3__journal-line is-static">
              <span className="today-v3__line-icon"><ThermometerSun className="h-5 w-5" /></span>
              <span className="today-v3__line-copy"><strong>{weather ? `${weatherIcon(weather.code)} ${Math.round(weather.temperature)}° ute` : 'Kollar vädret…'}</strong><small>{weatherText ?? 'En liten stund bara'}</small></span>
            </div>
          )}
        </div>
      </section>

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
        </section>
      )}

      <section className="today-v3__race" aria-label="Veckans värptävling"><HenRaceCard eggs={eggs} hens={hens} /></section>

      <footer className="today-v3__footer-note"><span aria-hidden="true">🌿</span><p>Du behöver inte hålla koll på allt. Logga det som hjälper dig – Hönsgården tar hand om resten.</p></footer>
    </div>
  );
}
