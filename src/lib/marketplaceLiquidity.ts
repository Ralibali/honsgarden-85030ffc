/**
 * Marknadsplats-likviditet (Swarm N).
 *
 * Ren, deterministisk tillståndsmaskin över utbud per region.
 * Används för intern/admin-synlighet av marknadsplatsens hälsa —
 * aldrig för att fabricera statistik eller för otillåten utåtkommunikation.
 */

export type LiquidityState =
  | 'NO_SUPPLY' // inget utbud alls
  | 'BUILDING'  // första annonserna på plats
  | 'ACTIVE'    // reell handelsnivå
  | 'STRONG';   // etablerad likviditet med kontaktaktivitet

export const LIQUIDITY_LABELS: Record<LiquidityState, string> = {
  NO_SUPPLY: 'Inget utbud',
  BUILDING: 'Byggs upp',
  ACTIVE: 'Aktiv',
  STRONG: 'Stark',
};

export const LIQUIDITY_THRESHOLDS = {
  /** Minsta antal aktiva annonser för BUILDING. */
  buildingMinListings: 1,
  /** Minsta antal aktiva annonser för ACTIVE. */
  activeMinListings: 3,
  /** Minsta antal aktiva annonser för STRONG. */
  strongMinListings: 5,
  /** Minsta antal köparkontakter senaste 30 dagarna för STRONG. */
  strongMinContacts30d: 5,
} as const;

export function getLiquidityState(activeListings: number, contacts30d: number): LiquidityState {
  if (activeListings < LIQUIDITY_THRESHOLDS.buildingMinListings) return 'NO_SUPPLY';
  if (activeListings < LIQUIDITY_THRESHOLDS.activeMinListings) return 'BUILDING';
  if (
    activeListings >= LIQUIDITY_THRESHOLDS.strongMinListings &&
    contacts30d >= LIQUIDITY_THRESHOLDS.strongMinContacts30d
  ) {
    return 'STRONG';
  }
  return 'ACTIVE';
}

export interface RegionLiquidity {
  region: string;
  activeListings: number;
  contacts30d: number;
  state: LiquidityState;
}

interface ListingLike {
  region?: string | null;
  status?: string | null;
}

interface ContactLike {
  region?: string | null;
}

/**
 * Bygger en per-region-vy av likviditet. Endast aktiva annonser räknas
 * (status null/okänd behandlas som aktiv för bakåtkompatibilitet).
 * Kontakter utan region kan inte attribueras och ignoreras.
 */
export function buildRegionLiquidity(listings: ListingLike[], contacts30d: ContactLike[] = []): RegionLiquidity[] {
  const byRegion = new Map<string, { activeListings: number; contacts30d: number }>();

  for (const listing of listings) {
    const region = listing.region?.trim();
    if (!region) continue;
    const status = (listing.status ?? 'active').toLowerCase();
    if (status !== 'active') continue;
    const entry = byRegion.get(region) ?? { activeListings: 0, contacts30d: 0 };
    entry.activeListings += 1;
    byRegion.set(region, entry);
  }

  for (const contact of contacts30d) {
    const region = contact.region?.trim();
    if (!region) continue;
    const entry = byRegion.get(region) ?? { activeListings: 0, contacts30d: 0 };
    entry.contacts30d += 1;
    byRegion.set(region, entry);
  }

  return Array.from(byRegion.entries())
    .map(([region, { activeListings, contacts30d: contacts }]) => ({
      region,
      activeListings,
      contacts30d: contacts,
      state: getLiquidityState(activeListings, contacts),
    }))
    .sort((a, b) => b.activeListings - a.activeListings || a.region.localeCompare(b.region, 'sv'));
}

export interface LiquiditySummary {
  regions: number;
  noSupply: number;
  building: number;
  active: number;
  strong: number;
}

export function summarizeLiquidity(view: RegionLiquidity[]): LiquiditySummary {
  const summary: LiquiditySummary = { regions: view.length, noSupply: 0, building: 0, active: 0, strong: 0 };
  for (const row of view) {
    if (row.state === 'NO_SUPPLY') summary.noSupply += 1;
    else if (row.state === 'BUILDING') summary.building += 1;
    else if (row.state === 'ACTIVE') summary.active += 1;
    else summary.strong += 1;
  }
  return summary;
}
