/**
 * Helpers för att klassificera höns konsekvent i hela appen.
 *
 * hen_type-värden:
 *  - 'hen'     = vuxen värphöna (räknas i produktionsstatistik)
 *  - 'pullet'  = unghöna som ännu inte börjat värpa (visas men exkluderas från snitt)
 *  - 'rooster' = tupp (exkluderas alltid från äggstatistik)
 */
export const HEN_TYPES = {
  HEN: 'hen',
  PULLET: 'pullet',
  ROOSTER: 'rooster',
} as const;

export type HenTypeValue = (typeof HEN_TYPES)[keyof typeof HEN_TYPES];

export interface HenLike {
  is_active?: boolean | null;
  hen_type?: string | null;
  birth_date?: string | null;
}

/** Räknas hönan med i "ägg per höna"-snittet? */
export function isLayingHen(h: HenLike): boolean {
  if (!h.is_active) return false;
  // Saknad hen_type är gamla data → behandla som värphöna.
  const t = h.hen_type ?? HEN_TYPES.HEN;
  return t === HEN_TYPES.HEN;
}

export function isPullet(h: HenLike): boolean {
  return (h.hen_type ?? '') === HEN_TYPES.PULLET;
}

export function isRooster(h: HenLike): boolean {
  return (h.hen_type ?? '') === HEN_TYPES.ROOSTER;
}

/** Total ålder i veckor (eller null om inget födelsedatum). */
export function ageInWeeks(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

/** En unghöna betraktas som "mogen att börja värpa" efter ~18 veckor. */
export function isPulletReadyToLay(h: HenLike): boolean {
  if (!isPullet(h)) return false;
  const w = ageInWeeks(h.birth_date);
  return w != null && w >= 18;
}

/** Etikett att visa på höns-kort. */
export function henTypeLabel(t?: string | null): string {
  switch (t) {
    case HEN_TYPES.ROOSTER: return 'Tupp';
    case HEN_TYPES.PULLET: return 'Unghöna';
    default: return 'Höna';
  }
}

export function henTypeEmoji(t?: string | null): string {
  switch (t) {
    case HEN_TYPES.ROOSTER: return '🐓';
    case HEN_TYPES.PULLET: return '🐣';
    default: return '🐔';
  }
}
