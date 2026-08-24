import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Snowflake, X, Droplet, Home, Egg as EggIcon, Wind } from 'lucide-react';

interface Props {
  /** Open-Meteo daily payload: expects `time[]` (YYYY-MM-DD) och `temperature_2m_min[]`. */
  daily?: {
    time?: string[];
    temperature_2m_min?: number[];
  };
  /** Trösklen för när frostvarning ska visas (°C). Default 2 för buffert. */
  thresholdC?: number;
}

const DISMISS_KEY = 'frost-alert-dismissed-until';

function dayLabel(dateStr: string, todayStr: string, tomorrowStr: string): string {
  if (dateStr === todayStr) return 'i natt';
  if (dateStr === tomorrowStr) return 'i morgon natt';
  const days = ['söndag', 'måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag'];
  return `natt mot ${days[new Date(dateStr).getDay()]}`;
}

export default function FrostAlertCard({ daily, thresholdC = 2 }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const until = localStorage.getItem(DISMISS_KEY);
      if (until && Number(until) > Date.now()) setDismissed(true);
    } catch {
      /* noop */
    }
  }, []);

  const alert = useMemo(() => {
    const times = daily?.time ?? [];
    const mins = daily?.temperature_2m_min ?? [];
    if (!times.length || !mins.length) return null;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 3);
    const horizonStr = horizon.toISOString().split('T')[0];

    let firstIdx = -1;
    let minTemp = Infinity;
    for (let i = 0; i < Math.min(times.length, mins.length); i++) {
      const d = times[i];
      if (d < todayStr || d > horizonStr) continue;
      if (mins[i] <= thresholdC) {
        if (firstIdx < 0) firstIdx = i;
        if (mins[i] < minTemp) minTemp = mins[i];
      }
    }
    if (firstIdx < 0) return null;

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const when = dayLabel(times[firstIdx], todayStr, tomorrowStr);
    const isFreezing = minTemp <= 0;

    return { when, minTemp, isFreezing };
  }, [daily, thresholdC]);

  if (!alert || dismissed) return null;

  const dismiss = () => {
    try {
      // Dölj i 12 timmar
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 12 * 60 * 60 * 1000));
    } catch {
      /* noop */
    }
    setDismissed(true);
  };

  const headline = alert.isFreezing
    ? `Frost väntas ${alert.when} – ner mot ${Math.round(alert.minTemp)}°C`
    : `Kylig natt väntas ${alert.when} – ner mot ${Math.round(alert.minTemp)}°C`;

  const tips = alert.isFreezing
    ? [
        { icon: Droplet, text: 'Byt till uppvärmd vattenskål eller ta in vattnet över natten.' },
        { icon: EggIcon, text: 'Samla in ägg tidigt – frusna ägg spricker och kan inte säljas.' },
        { icon: Home, text: 'Täta drag men behåll ventilation högt upp – fukt är farligare än kyla.' },
      ]
    : [
        { icon: Droplet, text: 'Kontrollera att vattnet inte fryser under natten.' },
        { icon: Wind, text: 'Stäng luckor mot vind men behåll takventilation.' },
      ];

  return (
    <Card className="border-sky-300/50 bg-gradient-to-br from-sky-50 via-blue-50/60 to-transparent dark:from-sky-950/30 dark:via-blue-950/20 shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center shrink-0">
            <Snowflake className="h-5 w-5 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-serif text-base sm:text-lg text-foreground leading-snug">
                    {headline}
                  </h3>
                  <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/20">
                    Frostvarning
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                  Så här skyddar du dina höns och ägg:
                </p>
              </div>
              <button
                onClick={dismiss}
                aria-label="Dölj frostvarning"
                className="p-1 -m-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted/60 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ul className="mt-3 space-y-1.5">
              {tips.map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-foreground/90">
                  <t.icon className="h-3.5 w-3.5 mt-0.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
