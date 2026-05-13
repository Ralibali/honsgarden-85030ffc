/**
 * Period-validering för rapportgenerering.
 * Delas mellan klient (förhandskontroll) och edge function (säkerhet).
 *
 * Edge function (Deno) kan inte importera detta direkt — håll filen ren
 * från React/DOM-beroenden så att en motsvarande kopia kan ligga i
 * supabase/functions/_shared/reportPeriodSchema.ts utan ändringar.
 */
import { z } from "zod";

export const REPORT_TYPES = ["manad", "kvartal", "ar", "avel"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ogiltigt datum (YYYY-MM-DD krävs)")
  .refine((s) => !Number.isNaN(new Date(s + "T00:00:00Z").getTime()), {
    message: "Ogiltigt datum",
  });

export const MAX_DAYS_BY_TYPE: Record<ReportType, number | null> = {
  manad: 31,
  kvartal: 95,
  ar: 366,
  avel: null,
};

export const ReportPeriodInput = z.object({
  farm_id: z.string().uuid(),
  report_type: z.enum(REPORT_TYPES),
  period_start: dateString,
  period_end: dateString,
});

export type ReportPeriodInputType = z.infer<typeof ReportPeriodInput>;

export interface PeriodValidationResult {
  ok: boolean;
  error?: string;
}

const MS_PER_DAY = 86_400_000;

/** Antal dagar i perioden (inklusive både start och end). */
export function daysInPeriod(start: string, end: string): number {
  const s = new Date(start + "T00:00:00Z").getTime();
  const e = new Date(end + "T00:00:00Z").getTime();
  return Math.round((e - s) / MS_PER_DAY) + 1;
}

/**
 * Affärsregler ovanpå zod: ordning, framtid, övre gränser.
 * Returnerar { ok:false, error } istället för att kasta — lättare att testa
 * och att returnera som 400 i edge function.
 */
export function validateReportPeriod(
  input: ReportPeriodInputType,
  now: Date = new Date()
): PeriodValidationResult {
  const start = new Date(input.period_start + "T00:00:00Z");
  const end = new Date(input.period_end + "T00:00:00Z");

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { ok: false, error: "Ogiltiga datumsträngar" };
  }

  if (end < start) {
    return { ok: false, error: "Slutdatum måste vara efter startdatum" };
  }

  // En-dags-rapport (start = end) är OK.

  if (start > now) {
    return { ok: false, error: "Perioden kan inte vara i framtiden" };
  }

  const fiveYearsAgo = new Date(now);
  fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
  if (end < fiveYearsAgo) {
    return { ok: false, error: "Perioden får inte vara äldre än 5 år" };
  }

  const max = MAX_DAYS_BY_TYPE[input.report_type];
  if (max != null) {
    const days = daysInPeriod(input.period_start, input.period_end);
    if (days > max) {
      return {
        ok: false,
        error: `För lång period för ${input.report_type} (max ${max} dagar)`,
      };
    }
  }

  return { ok: true };
}

/** Bekvämlighet: parse + validate i ett. */
export function parseAndValidate(
  raw: unknown,
  now: Date = new Date()
):
  | { ok: true; value: ReportPeriodInputType }
  | { ok: false; error: string } {
  const parsed = ReportPeriodInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Ogiltig indata",
    };
  }
  const v = validateReportPeriod(parsed.data, now);
  if (!v.ok) return { ok: false, error: v.error! };
  return { ok: true, value: parsed.data };
}
