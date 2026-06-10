export type GateCopy = { title: string; body: string };

export const GATE_COPY: Record<string, GateCopy> = {
  finance: {
    title: 'Se vad dina ägg faktiskt kostar — och tjänar',
    body: 'Foderkostnad per ägg, intäkter och export. Allt räknas ut automatiskt.',
  },
  reports: {
    title: 'Din veckorapport väntar',
    body: 'Varje söndag: hur flocken mår, trender och vad du bör göra härnäst.',
  },
  statistics: {
    title: 'Se trenderna i din äggproduktion',
    body: 'Jämför månader, sätt äggmål och upptäck mönster.',
  },
  hatching: {
    title: 'Låt kalendern hålla koll på alla 21 dagarna',
    body: 'Milstolpar, vändningsschema och påminnelser — automatiskt.',
  },
  breeding: {
    title: 'Håll ordning på avel och stamtavlor',
    body: 'Genealogi, kullar och avelsplanering på ett ställe.',
  },
  feed: {
    title: 'Vet exakt vad fodret kostar dig',
    body: 'Spåra förbrukning och få kostnad per ägg.',
  },
  health: {
    title: 'Upptäck hälsoproblem tidigt',
    body: 'Hälsologg, vikthistorik och avvikelsevarningar.',
  },
  eggsales: {
    title: 'Sälj dina ägg proffsigt',
    body: 'Egen försäljningssida, bokningar och Swish-uppgifter.',
  },
  reminders: {
    title: 'Glöm aldrig en syssla igen',
    body: 'Smarta påminnelser och dagliga uppgifter för hela flocken.',
  },
};

export function getGateCopy(key?: string): GateCopy | null {
  if (!key) return null;
  return GATE_COPY[key] ?? null;
}
