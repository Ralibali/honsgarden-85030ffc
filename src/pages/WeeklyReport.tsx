import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Share2,
  Download,
  Copy,
  Check,
  Egg,
  Bird,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import AIWeeklySummary from "@/components/AIWeeklySummary";
import ReferralCard from "@/components/ReferralCard";
import { useWeeklyCoverage } from "@/hooks/useWeeklyCoverage";
import { coverageSummary } from "@/lib/weeklyCoverage";

function drawReportCard(
  canvas: HTMLCanvasElement,
  data: {
    weekEggs: number;
    prevWeekEggs: number;
    avgPerDay: number | null;
    henCount: number;
    comparable: boolean;
    recordedDays: number;
    elapsedDays: number;
    bestDay: string;
    insights: string[];
    userName?: string;
    weekLabel: string;
  },
) {
  const ctx = canvas.getContext("2d")!;
  const w = 1080;
  const h = 1350;
  canvas.width = w;
  canvas.height = h;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#f5f0e8");
  grad.addColorStop(0.5, "#f0ebe0");
  grad.addColorStop(1, "#e8e0d4");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const barGrad = ctx.createLinearGradient(0, 0, w, 0);
  barGrad.addColorStop(0, "#3d7a4a");
  barGrad.addColorStop(1, "#8b6e3b");
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, w, 8);

  ctx.fillStyle = "#3d7a4a";
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("🐔 Hönsgården — Veckorapport", w / 2, 70);

  ctx.fillStyle = "#8b7a68";
  ctx.font = "22px system-ui, -apple-system, sans-serif";
  ctx.fillText(data.weekLabel, w / 2, 105);

  ctx.strokeStyle = "rgba(139,115,85,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(100, 130);
  ctx.lineTo(w - 100, 130);
  ctx.stroke();

  ctx.fillStyle = "#2d1a0e";
  ctx.font = "bold 160px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${data.weekEggs}`, w / 2, 310);
  ctx.fillStyle = "#6b5a48";
  ctx.font = "34px system-ui, -apple-system, sans-serif";
  ctx.fillText("registrerade ägg hittills 🥚", w / 2, 365);

  const diff = data.weekEggs - data.prevWeekEggs;
  const trendText = !data.comparable
    ? "Dagar saknas – ingen trend visas"
    : diff > 0
      ? `▲ +${diff} mot samma veckodagar`
      : diff < 0
        ? `▼ ${diff} mot samma veckodagar`
        : "— Samma antal som samma veckodagar";
  ctx.fillStyle = !data.comparable
    ? "#8b7a68"
    : diff > 0
      ? "#3d7a4a"
      : diff < 0
        ? "#b44"
        : "#8b7a68";
  ctx.font = "24px system-ui, -apple-system, sans-serif";
  ctx.fillText(trendText, w / 2, 410);

  const statsY = 470;
  const stats = [
    {
      label: "Snitt/loggdag",
      value: data.avgPerDay?.toFixed(1) ?? "—",
      emoji: "📊",
    },
    { label: "Hönor", value: `${data.henCount}`, emoji: "🐔" },
    { label: "Bästa dag", value: data.bestDay, emoji: "⭐" },
    {
      label: "Loggdagar",
      value: `${data.recordedDays}/${data.elapsedDays}`,
      emoji: "📅",
    },
  ];
  const cardW = 210;
  const gap = 30;
  const startX = (w - (cardW * 4 + gap * 3)) / 2;

  stats.forEach((s, i) => {
    const x = startX + i * (cardW + gap);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.roundRect(x, statsY, cardW, 140, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(139,115,85,0.1)";
    ctx.beginPath();
    ctx.roundRect(x, statsY, cardW, 140, 16);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.font = "28px system-ui";
    ctx.fillStyle = "#2d1a0e";
    ctx.fillText(s.emoji, x + cardW / 2, statsY + 42);
    ctx.font = "bold 40px system-ui, -apple-system, sans-serif";
    ctx.fillText(s.value, x + cardW / 2, statsY + 92);
    ctx.font = "18px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#8b7a68";
    ctx.fillText(s.label, x + cardW / 2, statsY + 122);
  });

  const visibleInsights = data.insights.slice(0, 4);
  if (visibleInsights.length > 0) {
    const insY = 670;
    ctx.fillStyle = "rgba(61,122,74,0.06)";
    ctx.beginPath();
    ctx.roundRect(80, insY, w - 160, 30 + visibleInsights.length * 70, 20);
    ctx.fill();

    ctx.fillStyle = "#3d7a4a";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("✨ Veckans insikter", 120, insY + 40);

    ctx.fillStyle = "#3a2e22";
    ctx.font = "20px system-ui, -apple-system, sans-serif";
    visibleInsights.forEach((insight, i) => {
      const text = `• ${insight}`;
      const maxW = w - 260;
      const words = text.split(" ");
      let line = "";
      let y = insY + 85 + i * 65;
      for (const word of words) {
        const test = line + word + " ";
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line.trim(), 120, y);
          line = word + " ";
          y += 26;
        } else {
          line = test;
        }
      }
      ctx.fillText(line.trim(), 120, y);
    });
  }

  if (data.userName) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#6b5a48";
    ctx.font = "24px system-ui, -apple-system, sans-serif";
    ctx.fillText(`${data.userName}s hönsgård`, w / 2, h - 150);
  }

  ctx.fillStyle = "#3d7a4a";
  ctx.font = "bold 26px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Logga dina ägg gratis!", w / 2, h - 90);
  ctx.fillStyle = "#8b7a68";
  ctx.font = "20px system-ui, -apple-system, sans-serif";
  ctx.fillText("honsgarden.se", w / 2, h - 58);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, h - 8, w, 8);
}

