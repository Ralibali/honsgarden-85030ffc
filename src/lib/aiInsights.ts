import { supabase } from '@/integrations/supabase/client';

export type InsightTone = 'pepp' | 'tips' | 'viktigt' | 'varning';

export interface AppInsight {
  title: string;
  text: string;
  tone: InsightTone;
  cta?: string;
  path?: string;
}

export interface AIInsightContext {
  todayEggs?: number;
  weekEggs?: number;
  previousWeekEggs?: number;
  activeHens?: number;
  hasFeedRecords?: boolean;
  hasReminders?: boolean;
  hasHealthNotes?: boolean;
  hasHatching?: boolean;
  streak?: number;
  page?: 'dashboard' | 'statistics' | 'finance' | 'health' | 'weekly-report';
}

const DEFAULT_AI_TIMEOUT_MS = 9000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs = DEFAULT_AI_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('AI-tjänsten tog för lång tid att svara.')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function normalizeInsights(raw: any): AppInsight[] {
  const items = Array.isArray(raw?.insights)
    ? raw.insights
    : Array.isArray(raw?.items)
      ? raw.items
      : Array.isArray(raw)
        ? raw
        : [];

  return items
    .filter(Boolean)
    .map((item: any) => ({
      title: String(item.title || item.rubrik || 'Hönsgården har märkt något'),
      text: String(item.text || item.description || item.body || item.message || ''),
      tone: (item.tone || item.type || item.category || 'tips') as InsightTone,
      cta: item.cta || item.button || item.actionLabel,
      path: item.path || item.href || item.url,
    }))
    .filter((item: AppInsight) => item.text.trim().length > 0)
    .slice(0, 4);
}

export function buildFallbackInsights(ctx: AIInsightContext): AppInsight[] {
  const insights: AppInsight[] = [];
  const todayEggs = ctx.todayEggs ?? 0;
  const weekEggs = ctx.weekEggs ?? 0;
  const previousWeekEggs = ctx.previousWeekEggs ?? 0;
  const activeHens = ctx.activeHens ?? 0;
  const diff = weekEggs - previousWeekEggs;

  if (activeHens === 0) {
    insights.push({
      title: 'Lägg till din första höna',
      text: 'Börja med flocken så kan Hönsgården hjälpa dig följa ägg, hälsa, historik och rutiner på riktigt.',
      tone: 'tips',
      cta: 'Lägg till höna',
      path: '/app/hens',
    });
  }

  if (activeHens > 0 && todayEggs === 0) {
    insights.push({
      title: 'Logga dagens ägg',
      text: 'Du har inte loggat några ägg idag ännu. Gör det direkt medan du minns, så blir statistiken mycket bättre.',
      tone: 'tips',
      cta: 'Logga ägg',
      path: '/app/eggs',
    });
  }

  if (ctx.streak && ctx.streak >= 7) {
    insights.push({
      title: 'Bra jobbat!',
      text: `Du har loggat ägg ${ctx.streak} dagar i rad. Det är precis så du bygger riktigt bra koll på hönsgården.`,
      tone: 'pepp',
      cta: 'Se veckorapport',
      path: '/app/weekly-report',
    });
  }

  if (previousWeekEggs > 0 && diff > 0) {
    insights.push({
      title: 'Produktionen är uppåt',
      text: `Den här veckan har du loggat ${weekEggs} ägg, ${diff} fler än förra veckan. Fortsätt med samma rutiner.`,
      tone: 'pepp',
      cta: 'Se statistik',
      path: '/app/statistics',
    });
  }

  if (previousWeekEggs > 0 && diff < 0) {
    insights.push({
      title: 'Håll lite extra koll',
      text: `Äggproduktionen är ${Math.abs(diff)} ägg lägre än förra veckan. Det kan vara normalt, men håll koll på ruggning, foder, väder och stress.`,
      tone: 'viktigt',
      cta: 'Se statistik',
      path: '/app/statistics',
    });
  }

  if (!ctx.hasFeedRecords) {
    insights.push({
      title: 'Lägg in foderkostnad',
      text: 'Vill du veta vad varje ägg faktiskt kostar? Lägg in senaste foderinköpet så kan Hönsgården börja räkna.',
      tone: 'tips',
      cta: 'Lägg till foder',
      path: '/app/feed',
    });
  }

  if (!ctx.hasReminders) {
    insights.push({
      title: 'Skapa en enkel rutin',
      text: 'Lägg upp en återkommande syssla för vatten, foder eller rengöring. Det är skönt att slippa hålla allt i huvudet.',
      tone: 'tips',
      cta: 'Skapa syssla',
      path: '/app/tasks',
    });
  }

  if (ctx.hasHatching) {
    insights.push({
      title: 'Kolla kläckningskalendern',
      text: 'Du har kläckning igång. Det är värt att titta till datum, milstolpar och nästa steg.',
      tone: 'viktigt',
      cta: 'Öppna kläckning',
      path: '/app/hatching',
    });
  }

  return insights.slice(0, 4);
}

export async function getLovableAIInsights(ctx: AIInsightContext): Promise<{ insights: AppInsight[]; source: 'ai' | 'fallback'; error?: string }> {
  const fallback = buildFallbackInsights(ctx);

  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('dashboard-coach', {
        body: {
          context: ctx,
          instruction: 'Svara på svenska med 1-4 korta, varma och praktiska råd för en svensk hobbyhönsägare. Hitta inte på data.',
        },
      })
    );

    if (error) throw new Error(error.message);
    const aiInsights = normalizeInsights(data);
    if (aiInsights.length === 0) return { insights: fallback, source: 'fallback', error: 'AI svarade utan användbara insikter.' };
    return { insights: aiInsights, source: 'ai' };
  } catch (err: any) {
    return { insights: fallback, source: 'fallback', error: err?.message || 'AI kunde inte laddas just nu.' };
  }
}

export async function getLovableAIWeeklySummary(payload: Record<string, unknown>): Promise<{ text: string; source: 'ai' | 'fallback'; error?: string }> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('weekly-report-ai', {
        body: {
          ...payload,
          instruction: 'Skriv en varm, kort och praktisk veckorapport på svenska. Ge 3 insikter och 1-3 nästa steg. Hitta inte på data.',
        },
      })
    );
    if (error) throw new Error(error.message);
    const text = data?.text || data?.summary || data?.message || '';
    if (!text) throw new Error('AI svarade utan text.');
    return { text, source: 'ai' };
  } catch (err: any) {
    const weekEggs = Number(payload.weekEggs || 0);
    const previousWeekEggs = Number(payload.previousWeekEggs || 0);
    const diff = weekEggs - previousWeekEggs;
    const trend = previousWeekEggs === 0 ? 'Nu börjar rapporten samla underlag.' : diff >= 0 ? `Det är ${diff} fler än förra veckan.` : `Det är ${Math.abs(diff)} färre än förra veckan.`;
    return {
      text: `Den här veckan har du loggat ${weekEggs} ägg. ${trend} Fortsätt logga ägg, foder och rutiner så kan Hönsgården ge ännu bättre insikter över tid.`,
      source: 'fallback',
      error: err?.message || 'AI kunde inte laddas just nu.',
    };
  }
}
