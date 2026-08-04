import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ArrowLeft, Cloud, Crown, Loader2, RefreshCw, Sparkles, Thermometer, Wind, Droplets, CalendarDays, Lightbulb, TrendingUp, Egg, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import WeatherAlertSettings from '@/components/WeatherAlertSettings';
import WeatherImpactCard from '@/components/WeatherImpactCard';
import { reverseGeocodeCity } from '@/lib/reverseGeocode';

const WEATHER_ICONS: Record<string, string> = {
  '0': '☀️', '1': '🌤️', '2': '⛅', '3': '☁️',
  '45': '🌫️', '48': '🌫️',
  '51': '🌦️', '53': '🌦️', '55': '🌦️',
  '61': '🌧️', '63': '🌧️', '65': '🌧️',
  '71': '🌨️', '73': '🌨️', '75': '❄️',
  '80': '🌧️', '81': '🌧️', '82': '⛈️',
  '95': '⛈️', '96': '⛈️', '99': '⛈️',
};

function getIcon(code: number) {
  return WEATHER_ICONS[String(code)] ?? '🌤️';
}

function getCoords(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({ lat: 59.33, lon: 18.07 });
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve({ lat: 59.33, lon: 18.07 }),
      { timeout: 5000, maximumAge: 10 * 60 * 1000 },
    );
  });
}