export default function WeeklyReport() {
  const { user } = useAuth();
  const report = useWeeklyCoverage();
  const { coverage: c, ready } = report;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const weekLabel = `${c.start}–${c.end}`;
  const shareText = `${c.total} ägg registrerade i min hönsgård ${weekLabel}.\n${coverageSummary(c)}\n${c.averagePerRecordedDay === null ? "Snitt saknas." : `Snitt ${c.averagePerRecordedDay.toFixed(1)} per registrerad dag.`}\n\nhonsgarden.se`;
  const cardData = JSON.stringify({
    weekEggs: c.total,
    prevWeekEggs: c.previousTotal,
    avgPerDay: c.averagePerRecordedDay,
    henCount: report.henCount ?? 0,
    comparable: c.comparable,
    recordedDays: c.recordedDays,
    elapsedDays: c.elapsedDays,
    bestDay: c.bestDay
      ? new Date(`${c.bestDay}T12:00:00`).toLocaleDateString("sv-SE", {
          weekday: "short",
        })
      : "—",
    insights: report.facts,
    userName: user?.name,
    weekLabel,
  });
  useEffect(() => {
    if (canvasRef.current && ready)
      drawReportCard(canvasRef.current, JSON.parse(cardData));
  }, [cardData, ready]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Kunde inte kopiera",
        description: "Prova att ladda ner bilden i stället.",
        variant: "destructive",
      });
    }
  }
  async function share() {
    if (!canvasRef.current || !ready) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvasRef.current!.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Bilden kunde inte skapas.");
      const file = new File([blob], "veckorapport.png", { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] }))
        await navigator.share({
          title: "Min veckorapport",
          text: shareText,
          files: [file],
        });
      else await copy();
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === "AbortError"))
        toast({
          title: "Kunde inte dela",
          description: "Prova att ladda ner rapporten.",
          variant: "destructive",
        });
    }
  }
  return (
    <div data-private-content className="max-w-2xl mx-auto space-y-5 pb-8">
      <header>
        <p className="data-label mb-1">Din veckorytm</p>
        <h1 className="text-2xl sm:text-3xl font-serif">Veckorapport</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {weekLabel} · veckan hittills
        </p>
      </header>
      <AIWeeklySummary />
      {ready && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Egg, label: "Registrerade ägg", value: c.total },
              { icon: Bird, label: "Aktiva hönor", value: report.henCount },
              {
                icon: Calendar,
                label: "Dagar registrerade",
                value: `${c.recordedDays}/${c.elapsedDays}`,
              },
            ].map((item) => (
              <Card key={item.label}>
                <CardContent className="p-3 flex flex-col items-center gap-1">
                  <item.icon className="h-5 w-5 text-primary" />
                  <span className="text-xl font-bold">{item.value}</span>
                  <span className="text-[11px] text-muted-foreground text-center">
                    {item.label}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-lg flex items-center gap-2">
                <Share2 className="h-5 w-5" />
                Dela registrerade uppgifter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Bilden och texten visar även hur många dagar som är
                registrerade. AI-text ingår inte i den delade rapporten.
              </p>
              <div className="rounded-xl overflow-hidden border">
                <canvas
                  ref={canvasRef}
                  className="w-full h-auto"
                  aria-label="Förhandsvisning av veckorapport med registrerade dagar"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void share()}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Dela
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!canvasRef.current) return;
                    const a = document.createElement("a");
                    a.download = `veckorapport-${c.end}.png`;
                    a.href = canvasRef.current.toDataURL("image/png");
                    a.click();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Ladda ner
                </Button>
                <Button variant="outline" onClick={() => void copy()}>
                  {copied ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {copied ? "Kopierat" : "Kopiera text"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      <ReferralCard />
    </div>
  );
}
