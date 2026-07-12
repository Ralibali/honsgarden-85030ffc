import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useSeo } from "@/hooks/useSeo";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { Egg, Plus, ArrowLeft, Sparkles } from "lucide-react";

type Hen = { id: number; name: string; breed: string; emoji: string; today: number };

const SEED_TOTAL = 6;

export default function DemoApp() {
  useSeo({
    title: "Prova Hönsgården – ingen registrering | Hönsgården",
    description: "Testa Hönsgårdens kärnloop direkt i webbläsaren – logga ägg och se flock och statistik uppdateras. Ingen registrering, inget sparas.",
    path: "/demo",
    noindex: true,
  });

  const [todayEggs, setTodayEggs] = useState(SEED_TOTAL);
  const [hens, setHens] = useState<Hen[]>([
    { id: 1, name: "Greta", breed: "Isbrun", emoji: "🐔", today: 2 },
    { id: 2, name: "Agda", breed: "Leghorn", emoji: "🐓", today: 1 },
    { id: 3, name: "Berta", breed: "Sussex", emoji: "🐔", today: 0 },
    { id: 4, name: "Doris", breed: "Maran", emoji: "🐔", today: 3 },
  ]);
  const [pulseKey, setPulseKey] = useState(0);

  const weekBase = [
    { day: "Mån", eggs: 5 },
    { day: "Tis", eggs: 6 },
    { day: "Ons", eggs: 4 },
    { day: "Tor", eggs: 7 },
    { day: "Fre", eggs: 5 },
    { day: "Lör", eggs: 6 },
  ];
  const chartData = useMemo(() => [...weekBase, { day: "Idag", eggs: todayEggs }], [todayEggs]);

  const addedSinceSeed = todayEggs - SEED_TOTAL;
  const showNudge = addedSinceSeed >= 3;

  const logEggs = (n: number) => {
    setTodayEggs((v) => v + n);
    setPulseKey((k) => k + 1);
    toast.success(n === 1 ? "🥚 +1 ägg loggat" : `🥚 +${n} ägg loggade`);
  };

  const addToHen = (id: number) => {
    setHens((prev) => prev.map((h) => (h.id === id ? { ...h, today: h.today + 1 } : h)));
    setTodayEggs((v) => v + 1);
    setPulseKey((k) => k + 1);
  };

  const avg = hens.length ? (todayEggs / hens.length).toFixed(1) : "0";

  return (
    <div className="min-h-dvh bg-background pb-32 sm:pb-12">
      <div className="container max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        <div className="flex items-center justify-between mb-3">
          <a href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Tillbaka till startsidan
          </a>
          <Badge variant="secondary" className="text-[10px]">Demo</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-5">Det här är en demo – inget sparas.</p>

        <Card className="mb-5 border-primary/30 bg-primary/5">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex-1">
              <p className="font-serif text-base sm:text-lg text-foreground">Gillar du det?</p>
              <p className="text-sm text-muted-foreground">Skapa ett gratis konto så sparas din flock på riktigt.</p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <a href="/login?mode=register">Skapa konto gratis</a>
            </Button>
          </CardContent>
        </Card>

        <h1 className="font-serif text-2xl sm:text-3xl text-foreground mb-1">Prova Hönsgården</h1>
        <p className="text-sm text-muted-foreground mb-6">Logga ägg och se flocken och statistiken uppdateras live.</p>

        {/* Log eggs */}
        <Card className="mb-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Egg className="h-4 w-4 text-primary" /> Logga ägg</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-center">
            <Button size="lg" onClick={() => logEggs(1)} className="h-12 px-6">+1 ägg</Button>
            <Button size="lg" variant="secondary" onClick={() => logEggs(6)} className="h-12 px-6">+6 ägg</Button>
            <span
              key={pulseKey}
              className="text-3xl ml-auto animate-in zoom-in-50 duration-300"
              aria-hidden
            >🥚</span>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Ägg idag", value: todayEggs },
            { label: "Hönor", value: hens.length },
            { label: "Snitt/höna", value: avg },
          ].map((s) => (
            <Card key={s.label}>
              <CardContent className="p-3 sm:p-4 text-center">
                <div className="font-serif text-2xl sm:text-3xl text-primary">{s.value}</div>
                <div className="text-[11px] sm:text-xs text-muted-foreground mt-1">{s.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Chart */}
        <Card className="mb-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">7 dagar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis hide />
                  <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="eggs" radius={[6, 6, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.day === "Idag" ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Hens */}
        <Card className="mb-5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Din flock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {hens.map((h) => (
              <div key={h.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <span className="text-2xl" aria-hidden>{h.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground">{h.name}</div>
                  <div className="text-xs text-muted-foreground">{h.breed} · {h.today} ägg idag</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => addToHen(h.id)} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> 1
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        {showNudge && (
          <Card className="mb-5 border-primary/40 bg-primary/5">
            <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm text-foreground flex-1">
                Snyggt! I appen sparas det här automatiskt och blir till statistik och insikter över tid.
              </p>
              <Button asChild size="sm" className="shrink-0">
                <a href="/login?mode=register">Skapa konto gratis</a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 inset-x-0 sm:hidden z-40 p-3 bg-background/95 backdrop-blur border-t border-border">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted-foreground flex-1 leading-tight">Gillar du det? Spara din flock på riktigt.</p>
          <Button asChild size="sm" className="shrink-0">
            <a href="/login?mode=register">Skapa konto</a>
          </Button>
        </div>
      </div>
    </div>
  );
}
