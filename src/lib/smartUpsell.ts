/**
 * Motor för smarta premium-triggers.
 *
 * Filosofi: visa aldrig en slumpmässig reklambanner. Visa ett
 * personligt erbjudande i stunden då användaren själv märker att
 * datan de byggt upp skulle vara värd mer. Spärrat, diskret,
 * och alltid möjligt att stänga.
 */

export interface UpsellSignals {
  streak: number;        // dagar i rad med loggning
  totalEggs: number;     // totalt antal loggade ägg
  henCount: number;      // antal aktiva hönor
  isPremium: boolean;
}

export interface UpsellState {
  lastShownAt: string | null;   // ISO-datum då kortet senast visades
  dismissedAt: string | null;   // ISO-datum då användaren stängde kortet
}

export interface UpsellMessage {
  trigger: 'streak_momentum' | 'data_gold' | 'habit_forming' | 'cost_per_egg';
  /** A/B-testvariant – tilldelas deterministiskt per användare + trigger */
  variant: 'A' | 'B';
  emoji: string;
  title: string;
  body: string;
  cta: string;
}

/**
 * Stabil A/B-tilldelning: samma användare får alltid samma variant
 * för samma trigger (enkel sträng-hash – kryptografisk styrka behövs ej).
 */
export function assignVariant(userId: string | undefined, trigger: string): 'A' | 'B' {
  if (!userId) return 'A';
  let hash = 0;
  const s = `${userId}:${trigger}`;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash % 2 === 0 ? 'A' : 'B';
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minst 3 dagar mellan visningar, 7 dagar efter att användaren stängt kortet. */
export const COOLDOWN_AFTER_SHOWN_DAYS = 3;
export const COOLDOWN_AFTER_DISMISS_DAYS = 7;

function daysSince(iso: string | null, now: Date): number {
  if (!iso) return Infinity;
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

export function isUpsellAllowed(state: UpsellState, now: Date = new Date()): boolean {
  if (daysSince(state.dismissedAt, now) < COOLDOWN_AFTER_DISMISS_DAYS) return false;
  if (daysSince(state.lastShownAt, now) < COOLDOWN_AFTER_SHOWN_DAYS) return false;
  return true;
}

/**
 * Välj det mest relevanta budskapet utifrån engagemangssignaler.
 * Högst prioriterad trigger vinner; null om ingen trigger nåtts.
 */
export function pickUpsell(signals: UpsellSignals, userId?: string): UpsellMessage | null {
  if (signals.isPremium) return null;

  if (signals.streak >= 7) {
    const variant = assignVariant(userId, 'streak_momentum');
    return {
      trigger: 'streak_momentum',
      variant,
      emoji: '🔥',
      title: `${signals.streak} dagar i rad – imponerande!`,
      body: variant === 'A'
        ? 'Du har byggt en riktig vana. Med Plus förvandlas dina loggar till prognoser, avvikelsevarningar och personliga veckorapporter.'
        : 'Varje dag du loggar blir analysen vassare. Plus ger dig veckorapporterna och varningarna automatiskt.',
      cta: 'Se vad Plus ger dig',
    };
  }

  if (signals.totalEggs >= 100) {
    const variant = assignVariant(userId, 'data_gold');
    return {
      trigger: 'data_gold',
      variant,
      emoji: '🥚',
      title: `${signals.totalEggs} ägg loggade – det är guld värt!`,
      body: variant === 'A'
        ? 'Du sitter på en skatt av data. Plus räknar ut vad varje ägg kostar att producera och vilka hönor som bär flocken.'
        : `Det är ${signals.totalEggs} datapunkter om just DIN flock. Plus omvandlar dem till kostnad per ägg och ditt bästa säljpris.`,
      cta: 'Förvandla datan till insikter',
    };
  }

  if (signals.streak >= 3) {
    const variant = assignVariant(userId, 'habit_forming');
    return {
      trigger: 'habit_forming',
      variant,
      emoji: '📈',
      title: variant === 'A' ? 'Nu börjar det likna något!' : `Du är i flyt – ${signals.streak} dagar!`,
      body: variant === 'A'
        ? `${signals.streak} dagars loggning ger redan mönster. Med Plus ser du trender, dagsljusets effekt och vad som påverkar värpen.`
        : 'Fortsätt så – och låt Plus göra analysen åt dig: trender, dagsljus och avvikelser, varje vecka.',
      cta: 'Utforska Plus',
    };
  }

  if (signals.totalEggs >= 30 && signals.henCount > 0) {
    const variant = assignVariant(userId, 'cost_per_egg');
    return {
      trigger: 'cost_per_egg',
      variant,
      emoji: '💡',
      title: 'Vad kostar egentligen ett ägg?',
      body: variant === 'A'
        ? `Med ${signals.henCount} ${signals.henCount === 1 ? 'höna' : 'hönor'} och ${signals.totalEggs} loggade ägg kan Plus räkna ut exakt vad varje ägg kostar dig – och vad du skulle ta betalt.`
        : 'Foder, strö, tid – Plus räknar på allt och visar exakt vad ett ägg kostar. Och vad du bör ta betalt.',
      cta: 'Räkna på mina ägg',
    };
  }

  return null;
}

/** Samla allt: får vi visa, och i så fall vad? */
export function evaluateUpsell(
  signals: UpsellSignals,
  state: UpsellState,
  now: Date = new Date(),
  userId?: string,
): UpsellMessage | null {
  if (!isUpsellAllowed(state, now)) return null;
  return pickUpsell(signals, userId);
}

// ---- localStorage-hantering (per användare) ----

const STORAGE_PREFIX = 'honsgarden-smart-upsell';

export function loadUpsellState(userId: string): UpsellState {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}-${userId}`);
    if (!raw) return { lastShownAt: null, dismissedAt: null };
    const parsed = JSON.parse(raw) as Partial<UpsellState>;
    return { lastShownAt: parsed.lastShownAt ?? null, dismissedAt: parsed.dismissedAt ?? null };
  } catch {
    return { lastShownAt: null, dismissedAt: null };
  }
}

export function saveUpsellState(userId: string, state: UpsellState): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}-${userId}`, JSON.stringify(state));
  } catch {
    /* localStorage kan vara spärrat – då faller vi tillbaka på att visa kortet */
  }
}
