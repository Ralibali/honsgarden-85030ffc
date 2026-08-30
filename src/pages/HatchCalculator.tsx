import React, { useMemo, useRef, useState } from 'react';
import PublicToolPage from '@/components/tools/PublicToolPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, Egg, Check } from 'lucide-react';
import {
  computeHatchPlan,
  daysUntilHatch,
  formatSvDate,
  toIsoDate,
} from '@/lib/tools/hatchCalculator';
import { trackEvent } from '@/lib/analytics';

function todayIso(): string {
  const now = new Date();
  return toIsoDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12)));
}

export default function HatchCalculator() {
  const [startDate, setStartDate] = useState(todayIso());
  const [submitted, setSubmitted] = useState(false);
  const lastTracked = useRef<string>('');

  const plan = useMemo(
    () => (submitted ? computeHatchPlan(startDate) : null),
    [submitted, startDate],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    // En träff per unikt datumval — ingen fritext eller PII skickas.
    if (lastTracked.current !== startDate) {
      lastTracked.current = startDate;
      trackEvent('Public Tool Used', { tool: 'klackningskalkylator' });
    }
  };

  const faqs = useMemo(() => [
    {
      q: 'Hur länge ruvar en höna på äggen?',
      a: 'Hönsägg kläcks normalt efter cirka 21 dagar. Det är ett riktvärde – något dygn tidigare eller senare är vanligt, och raser skiljer sig sällan åt nämnvärt.',
    },
    {
      q: 'När ska man lysa äggen?',
      a: 'Första lysningen brukar göras omkring dag 7. Då syns vilka ägg som är befruktade. Många lyser en gång till runt dag 14 för att plocka bort ägg där utvecklingen stannat.',
    },
    {
      q: 'Vad betyder "sluta vändas" dag 18?',
      a: 'Under ruvningen vänds äggen flera gånger om dagen. Cirka tre dygn före kläckning slutar man vända dem och höjer luftfuktigheten, så att kycklingen kan ställa in sig mot hålet den ska pipa.',
    },
    {
      q: 'Fungerar kalkylatorn för andra fågelarter?',
      a: 'Den räknar på hönsäggens 21 dagar. Andra arter har andra ruvtider – vaktel kläcks till exempel snabbare – så för dem gäller andra datum. Principerna med lysning och slutet vändande är dock desamma.',
    },
  ], []);

  return (
    <PublicToolPage
      tool="klackningskalkylator"
      title="Kläckningskalkylator – när kläcks äggen? | Hönsgården"
      description="Räkna ut kläckdatum för hönsägg. Ange när ruvningen startade och få datum för lysning, sista vändningsdagen och beräknad kläckdag. Gratis verktyg utan konto."
      path="/verktyg/klackningskalkylator"
      eyebrow="Gratis verktyg"
      h1="Kläckningskalkylator"
      intro="Ange dagen då äggen lades i maskinen eller under hönan, så räknar vi ut hela tidplanen: lysning, sista vändningsdagen och beräknad kläckdag efter 21 dagar."
      faqs={faqs}
      related={[
        { href: '/klackningskalender', label: 'Kläckningskalender i appen', description: 'Följ kläckningen dag för dag med påminnelser.' },
        { href: '/verktyg/aggkalkylator', label: 'Äggkalkylator', description: 'Räkna kostnad per ägg och lönsamhet i flocken.' },
        { href: '/verktyg/aggregler-vagvisare', label: 'Äggregler-vägvisaren', description: 'Vilka regler gäller om du säljar ägg eller kläckägg?' },
        { href: '/blogg', label: 'Bloggen', description: 'Guider om kläckning, ruvning och kycklingar.' },
      ]}
    >
      <Card className="border-border/50 rounded-2xl bg-card">
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="start-date" className="text-sm font-medium">
                När lades äggen till ruvning?
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setSubmitted(false);
                }}
                className="h-12 text-base rounded-xl"
                required
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-8 rounded-xl gap-2">
              <CalendarDays className="h-4 w-4" /> Räkna ut tidplan
            </Button>
          </form>

          {plan && (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl bg-primary/5 border border-primary/15 p-5 text-center">
                <Egg className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Beräknad kläckdag</p>
                <p className="font-serif text-2xl sm:text-3xl text-foreground mt-1">
                  {formatSvDate(plan.hatchDate)}
                </p>
                {(() => {
                  const left = daysUntilHatch(plan, todayIso());
                  if (left == null) return null;
                  if (left > 0) return <p className="text-xs text-muted-foreground mt-1">om {left} dagar</p>;
                  if (left === 0) return <p className="text-xs text-primary mt-1">idag!</p>;
                  return <p className="text-xs text-muted-foreground mt-1">för {-left} dagar sedan</p>;
                })()}
              </div>

              <ol className="relative space-y-0 border-l-2 border-border/60 ml-3">
                {plan.milestones.map((m) => (
                  <li key={m.day} className="relative pl-6 pb-6 last:pb-0">
                    <span
                      className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 ${
                        m.kind === 'action'
                          ? 'bg-warning/20 border-warning'
                          : 'bg-primary/15 border-primary'
                      }`}
                      aria-hidden="true"
                    />
                    <p className="text-xs text-muted-foreground">
                      Dag {m.day} · {formatSvDate(m.date)}
                    </p>
                    <p className="font-medium text-foreground text-[15px] mt-0.5 flex items-center gap-2">
                      {m.label}
                      {m.kind === 'action' && <Check className="h-3.5 w-3.5 text-warning" />}
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">{m.description}</p>
                  </li>
                ))}
              </ol>

              <p className="text-xs text-muted-foreground">
                Dagarna är riktvärden för hönsägg (cirka 21 dagar). Temperaturen i maskinen,
                äggens ålder och förvaring före ruvning kan flytta kläckningen ett dygn eller två.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </PublicToolPage>
  );
}
