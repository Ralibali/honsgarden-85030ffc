import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Loader2, Egg, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWeeklyCoverage } from "@/hooks/useWeeklyCoverage";
import { coverageSummary } from "@/lib/weeklyCoverage";

export default function AIWeeklySummary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const report = useWeeklyCoverage();
  const { coverage, ready, facts } = report;
  const [requestedKey, setRequestedKey] = useState("");
  const version = JSON.stringify([
    report.userId,
    coverage.start,
    coverage.end,
    coverage.daily,
    coverage.previousTotal,
    coverage.comparable,
    report.henCount,
    report.completedToday,
    report.choreCount,
  ]);
  const ai = useQuery({
    queryKey: ["weekly-insights-v3", version],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "weekly-insights",
        {
          body: {
            weekData: {
              weekLabel: `${coverage.start}–${coverage.end}`,
              weekEggs: coverage.total,
              prevWeekEggs: coverage.previousTotal,
              avgPerDay: coverage.averagePerRecordedDay,
              henCount: report.henCount,
              completedChores: report.completedToday,
              reportingBasis: "same_weekdays",
              coverage: {
                expectedDays: coverage.elapsedDays,
                recordedDays: coverage.recordedDays,
                previousRecordedDays: coverage.previousRecordedDays,
              },
            },
          },
        },
      );
      if (error) throw new Error(error.message);
      if (!data || data.dataVersion !== 2 || typeof data.summary !== "string")
        throw new Error("Sammanfattningen kunde inte läsas.");
      return data.summary.slice(0, 5000) as string;
    },
    enabled:
      !!user?.is_premium &&
      ready &&
      coverage.comparable &&
      requestedKey === version,
    staleTime: 3600000,
    retry: false,
  });
  if (report.loading)
    return (
      <p role="status" className="flex gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Hämtar veckans registreringar…
      </p>
    );
  if (!ready)
    return (
      <div role="alert" className="rounded-xl border p-4 space-y-3">
        <p>
          Rapporten är ofullständig. Kunde inte hämta:{" "}
          {report.missingSources.join(", ")}.
        </p>
        <p className="text-sm">
          Uppgifter som inte kan hämtas redovisas inte som noll.
        </p>
        <Button variant="outline" onClick={() => void report.retry()}>
          Försök igen
        </Button>
      </div>
    );
  return (
    <Card data-private-content className="border-primary/15 bg-primary/5">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div>
          <p className="data-label">Veckan hittills · registrerade uppgifter</p>
          <h2 className="mt-1 font-serif text-xl">
            {coverage.start}–{coverage.end}
          </h2>
        </div>
        <p className="text-sm font-medium">{coverageSummary(coverage)}</p>
        <div
          className="grid grid-cols-7 gap-1"
          aria-label="Registreringar per dag"
        >
          {coverage.days.map((day) => (
            <div
              key={day}
              className={`rounded-lg p-2 text-center ${coverage.daily[day] === null ? "border border-dashed bg-background" : "bg-primary/10"}`}
            >
              <time dateTime={day} className="block text-xs">
                {new Date(`${day}T12:00:00`).toLocaleDateString("sv-SE", {
                  weekday: "short",
                })}
              </time>
              <span className="block text-sm font-semibold">
                {coverage.daily[day] ?? "—"}
              </span>
              <span className="sr-only">
                {coverage.daily[day] === null
                  ? "Saknar registrering"
                  : "ägg registrerade"}
              </span>
            </div>
          ))}
        </div>
        <ul className="space-y-2 text-sm">
          {facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        {coverage.missingDays.length > 0 && (
          <div className="rounded-lg border bg-background p-3 text-sm">
            <p>
              Saknas denna vecka:{" "}
              {coverage.missingDays.map((day) => day.slice(5)).join(", ")}.
            </p>
            <p className="mt-1">
              Registrera även dagar med noll ägg. Då kan rapporten skilja noll
              från en dag som inte är ifylld.
            </p>
          </div>
        )}
        <p className="text-sm">
          Delad skötsel idag: {report.completedToday} av {report.choreCount}{" "}
          sysslor markerade klara. {report.henCount} aktiva hönor registrerade.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/app/eggs")}>
            <Egg className="mr-2 h-4 w-4" />
            Öppna äggloggen
          </Button>
          <Button variant="outline" onClick={() => navigate("/app/tasks")}>
            <Users className="mr-2 h-4 w-4" />
            Öppna delad skötsel
          </Button>
        </div>
        <div className="border-t pt-4 space-y-2">
          <Button
            variant="outline"
            disabled={
              !user?.is_premium || !coverage.comparable || ai.isFetching
            }
            onClick={() => {
              if (requestedKey === version) void ai.refetch();
              else setRequestedKey(version);
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {ai.isFetching ? "Sammanfattar…" : "Sammanfatta med AI"}
          </Button>
          {!user?.is_premium && (
            <p className="text-xs text-muted-foreground">
              AI-sammanfattning ingår i Hönsgården Plus. Veckans registrerade
              uppgifter visas för alla.
            </p>
          )}
          {!coverage.comparable && (
            <p className="text-xs text-muted-foreground">
              AI-sammanfattning blir tillgänglig när båda jämförda perioderna
              har registreringar för alla dagar.
            </p>
          )}
          {ai.isError && (
            <p role="alert" className="text-sm">
              AI-sammanfattningen kunde inte hämtas. Dina registrerade uppgifter
              visas ovan.
            </p>
          )}
          {ai.data && requestedKey === version && (
            <div className="rounded-lg bg-background p-3">
              <p className="text-xs text-muted-foreground mb-2">
                AI-formulerad sammanfattning – kontrollera mot registreringarna
                ovan.
              </p>
              <p className="whitespace-pre-wrap text-sm">{ai.data}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