async function fetchWeatherFull() {
  const { lat, lon } = await getCoords();
  const [wRes, city] = await Promise.all([
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=10`,
    ),
    reverseGeocodeCity(lat, lon),
  ]);
  if (!wRes.ok) throw new Error('Väderhämtning misslyckades');
  const weather = await wRes.json();
  return { lat, lon, city, weather, fetchedAt: new Date().toISOString() };
}

function dayName(dateStr: string, idx: number) {
  if (idx === 0) return 'Idag';
  if (idx === 1) return 'Imorgon';
  return new Date(dateStr).toLocaleDateString('sv-SE', { weekday: 'short' });
}

function updatedLabel(value?: string) {
  if (!value) return 'nyligen';
  return new Date(value).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function localAdviceFromSnapshot(current: any, daily: any) {
  const temp = Math.round(Number(current?.temperature_2m ?? 0));
  const wind = Number(current?.wind_speed_10m ?? 0);
  const humidity = Number(current?.relative_humidity_2m ?? 0);
  const maxWind = Math.max(...((daily?.wind_speed_10m_max ?? []) as number[]).slice(0, 7).map(Number));
  const maxTemp = Math.max(...((daily?.temperature_2m_max ?? []) as number[]).slice(0, 7).map(Number));
  const minTemp = Math.min(...((daily?.temperature_2m_min ?? []) as number[]).slice(0, 7).map(Number));

  const today: string[] = [];
  if (wind >= 8) today.push('Ge hönsen vindskydd ute och kontrollera att dörrar, nät och lösa saker sitter ordentligt.');
  if (temp <= 0) today.push('Kontrollera vattnet extra noga så att det inte fryser.');
  if (temp >= 25) today.push('Se till att det finns skugga och friskt vatten flera gånger under dagen.');
  if (humidity >= 75) today.push('Känn efter att ströet är torrt, särskilt i reden och nära ingången.');
  if (today.length === 0) today.push(`Vädret ser ganska lugnt ut just nu med ${temp}°, ${wind.toFixed(1).replace('.', ',')} m/s vind och ${Math.round(humidity)}% luftfuktighet. Vanlig tillsyn räcker bra.`);

  const week: string[] = [];
  if (maxWind >= 15) week.push(`Det kan bli kraftiga vindar upp mot ${Math.round(maxWind)} m/s. Säkra lösa föremål i utegården.`);
  if (maxTemp >= 25) week.push(`Veckan kan bli varm, upp mot ${Math.round(maxTemp)}°. Planera för extra vatten och skugga.`);
  if (minTemp <= 0) week.push(`Det finns risk för kalla nätter ned mot ${Math.round(minTemp)}°. Kontrollera vatten och drag i hönshuset.`);
  if (week.length === 0) week.push('Kommande vecka ser relativt jämn ut. Fortsätt följa vatten, foder och strö som vanligt.');

  return { today: today.join(' '), week: week.join(' ') };
}

export default function Weather() {
  usePageTitle('Väder & råd');
  const navigate = useNavigate();
  const { user } = useAuth();
  const [advice, setAdvice] = useState<{
    summary?: string;
    production_forecast?: string;
    today_advice: string;
    week_advice: string;
    history_insight: string;
    cached?: boolean;
    snapshot_time?: string;
  } | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);

  const isPremium = user?.subscription_status === 'premium';

  const { data: w, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['weather-full'],
    queryFn: fetchWeatherFull,
    staleTime: 10 * 60 * 1000,
    enabled: !!isPremium,
  });

  const { data: history } = useQuery({
    queryKey: ['weather-history', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('weather_advice_cache')
        .select('cache_date, city_name, weather_snapshot, summary')
        .eq('user_id', user!.id)
        .order('cache_date', { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !!user?.id && !!isPremium,
  });

  async function loadAdvice(force = false) {
    if (!w) return;
    setAdviceLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('weather-advice', {
        body: {
          latitude: w.lat,
          longitude: w.lon,
          city_name: w.city,
          force,
          weather_snapshot: w.weather,
          fetched_at: w.fetchedAt,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAdvice({ ...(data as any), snapshot_time: w.fetchedAt });
      if (force) toast.success('AI-råd uppdaterade');
    } catch (e: any) {
      const fallback = localAdviceFromSnapshot(w.weather?.current, w.weather?.daily);
      setAdvice({
        summary: 'Agda använder den senaste väderbilden som visas här på sidan.',
        today_advice: fallback.today,
        week_advice: fallback.week,
        history_insight: 'Fortsätt jämföra väder, äggproduktion och flockens beteende över tid för att se tydligare mönster.',
        cached: false,
        snapshot_time: w.fetchedAt,
      });
      toast.error(e?.message ?? 'Kunde inte hämta AI-råd, visar lokalt väderbaserat råd.');
    } finally {
      setAdviceLoading(false);
    }
  }

  useEffect(() => {
    if (w && isPremium) loadAdvice(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.fetchedAt, isPremium]);

  if (!isPremium) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4" /> Tillbaka</button>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-8 text-center space-y-4">
            <Crown className="h-12 w-12 text-warning mx-auto" />
            <h1 className="text-2xl font-serif">Väder & AI-råd är en Plus-funktion</h1>
            <p className="text-sm text-muted-foreground">Få 10-dagars prognos, personliga AI-råd för dina höns baserat på vädret idag, och säsongstips inför kommande vecka.</p>
            <Button asChild className="rounded-2xl"><Link to="/app/premium">Uppgradera till Plus</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = w?.weather?.current;
  const daily = w?.weather?.daily;
  const snapshotAdvice = w ? localAdviceFromSnapshot(current, daily) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-5 sm:space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="h-4 w-4" /> Tillbaka</button>

      <div className="space-y-1">
        <p className="data-label">Väder & säsongsråd</p>
        <h1 className="text-2xl sm:text-3xl font-serif gradient-text leading-tight">Vädret för din hönsgård</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {w?.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {w.city}</span>}
          {w && <span>Uppdaterat {updatedLabel(w.fetchedAt)}</span>}
        </div>
      </div>

      {isLoading || !w ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardContent className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Just nu</p>
                  <div className="flex items-baseline gap-3"><span className="text-5xl">{getIcon(current?.weathercode ?? 0)}</span><span className="text-5xl font-serif tabular-nums">{Math.round(current?.temperature_2m ?? 0)}°</span></div>
                </div>
                <div className="grid grid-cols-1 gap-1.5 text-right">
                  <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground"><Droplets className="h-3.5 w-3.5" />{current?.relative_humidity_2m ?? '–'}% luftfukt.</div>
                  <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground"><Wind className="h-3.5 w-3.5" />{current?.wind_speed_10m ?? '–'} m/s vind</div>
                  <Button variant="ghost" size="sm" className="h-8 mt-1 rounded-xl text-xs" disabled={isFetching || adviceLoading} onClick={async () => { const result = await refetch(); if (result.data) toast.success('Väder uppdaterat'); }}>
                    {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />} Uppdatera
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h2 className="font-serif text-lg">AI-råd från Agda</h2>{advice?.cached && <Badge variant="secondary" className="text-[10px]">Dagens råd</Badge>}</div>
                  <p className="text-[11px] text-muted-foreground mt-1">Rådet bygger på vädret som visas ovan. Råd uppdaterat {updatedLabel(advice?.snapshot_time || w.fetchedAt)}.</p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 shrink-0" disabled={adviceLoading} onClick={() => loadAdvice(true)}>{adviceLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Råd</Button>
              </div>

              {adviceLoading && !advice ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="h-4 w-4 animate-spin" />Agda analyserar vädret...</div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                    <p className="text-sm leading-relaxed text-foreground font-medium">{advice?.summary || `Just nu: ${Math.round(current?.temperature_2m ?? 0)}°, ${current?.wind_speed_10m ?? '–'} m/s vind och ${current?.relative_humidity_2m ?? '–'}% luftfuktighet.`}</p>
                  </div>
                  {advice?.production_forecast && <div><div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-1.5"><TrendingUp className="h-3 w-3" /> Produktionsprognos kommande vecka</div><p className="text-sm leading-relaxed text-foreground flex gap-2"><Egg className="h-4 w-4 text-primary shrink-0 mt-0.5" /><span>{advice.production_forecast}</span></p></div>}
                  <div><div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-1.5"><Thermometer className="h-3 w-3" /> För dina höns idag</div><p className="text-sm leading-relaxed text-foreground">{advice?.today_advice || snapshotAdvice?.today}</p></div>
                  <div><div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-1.5"><CalendarDays className="h-3 w-3" /> Kommande veckan</div><p className="text-sm leading-relaxed text-foreground">{advice?.week_advice || snapshotAdvice?.week}</p></div>
                  <div><div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-1.5"><Lightbulb className="h-3 w-3" /> Säsong & produktion</div><p className="text-sm leading-relaxed text-foreground">{advice?.history_insight || 'Följ äggproduktionen tillsammans med väder och foder över tid för att hitta mönster i din egen flock.'}</p></div>
                </div>
              )}
            </CardContent>
          </Card>

          <WeatherImpactCard daily={daily} latitude={w.lat} longitude={w.lon} />

          <Card className="border-border/60 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-2 mb-4"><div className="flex items-center gap-2"><Cloud className="h-4 w-4 text-muted-foreground" /><h2 className="font-serif text-lg">10-dagars prognos</h2></div><span className="text-[11px] text-muted-foreground">Senast {updatedLabel(w.fetchedAt)}</span></div>
              <div className="space-y-1">
                {daily?.time?.slice(0, 10).map((d: string, i: number) => (
                  <div key={d} className="grid grid-cols-[70px_36px_1fr_48px_48px] sm:grid-cols-[80px_40px_1fr_60px_60px] items-center gap-2 sm:gap-3 py-2 border-b border-border/40 last:border-0 text-sm">
                    <span className="text-muted-foreground capitalize">{dayName(d, i)}</span><span className="text-xl text-center">{getIcon(daily.weathercode[i])}</span><span className="text-xs text-muted-foreground truncate">{daily.precipitation_sum[i] > 0 && `${daily.precipitation_sum[i].toFixed(1)} mm`}{daily.wind_speed_10m_max[i] > 8 && <span className="ml-2">💨 {Math.round(daily.wind_speed_10m_max[i])} m/s</span>}</span><span className="text-right text-muted-foreground tabular-nums">{Math.round(daily.temperature_2m_min[i])}°</span><span className="text-right font-medium tabular-nums">{Math.round(daily.temperature_2m_max[i])}°</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {history && history.length > 0 && <Card className="border-border/60 shadow-sm"><CardContent className="p-5"><div className="flex items-center gap-2 mb-4"><CalendarDays className="h-4 w-4 text-muted-foreground" /><h2 className="font-serif text-lg">Tidigare väder & råd</h2></div><div className="divide-y divide-border/40">{history.map((h: any) => { const snap = h.weather_snapshot ?? {}; const cur = snap.current ?? {}; const code = cur.weathercode ?? 0; const temp = cur.temperature_2m; return <Link key={h.cache_date} to={`/app/weather/history/${h.cache_date}`} className="flex items-center gap-3 py-3 hover:bg-muted/40 -mx-2 px-2 rounded-lg transition-colors"><span className="text-2xl shrink-0">{getIcon(code)}</span><div className="flex-1 min-w-0"><p className="text-sm font-medium capitalize">{new Date(h.cache_date).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'long' })}</p>{h.summary && <p className="text-xs text-muted-foreground line-clamp-1">{h.summary}</p>}{!h.summary && h.city_name && <p className="text-xs text-muted-foreground">{h.city_name}</p>}</div>{typeof temp === 'number' && <span className="text-sm font-medium tabular-nums shrink-0">{Math.round(temp)}°</span>}<ArrowLeft className="h-3.5 w-3.5 text-muted-foreground rotate-180 shrink-0" /></Link>; })}</div></CardContent></Card>}

          <WeatherAlertSettings latitude={w.lat} longitude={w.lon} cityName={w.city} />
          <p className="text-[10px] text-muted-foreground text-center">Väderdata från Open-Meteo • Råd ska alltid dubbelkollas med verkligheten i din hönsgård</p>
        </>
      )}
    </div>
  );
}
