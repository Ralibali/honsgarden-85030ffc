import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, ChevronRight, Home, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useSeo } from '@/hooks/useSeo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  START_COST_REFERENCE,
  calculateStartCost,
  type StartCostInput,
} from '@/lib/commerceStrategy';

type PresetKey = 'budget' | 'bas' | 'premium';

const PRESETS: Record<PresetKey, StartCostInput> = {
  budget: {
    hens: 4,
    henPriceSek: 200,
    housingSek: 2650,
    fencingSek: 700,
    equipmentSek: 540,
    firstFeedAndBeddingSek: 200,
    otherSek: 0,
  },
  bas: {
    hens: 4,
    henPriceSek: 225,
    housingSek: 5000,
    fencingSek: 1500,
    equipmentSek: 1000,
    firstFeedAndBeddingSek: 400,
    otherSek: 700,
  },
  premium: {
    hens: 4,
    henPriceSek: 250,
    housingSek: 12000,
    fencingSek: 1800,
    equipmentSek: 1000,
    firstFeedAndBeddingSek: 400,
    otherSek: 200,
  },
};

const formatSek = (value: number) =>
  Math.round(value).toLocaleString('sv-SE') + ' kr';

export default function StartCostCalculator() {
  const [preset, setPreset] = useState<PresetKey>('budget');
  const [input, setInput] = useState<StartCostInput>(PRESETS.budget);
  const [monthlyFeed, setMonthlyFeed] = useState(250);
  const [monthlyBedding, setMonthlyBedding] = useState(50);
  const [monthlyOther, setMonthlyOther] = useState(50);

  const result = useMemo(() => calculateStartCost(input), [input]);
  const annualOperating = (monthlyFeed + monthlyBedding + monthlyOther) * 12;

  useSeo({
    title: 'Vad kostar det att skaffa höns? Startkostnadskalkylator | Hönsgården',
    description:
      'Räkna på hönshus, höns, stängsel, foder och utrustning. Gratis startkostnadskalkylator för dig som funderar på att skaffa höns.',
    path: '/verktyg/vad-kostar-hons',
    jsonLd: [
      {
        '@type': 'WebApplication',
        name: 'Startkostnadskalkylator för höns',
        url: 'https://honsgarden.se/verktyg/vad-kostar-hons',
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Web',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'SEK' },
      },
    ],
  });

  const applyPreset = (key: PresetKey) => {
    setPreset(key);
    setInput(PRESETS[key]);
  };

  const update = (key: keyof StartCostInput, value: number) => {
    setPreset('bas');
    setInput((current) => ({ ...current, [key]: Math.max(0, value || 0) }));
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b border-border/50 bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>🐔</span>
            <span className="font-serif text-lg">Hönsgården</span>
          </Link>
          <Link to="/login?mode=register">
            <Button size="sm" className="rounded-xl">Testa appen gratis</Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-9 sm:py-14">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/8 px-3 py-1.5 text-xs font-medium text-primary">
            <Calculator className="h-3.5 w-3.5" />
            Gratis kalkylator
          </div>
          <h1 className="font-serif text-3xl leading-tight sm:text-5xl">
            Vad kostar det att skaffa höns?
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Bygg din egen startbudget för hönshus, stängsel, utrustning, foder och själva hönsen.
            Alla belopp går att ändra – kalkylatorn är beslutsstöd, inte en offert.
          </p>
        </div>

        <section className="mt-8 rounded-2xl border border-primary/15 bg-primary/[0.035] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">Researchreferens 2026</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Hönsgårdens commerce-underlag placerar en typisk total startkostnad för fyra höns
                ungefär mellan {formatSek(START_COST_REFERENCE.startMinSek)} och{' '}
                {formatSek(START_COST_REFERENCE.startMaxSek)}, med ungefär{' '}
                {formatSek(START_COST_REFERENCE.annualMinSek)}–{formatSek(START_COST_REFERENCE.annualMaxSek)}
                i årlig drift. Priser varierar kraftigt beroende på hus, byggsätt och utrustning.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="font-serif text-xl">Din startbudget</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Börja med ett exempel och justera sedan efter din situation.
              </p>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-2">
              {([
                ['budget', 'Budget'],
                ['bas', 'Bas'],
                ['premium', 'Premium'],
              ] as const).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => applyPreset(key)}
                  className={
                    'rounded-xl border px-3 py-2 text-xs font-semibold transition ' +
                    (preset === key
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/30')
                  }
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="hens"
                label="Antal höns"
                value={input.hens}
                onChange={(value) => update('hens', value)}
              />
              <Field
                id="hen-price"
                label="Pris per höna"
                suffix="kr"
                value={input.henPriceSek}
                onChange={(value) => update('henPriceSek', value)}
              />
              <Field
                id="housing"
                label="Hönshus"
                suffix="kr"
                value={input.housingSek}
                onChange={(value) => update('housingSek', value)}
              />
              <Field
                id="fencing"
                label="Hönsgård / stängsel"
                suffix="kr"
                value={input.fencingSek}
                onChange={(value) => update('fencingSek', value)}
              />
              <Field
                id="equipment"
                label="Foder-/vattenutrustning m.m."
                suffix="kr"
                value={input.equipmentSek}
                onChange={(value) => update('equipmentSek', value)}
              />
              <Field
                id="first-feed"
                label="Första foder + strö"
                suffix="kr"
                value={input.firstFeedAndBeddingSek}
                onChange={(value) => update('firstFeedAndBeddingSek', value)}
              />
              <div className="sm:col-span-2">
                <Field
                  id="other"
                  label="Övrigt"
                  suffix="kr"
                  value={input.otherSek}
                  onChange={(value) => update('otherSek', value)}
                />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Beräknad startkostnad
              </p>
              <p className="mt-2 font-serif text-4xl text-foreground">{formatSek(result.total)}</p>
              <div className="mt-4 space-y-2 text-sm">
                <Row label="Höns" value={result.animalCost} />
                <Row label="Hönshus" value={input.housingSek} />
                <Row label="Stängsel / gård" value={input.fencingSek} />
                <Row label="Utrustning" value={input.equipmentSek} />
                <Row label="Foder + strö" value={input.firstFeedAndBeddingSek} />
                <Row label="Övrigt" value={input.otherSek} />
              </div>
              <p className="mt-4 rounded-xl bg-muted/40 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                {result.insideResearchRange
                  ? 'Din kalkyl ligger inom researchunderlagets observerade startspann.'
                  : 'Din kalkyl ligger utanför researchunderlagets startspann – det kan vara helt rimligt om du bygger själv, återbrukar eller väljer dyrare lösningar.'}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <h2 className="font-serif text-lg">Löpande drift</h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <SmallField label="Foder/mån" value={monthlyFeed} onChange={setMonthlyFeed} />
                <SmallField label="Strö/mån" value={monthlyBedding} onChange={setMonthlyBedding} />
                <SmallField label="Övrigt/mån" value={monthlyOther} onChange={setMonthlyOther} />
              </div>
              <div className="mt-4 flex items-end justify-between gap-4 rounded-xl bg-muted/40 p-3">
                <span className="text-xs text-muted-foreground">Din beräknade drift/år</span>
                <strong className="text-lg">{formatSek(annualOperating)}</strong>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <InfoCard
            icon={<Home className="h-5 w-5" />}
            title="Hus och gård driver startkostnaden"
            body="Det är normalt den största posten. Bygg själv och färdig lösning kan ge helt olika budget."
          />
          <InfoCard
            icon={<ShoppingBag className="h-5 w-5" />}
            title="Köp efter behov"
            body="Börja med säkerhet, vatten, foder och ett fungerande boende. All extrautrustning behöver inte köpas dag ett."
          />
          <InfoCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Färre men bättre val"
            body="Hönsgården rekommenderar hellre några relevanta alternativ än en lång lista med produkter."
          />
        </section>

        <section className="mt-10 rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/8 via-card to-accent/5 p-6 sm:p-8">
          <h2 className="font-serif text-2xl">Nästa steg: planera din egen flock</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            I Hönsgården kan du logga höns, ägg, foder, kostnader, kläckning och få rekommendationer
            som utgår från din faktiska flock i stället för generella listor.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to="/login?mode=register">
              <Button className="gap-2 rounded-xl">
                Skapa gratis konto <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/verktyg/aggkalkylator">
              <Button variant="outline" className="rounded-xl">Räkna på äggekonomin</Button>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  suffix,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <div className="relative mt-1">
        <Input
          id={id}
          type="number"
          min={0}
          value={value}
          onChange={(event) => onChange(Number(event.target.value) || 0)}
          className={suffix ? 'pr-10' : undefined}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SmallField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-[10px] text-muted-foreground">
      {label}
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="mt-1 h-9 px-2 text-xs"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{formatSek(value)}</span>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-primary">{icon}</div>
      <h3 className="mt-3 font-serif text-lg">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
