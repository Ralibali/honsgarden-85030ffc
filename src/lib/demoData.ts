// Fiktiv demogård "Lillgården" – stabil exempeldata för /demo.
// Data genereras deterministiskt (fast frö) så demon ser likadan ut vid varje besök.

import type { Tables } from '@/integrations/supabase/types';
import type { DailyChoreWithCompletion } from '@/lib/api';

export type DemoHen = Tables<'hens'>;
export type DemoEggLog = Tables<'egg_logs'>;
export type DemoHealthLog = Tables<'health_logs'>;
export type DemoTransaction = Tables<'transactions'>;
export type DemoFeedRecord = Tables<'feed_records'>;
export type DemoHatching = Tables<'hatchings'>;
export type DemoEggGoal = Tables<'egg_goals'>;

export interface DemoStore {
  hens: DemoHen[];
  eggs: DemoEggLog[];
  healthLogs: DemoHealthLog[];
  transactions: DemoTransaction[];
  feedRecords: DemoFeedRecord[];
  hatchings: DemoHatching[];
  chores: DailyChoreWithCompletion[];
  eggGoals: DemoEggGoal[];
}

const DEMO_USER = 'demo-user';

/** yyyy-MM-dd för dagen som är `daysAgo` dagar sedan (lokal tid). */
function dateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function iso(daysAgo: number, hour = 8): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, Math.floor(Math.random() * 50) + 5, 0, 0);
  return d.toISOString();
}

