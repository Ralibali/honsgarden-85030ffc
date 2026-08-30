/**
 * Canonical plans / capabilities / entitlements layer (swarm T).
 *
 * One place that answers "what can this user do?" — an adapter OVER the
 * existing premium resolution (premiumStatus.ts / premiumEntry.ts /
 * useAuth.premium_type), not a rewrite of the 62 call sites. New code
 * should check capabilities; old code keeps working unchanged.
 *
 * COMMERCIAL INVARIANTS (V2 brief, non-negotiable):
 *  - Public pricing is frozen: Free 0 kr, Plus 39 kr/mån, 299 kr/år.
 *  - No lifetime plan is launched automatically. The 'lifetime' premium
 *    type already exists in the data model and must keep mapping to full
 *    access (grandfathered), but it is NOT part of the public catalog.
 *  - Stripe prices are never changed from this layer. The catalog carries
 *    display amounts only; checkout uses server-side price IDs.
 */

import type { PremiumType } from './premiumStatus';

/* ---------------------------------- plans ---------------------------------- */

export type PublicPlanId = 'free' | 'plus_monthly' | 'plus_yearly';

export interface PlanDefinition {
  id: PublicPlanId;
  /** Visningsnamn (svenska, publikt). */
  name: string;
  /** Pris i hela SEK. 0 = gratis. */
  priceSek: number;
  billing: 'none' | 'monthly' | 'yearly';
  /** Vilken premium-nivå planen mappar till i befintlig datamodell. */
  mapsToPremiumType: PremiumType;
}

/**
 * Publik plankatalog. Siffrorna speglar nuvarande publika priser och får
 * inte ändras utan ett explicit kommersiellt beslut (se V2-briefen).
 */
export const PLANS: Readonly<Record<PublicPlanId, PlanDefinition>> = {
  free: { id: 'free', name: 'Gratis', priceSek: 0, billing: 'none', mapsToPremiumType: 'free' },
  plus_monthly: { id: 'plus_monthly', name: 'Plus månadsvis', priceSek: 39, billing: 'monthly', mapsToPremiumType: 'paid' },
  plus_yearly: { id: 'plus_yearly', name: 'Plus årsvis', priceSek: 299, billing: 'yearly', mapsToPremiumType: 'paid' },
} as const;

/** Årspris / 12 för "motsvarar X kr/mån"-texter. Beräknat, aldrig hårdkodat. */
export const PLUS_YEARLY_MONTHLY_EQUIVALENT_SEK = Math.round((PLANS.plus_yearly.priceSek / 12) * 100) / 100;

/* ------------------------------- capabilities ------------------------------ */

/**
 * Funktionsnycklar som nya feature-grindar ska använda i stället för
 * råa isPremium-checkar. 'future_*' finns för flaggade experiment och
 * mappas aldrig på automatik till en betalplan.
 */
export const CAPABILITIES = [
  'hen_limit', // obegränsat antal höns (fri plan har en gräns)
  'agda_access', // Agda AI-chat
  'advanced_analytics', // avancerad statistik/benchmarks
  'advanced_reminders', // smarta/flervägspåminnelser
  'reports', // smarta rapporter/PDF
  'hatch_tracking', // kläckningsuppföljning
  'seller_features', // Agdas Bod Pro (försäljning, kunder, export)
  'future_native_entitlements', // reserverat för native-köp (IAP)
  'future_beta_features', // reserverat för flaggade betan
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** Kapabiliteter som kräver Plus-nivå (paid/trial/lifetime). */
const PLUS_CAPABILITIES: ReadonlySet<Capability> = new Set([
  'hen_limit',
  'agda_access',
  'advanced_analytics',
  'advanced_reminders',
  'reports',
  'hatch_tracking',
  'seller_features',
]);

/**
 * Kapabiliteter per premium-nivå. 'trial' ger full Plus-access under
 * provperioden; 'lifetime' är grandfathered full access men lanseras inte.
 */
export function capabilitiesForPremiumType(premiumType: PremiumType | null | undefined): ReadonlySet<Capability> {
  switch (premiumType) {
    case 'paid':
    case 'trial':
    case 'lifetime':
      return PLUS_CAPABILITIES;
    default:
      return new Set<Capability>();
  }
}

/** Minimiprofil – både UserProfile (premium_type) och rå typ fungerar. */
export interface EntitlementSubject {
  premium_type?: PremiumType | null;
}

export function hasCapability(subject: EntitlementSubject | PremiumType | null | undefined, capability: Capability): boolean {
  const premiumType: PremiumType | null | undefined =
    typeof subject === 'string' || subject == null ? (subject as PremiumType | null | undefined) : subject.premium_type;
  if (capabilitiesForPremiumType(premiumType).has(capability)) return true;
  return getFlaggedCapabilities().has(capability);
}

/* ------------------------------ feature flags ------------------------------ */

/**
 * Flaggbaserade kapabiliteter. Aktiveras via VITE_BETA_CAPABILITIES
 * (kommaseparerad lista, t.ex. "future_beta_features"). Tomt som standard —
 * inga betafunktioner är aktiva om inte flaggan sätts explicit.
 */
export function getFlaggedCapabilities(): ReadonlySet<Capability> {
  const raw = (import.meta.env?.VITE_BETA_CAPABILITIES as string | undefined) ?? '';
  const enabled = new Set<Capability>();
  for (const token of raw.split(',').map((t) => t.trim()).filter(Boolean)) {
    if ((CAPABILITIES as readonly string[]).includes(token)) {
      enabled.add(token as Capability);
    }
  }
  return enabled;
}

/* ------------------------------ pricing display ---------------------------- */

/** Formaterat pris för publik visning, t.ex. "39 kr/mån". */
export function formatPlanPrice(plan: PlanDefinition): string {
  if (plan.billing === 'none') return '0 kr';
  return plan.billing === 'monthly' ? `${plan.priceSek} kr/mån` : `${plan.priceSek} kr/år`;
}
