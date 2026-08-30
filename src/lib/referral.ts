/**
 * Värvningsloop (Swarm M).
 *
 * Rena hjälpfunktioner för värvningsflödet: kodnormalisering,
 * token-dispatch och delningslänkar som ALDRIG pekar på preview-domäner.
 * Analys-händelserna ('Referral Link Shared' / 'Referral Signup')
 * avfyras av anroparna — denna modul har inga sidoeffekter.
 */

/** Värvningskoder är korta alfanumeriska tokens (skiljs från UUID-omdömen i /r/:token). */
export function isReferralCode(token: string): boolean {
  return /^[A-Za-z0-9]{4,12}$/.test(token) && !token.includes('-');
}

/** Normaliserar användarinmatad kod: versaler, endast A–Z0–9. */
export function normalizeReferralCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const PROD_HOST_PATTERN = /honsgarden\.(se|app)$/i;
const FALLBACK_ORIGIN = 'https://honsgarden.se';

/**
 * Bygger delningslänken. Pekar alltid på produktionsdomänen — en länk
 * delad från en preview-/lokal miljö ska ändå landa på honsgarden.se.
 */
export function buildReferralShareUrl(code: string, hostname: string, origin: string): string {
  if (!code) return '';
  const base = PROD_HOST_PATTERN.test(hostname) ? origin : FALLBACK_ORIGIN;
  return `${base}/r/${code}`;
}