/** Deterministisk PRNG (mulberry32) – samma data varje laddning. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let idCounter = 0;
function demoId(prefix: string): string {
  idCounter += 1;
  return `demo-${prefix}-${idCounter}`;
}

const HEN_SEED: { name: string; breed: string; color: string; layingRate: number }[] = [
  { name: 'Blanka', breed: 'Leghorn', color: 'Vit', layingRate: 0.92 },
  { name: 'Agda', breed: 'Isbrun', color: 'Svartvit', layingRate: 0.85 },
  { name: 'Doris', breed: 'Maran', color: 'Svart', layingRate: 0.72 },
  { name: 'Greta', breed: 'Sussex', color: 'Ljusbrun', layingRate: 0.78 },
  { name: 'Sigrid', breed: 'Dvärgkochin', color: 'Gul', layingRate: 0.55 },
];

export function createDemoStore(): DemoStore {
  const rnd = mulberry32(20260721);
  const now = new Date().toISOString();

  const hens: DemoHen[] = HEN_SEED.map((h, i) => ({
    id: `demo-hen-${i + 1}`,
    user_id: DEMO_USER,
    name: h.name,
    breed: h.breed,
    color: h.color,
    birth_date: dateKey(430 + Math.floor(rnd() * 120)),
    image_url: null,
    notes: null,
    is_active: true,
    hen_type: 'hen',
    flock_id: null,
    bloodline: null,
    death_cause: null,
    death_date: null,
    father_id: null,
    father_name: null,
    mother_id: null,
    mother_name: null,
    hatch_session_id: null,
    created_at: dateKey(430) + 'T07:00:00Z',
    updated_at: now,
  }));

  // 45 dagars ägglogg med realistisk dygnsrytm och en liten dipp för en vecka sedan
  const eggs: DemoEggLog[] = [];
  for (let daysAgo = 45; daysAgo >= 0; daysAgo -= 1) {
    for (const [i, hen] of hens.entries()) {
      const rate = HEN_SEED[i].layingRate;
      // Dipp för 6–8 dagar sedan (Doris och Greta var lite hälta)
      const dip = daysAgo >= 6 && daysAgo <= 8 && (hen.name === 'Doris' || hen.name === 'Greta') ? 0.4 : 1;
      // Idag är dagen ung – bara morgonens ägg ännu
      const todaysFactor = daysAgo === 0 ? 0.55 : 1;
      if (rnd() < rate * dip * todaysFactor) {
        eggs.push({
          id: demoId('egg'),
          user_id: DEMO_USER,
          hen_id: hen.id,
          flock_id: null,
          date: dateKey(daysAgo),
          count: 1,
          notes: null,
          weather: null,
          client_id: null,
          created_at: iso(daysAgo, 7 + Math.floor(rnd() * 6)),
        });
      }
    }
  }

  const healthLogs: DemoHealthLog[] = [
    { id: demoId('hl'), user_id: DEMO_USER, hen_id: null, date: dateKey(12), type: 'Kvalsterkontroll', description: 'Kollade under vingarna på alla – rent och fint.', created_at: iso(12) },
    { id: demoId('hl'), user_id: DEMO_USER, hen_id: hens[2].id, date: dateKey(7), type: 'Observation', description: 'Doris lite hälta på vänster fot. Kollade – ingen bumblefoot, bara en liten skråma.', created_at: iso(7) },
    { id: demoId('hl'), user_id: DEMO_USER, hen_id: null, date: dateKey(3), type: 'diary', description: 'Städade hönshuset och bytte strö. Alla pigga!', created_at: iso(3) },
    { id: demoId('hl'), user_id: DEMO_USER, hen_id: null, date: dateKey(0), type: 'diary', description: 'Blanka lät som en flock elefanter i morse – ägg på gång.', created_at: iso(0) },
  ];

  const transactions: DemoTransaction[] = [
    { id: demoId('tx'), user_id: DEMO_USER, date: dateKey(14), type: 'expense', category: 'Foder', amount: -289, description: 'Foderpaket 25 kg hönspellets', created_at: iso(14) },
    { id: demoId('tx'), user_id: DEMO_USER, date: dateKey(9), type: 'income', category: 'Äggförsäljning', amount: 420, description: '6 kartonger till grannen Lisa', created_at: iso(9) },
    { id: demoId('tx'), user_id: DEMO_USER, date: dateKey(5), type: 'income', category: 'Äggförsäljning', amount: 210, description: '3 kartonger på jobbet', created_at: iso(5) },
    { id: demoId('tx'), user_id: DEMO_USER, date: dateKey(2), type: 'expense', category: 'Strö', amount: -95, description: 'Halm till hönshuset', created_at: iso(2) },
  ];

  const feedRecords: DemoFeedRecord[] = [
    { id: demoId('feed'), user_id: DEMO_USER, date: dateKey(14), feed_type: 'Hönspellets', feed_category: null, brand: 'Alg Gutt', amount_kg: 25, cost: 289, notes: null, affiliate_product_id: null, created_at: iso(14) },
    { id: demoId('feed'), user_id: DEMO_USER, date: dateKey(1), feed_type: 'Skalgrus', feed_category: null, brand: null, amount_kg: 2, cost: 49, notes: 'Bra för skalkvaliteten', affiliate_product_id: null, created_at: iso(1) },
  ];

  const hatchings: DemoHatching[] = [
    {
      id: demoId('hatch'), user_id: DEMO_USER, start_date: dateKey(29),
      expected_hatch_date: dateKey(8), egg_count: 12, hatched_count: 9,
      status: 'completed', notes: '9 av 12 kläckta – 4 tuppar, 5 hönor',
      created_at: iso(29), updated_at: iso(8),
    },
    {
      id: demoId('hatch'), user_id: DEMO_USER, start_date: dateKey(8),
      expected_hatch_date: dateKey(-13), egg_count: 10, hatched_count: null,
      status: 'incubating', notes: 'Maran-ägg från Doris linje',
      created_at: iso(8), updated_at: iso(1),
    },
  ];

  const chores: DailyChoreWithCompletion[] = [
    { id: 'demo-chore-1', user_id: DEMO_USER, title: 'Fyll på vatten', description: null, is_default: true, recurrence: 'daily', next_due_at: null, reminder_enabled: false, reminder_hours_before: null, sort_order: 1, created_at: now, completed: true },
    { id: 'demo-chore-2', user_id: DEMO_USER, title: 'Morgonmat till flocken', description: null, is_default: true, recurrence: 'daily', next_due_at: null, reminder_enabled: false, reminder_hours_before: null, sort_order: 2, created_at: now, completed: true },
    { id: 'demo-chore-3', user_id: DEMO_USER, title: 'Samla ägg (eftermiddag)', description: null, is_default: true, recurrence: 'daily', next_due_at: null, reminder_enabled: false, reminder_hours_before: null, sort_order: 3, created_at: now, completed: false },
    { id: 'demo-chore-4', user_id: DEMO_USER, title: 'Stäng in hönsen för natten', description: null, is_default: true, recurrence: 'daily', next_due_at: null, reminder_enabled: false, reminder_hours_before: null, sort_order: 4, created_at: now, completed: false },
  ];

  const eggGoals: DemoEggGoal[] = [
    { id: demoId('goal'), user_id: DEMO_USER, period: 'weekly', target_count: 25, is_active: true, created_at: iso(20), updated_at: iso(20) },
  ];

  return { hens, eggs, healthLogs, transactions, feedRecords, hatchings, chores, eggGoals };
}

export const DEMO_TIP_TEXT =
  'Ljus gör underverk för värptakten – när dagarna blir kortare kan en timerstyrd lampa i hönshuset ge upp till en timme extra "dagsljus" på morgonen.';

export const DEMO_COACH = {
  intro: 'Veckan ser fin ut på Lillgården! Här är tre saker att hålla koll på:',
  advices: [
    {
      title: 'Stark värptakt – Blanka leder flocken',
      text: 'Blanka har värpt 6 av 7 dagar den här veckan. Leghorn är kända för det – belöna gärna med lite extra grönsaker.',
      type: 'pepp' as const,
    },
    {
      title: 'Doris dippade lite i veckan',
      text: 'Doris värpt gick ner för några dagar men är tillbaka nu. Vid längre dippar – kolla kvalster och se till att hon äter.',
      type: 'påminnelse' as const,
    },
    {
      title: 'Dags att fylla på foder snart',
      text: 'Med 5 hönor räcker en 25 kg-säck ungefär 4–5 veckor. Ni köpte senast för 14 dagar sedan – lägg gärna till i inköpslistan.',
      type: 'tips' as const,
    },
  ],
};

export const DEMO_ALERTS = {
  intro: null,
  alerts: [
    {
      key: 'demo-dip',
      title: 'Liten värpdipp för 6–8 dagar sedan',
      text: 'Doris och Greta värpte mindre under några dagar, men båda är tillbaka i normal takt nu. Ingen åtgärd behövs.',
      level: 'info' as const,
    },
  ],
};

export const DEMO_USER_PROFILE = {
  id: DEMO_USER,
  email: 'lisa@exempel.se',
  name: 'Lisa Andersson',
  is_premium: true,
  subscription_status: 'active',
  premium_type: 'paid' as const,
};
