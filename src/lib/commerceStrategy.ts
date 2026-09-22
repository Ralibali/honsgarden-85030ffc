export type CommerceCategory =
  | 'hus'
  | 'staengsel'
  | 'foder'
  | 'vatten'
  | 'klackning'
  | 'vaerme'
  | 'startset'
  | 'redskap'
  | 'tillskott'
  | string;

export const START_COST_REFERENCE = {
  startMinSek: 4_890,
  startMaxSek: 16_400,
  annualMinSek: 2_500,
  annualMaxSek: 4_900,
} as const;

export type SeasonalSignal = {
  categories: CommerceCategory[];
  weight: number;
  label: string;
};

/**
 * Research-backed seasonal commerce windows.
 * Month is 1-12. The values are ranking boosts, never hard sell rules.
 */
export function seasonalCommerceSignals(month: number): SeasonalSignal[] {
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(month)));
  const signals: SeasonalSignal[] = [];

  // Feb–Mar: hatching preparation.
  if (safeMonth === 2 || safeMonth === 3) {
    signals.push({
      categories: ['klackning'],
      weight: 45,
      label: 'kläcksäsongen närmar sig',
    });
  }

  // Mar–May: flock start / housing / fencing projects.
  if (safeMonth >= 3 && safeMonth <= 5) {
    signals.push({
      categories: ['hus', 'staengsel', 'startset'],
      weight: 40,
      label: 'vårens etablerings- och byggperiod',
    });
  }

  // May–Jun: holiday preparation and capacity.
  if (safeMonth === 5 || safeMonth === 6) {
    signals.push({
      categories: ['vatten', 'foder', 'hus'],
      weight: 30,
      label: 'semesterperioden närmar sig',
    });
  }

  // Jun–Aug: water access / practical maintenance. Health products are
  // deliberately not monetised by this helper.
  if (safeMonth >= 6 && safeMonth <= 8) {
    signals.push({
      categories: ['vatten', 'redskap'],
      weight: 20,
      label: 'sommarperioden',
    });
  }

  // Sep–Oct: winter preparation before first frost.
  if (safeMonth === 9 || safeMonth === 10) {
    signals.push({
      categories: ['vaerme', 'vatten', 'hus'],
      weight: 50,
      label: 'det är dags att vinterförbereda',
    });
  }

  // Nov–Jan: winter follow-up and higher feed demand.
  if (safeMonth === 11 || safeMonth === 12 || safeMonth === 1) {
    signals.push({
      categories: ['vaerme', 'vatten', 'foder'],
      weight: 30,
      label: 'det är vinterperiod',
    });
  }

  return signals;
}

export type FeedEstimate = {
  minKg: number;
  maxKg: number;
  days: number;
  henCount: number;
};

/**
 * The strategy report uses 100–150 g feed per hen/day.
 * Winter mode applies the report's +10–20% planning range.
 */
export function estimateFeedUse(
  henCount: number,
  days = 30,
  winter = false,
): FeedEstimate {
  const hens = Math.max(0, Math.trunc(henCount));
  const safeDays = Math.max(1, Math.trunc(days));

  const minDailyKg = hens * 0.1 * (winter ? 1.1 : 1);
  const maxDailyKg = hens * 0.15 * (winter ? 1.2 : 1);

  return {
    minKg: Number((minDailyKg * safeDays).toFixed(1)),
    maxKg: Number((maxDailyKg * safeDays).toFixed(1)),
    days: safeDays,
    henCount: hens,
  };
}

export function estimateBagDurationDays(
  henCount: number,
  bagKg: number,
): { minDays: number; maxDays: number } | null {
  const hens = Math.max(0, Math.trunc(henCount));
  const bag = Number(bagKg);
  if (!hens || !Number.isFinite(bag) || bag <= 0) return null;

  // More feed/day => shorter duration.
  return {
    minDays: Math.max(1, Math.floor(bag / (hens * 0.15))),
    maxDays: Math.max(1, Math.ceil(bag / (hens * 0.1))),
  };
}

export type StartCostInput = {
  hens: number;
  henPriceSek: number;
  housingSek: number;
  fencingSek: number;
  equipmentSek: number;
  firstFeedAndBeddingSek: number;
  otherSek: number;
};

export function calculateStartCost(input: StartCostInput) {
  const hens = Math.max(0, Math.trunc(input.hens));
  const animalCost = hens * Math.max(0, input.henPriceSek);
  const total =
    animalCost +
    Math.max(0, input.housingSek) +
    Math.max(0, input.fencingSek) +
    Math.max(0, input.equipmentSek) +
    Math.max(0, input.firstFeedAndBeddingSek) +
    Math.max(0, input.otherSek);

  return {
    animalCost,
    total,
    insideResearchRange:
      total >= START_COST_REFERENCE.startMinSek &&
      total <= START_COST_REFERENCE.startMaxSek,
  };
}
