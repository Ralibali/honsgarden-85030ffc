/**
 * Agda health-escalation guard (swarm A).
 *
 * Deterministic first line of defence for the AI chat: before/while the
 * model answers, we classify the user's message for health urgency and show
 * a fixed, non-AI safety notice when the flock may need a veterinarian.
 * The guard never blocks the chat — it adds a safety layer the model
 * output cannot talk its way out of.
 *
 * Pure string matching, no AI, no network — safe to run per keystroke.
 */

export type HealthUrgency = 'none' | 'health' | 'urgent';

export interface HealthGuardResult {
  urgency: HealthUrgency;
  /** Normaliserade nyckelord som träffade (för telemetri/debug). */
  matched: string[];
}

/**
 * Ordgränser måste hantera å/ä/ö: JS \b räknar bara ASCII-bokstäver som
 * ordtecken, så "gå\b" träffar aldrig. Vi använder unicode-lookarounds mot
 * \p{L} i stället — då träffar "blod" inte "blodbud", och "dö" inte "dörr".
 */
const LB = '(?<![\\p{L}\\p{N}])';
const RB = '(?![\\p{L}\\p{N}])';
const rx = (body: string): RegExp => new RegExp(`${LB}(?:${body})${RB}`, 'iu');
const L = '[\\p{L}]'; // unicode-bokstav inne i mönster

/** Akuta signaler: höna/flock kan behöva veterinär skyndsamt. */
const URGENT_PATTERNS: RegExp[] = [
  rx('dö|dör|dog|dött|död|dödsfall'),
  rx(`avliva|avlivning`),
  rx(`blöder|blod|blodig${L}*`),
  rx('gapar'),
  rx('andas\\s+(tungt|konstigt|snabbt)'),
  rx(`andningsbesvär${L}*`),
  rx('kräks'),
  rx('blå\\s+(kam|haka)'),
  rx(`svullen|svullnad`),
  rx(`(kan|orkar)\\s+inte\\s+(gå|stå|res(a)?\\s+sig)`),
  rx('(äter|dricker)\\s+inte'),
  rx(`brut${L}*\\s+(ben|vinge)${L}*`),
  rx(`vrick${L}*`),
  rx('krystar'),
  rx(`äggledar${L}*`),
  rx(`hela\\s+flocken${L}*\\s+(är|verkar|verkar vara|blivit)?\\s*(sju${L}*|dålig${L}*|slö${L}*)`),
  rx(`(flera|två|tre|fyra)\\s+(höns|fåglar)${L}*\\s+(har|är)?\\s*(dött|dött|sjuka|dåliga)`),
];

/** Hälsorelaterat men inte nödvändigtvis akut. */
const HEALTH_PATTERNS: RegExp[] = [
  rx(`sjuk${L}*|symptom|veterinär${L}*`),
  rx(`avföring${L}*|diarré${L}*`),
  rx('kvalster|koccidios|rödsjuka|kalkben'),
  rx(`luftväg${L}*|nys${L}*|rossl${L}*`),
  rx(`mask${L}*|spolmask${L}*`),
  rx(`slö${L}*|uppburrad|hängig${L}*`),
  rx(`pickar\\s+(sig|på\\s+sig)`),
  rx(`tappar\\s+fjädrar|fjäder${L}*\\s+(tappar|faller\\s+av)`),
  rx(`sår|knölar|värtr`),
];

const collectMatches = (text: string, patterns: RegExp[]): string[] =>
  patterns.filter((p) => p.test(text)).map((p) => p.source);

export function assessHealthUrgency(message: string): HealthGuardResult {
  const text = (message || '').trim();
  if (!text) return { urgency: 'none', matched: [] };
  const urgent = collectMatches(text, URGENT_PATTERNS);
  if (urgent.length > 0) return { urgency: 'urgent', matched: urgent };
  const health = collectMatches(text, HEALTH_PATTERNS);
  if (health.length > 0) return { urgency: 'health', matched: health };
  return { urgency: 'none', matched: [] };
}

/** Fast, mänskligt skriven eskalationstext — aldrig AI-genererad. */
export const HEALTH_ESCALATION_NOTICE =
  'Det här låter som ett hälsoproblem. Vid akuta symptom – som andningsbesvär, blod i avföringen, plötsliga dödsfall eller en höna som inte kan stå – kontakta veterinär direkt. Agdas råd ersätter aldrig veterinärens bedömning.';

export const HEALTH_GENERAL_NOTICE =
  'Vid oro för sjukdom i flocken, kontakta alltid veterinär – Agdas råd ersätter inte veterinärens bedömning.';
