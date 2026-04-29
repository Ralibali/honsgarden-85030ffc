import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Cloud, Droplets, Wind, Thermometer, CalendarDays, Lightbulb, Sparkles, TrendingUp, Egg, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

interface CacheRow {
  cache_date: string;
  city_name: string | null;
  weather_snapshot: any;
  summary: string | null;
  production_forecast: string | null;
  today_advice: string;
  week_advice: string;
  history_insight: string;
}

export default function WeatherHistoryDetail() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [row, setRow] = useState<CacheRow | null>(null);
  const [eggsThatDay, setEggsThatDay] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date || !user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('weather_advice_cache')
        .select('*')
        .eq('user_id', user.id)
        .eq('cache_date', date)
        .maybeSingle();
      setRow(data as any);

      // Hämta äggproduktion samma dag
      const { data: farmIds } = await supabase.rpc('get_user_farm_ids', { _uid: user.id });
      const ids: string[] = (farmIds ?? []).map((r: any) =>
        typeof r === 'string' ? r : r.get_user_farm_ids ?? r,
      );
      if (ids.length) {
        const { data: eggs } = await (supabase as any)
          .from('eggs')
          .select('count')
          .in('farm_id', ids)
          .eq('date', date);
        setEggsThatDay((eggs ?? []).reduce((s: number, e: any) => s + (e.count ?? 0), 0));
      }
      setLoading(false);
    })();
  }, [date, user?.id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-12 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <button
          onClick={() => navigate('/app/weather')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Tillbaka till vädersidan
        </button>
        <Card className="border-border/60">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Ingen sparad väderdata hittades för {date}.
          </CardContent>
        </Card>
      </div>
    );
  }

  const current = row.weather_snapshot?.current;
  const daily = row.weather_snapshot?.daily;
  const dateLabel = new Date(row.cache_date).toLocaleDateString('sv-SE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/app/weather')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Tillbaka till vädersidan
      </button>

      <div className="space-y-1">
        <p className="data-label">Tidigare väder</p>
        <h1 className="text-3xl font-serif gradient-text leading-tight capitalize">
          {dateLabel}
        </h1>
        {row.city_name && <p className="text-sm text-muted-foreground">{row.city_name}</p>}
      </div>

      {current && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Vid registrering</p>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl">{getIcon(current.weathercode ?? 0)}</span>
                  <span className="text-5xl font-serif tabular-nums">
                    {Math.round(current.temperature_2m ?? 0)}°
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5 text-right">
                <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  <Droplets className="h-3.5 w-3.5" /> {current.relative_humidity_2m ?? '–'}% luftfukt.
                </div>
                <div className="flex items-center justify-end gap-1.5 text-xs text-muted-foreground">
                  <Wind className="h-3.5 w-3.5" /> {current.wind_speed_10m ?? '–'} m/s vind
                </div>
              </div>
            </div>

            {eggsThatDay !== null && (
              <div className="mt-5 pt-5 border-t border-border/40 flex items-center gap-2 text-sm">
                <Egg className="h-4 w-4 text-primary" />
                <span className="text-muted-foreground">Loggade ägg den dagen:</span>
                <Badge variant="secondary">{eggsThatDay} st</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-lg">AI-råd från den dagen</h2>
          </div>
          {row.summary && (
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
              <p className="text-sm leading-relaxed font-medium">{row.summary}</p>
            </div>
          )}
          {row.production_forecast && (
            <div>
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
                <TrendingUp className="h-3 w-3" /> Produktionsprognos
              </div>
              <p className="text-sm leading-relaxed">{row.production_forecast}</p>
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
              <Thermometer className="h-3 w-3" /> För hönsen den dagen
            </div>
            <p className="text-sm leading-relaxed">{row.today_advice}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
              <CalendarDays className="h-3 w-3" /> Veckan framåt (då)
            </div>
            <p className="text-sm leading-relaxed">{row.week_advice}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-1.5">
              <Lightbulb className="h-3 w-3" /> Säsong & produktion
            </div>
            <p className="text-sm leading-relaxed">{row.history_insight}</p>
          </div>
        </CardContent>
      </Card>

      {daily?.time && (
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Cloud className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-serif text-lg">Prognos som visades då</h2>
            </div>
            <div className="space-y-1">
              {daily.time.slice(0, 10).map((d: string, i: number) => (
                <div
                  key={d}
                  className="grid grid-cols-[100px_40px_1fr_60px_60px] items-center gap-3 py-2 border-b border-border/40 last:border-0 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(d).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </span>
                  <span className="text-xl text-center">{getIcon(daily.weathercode[i])}</span>
                  <span className="text-xs text-muted-foreground">
                    {daily.precipitation_sum[i] > 0 && `${daily.precipitation_sum[i].toFixed(1)} mm`}
                    {daily.wind_speed_10m_max[i] > 8 && (
                      <span className="ml-2">💨 {Math.round(daily.wind_speed_10m_max[i])} m/s</span>
                    )}
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">
                    {Math.round(daily.temperature_2m_min[i])}°
                  </span>
                  <span className="text-right font-medium tabular-nums">
                    {Math.round(daily.temperature_2m_max[i])}°
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
