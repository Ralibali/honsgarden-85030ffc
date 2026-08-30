/**
 * Agda V2 — post-svars-säkerhetskontroll (Swarm L).
 *
 * AI-svaret strömmas först; direkt efteråt körs denna deterministiska
 * kontroll. Om en brådskande hälsfråga besvarats UTAN att veterinär
 * nämns kompletteras svaret med den fasta eskaleringsnotisen.
 *
 * Kontrollen tar aldrig bort innehåll — den kompletterar bara.
 */

import { assessHealthUrgency, HEALTH_ESCALATION_NOTICE } from '@/lib/agdaHealthGuard';

const VET_MENTION = /veterinär|djursjukhus|djurläkare/iu;

/**
 * Sant om frågan är akut hälsorelaterad men svaret saknar
 * veterinär-hänvisning.
 */
export function responseMissesVetAdvice(question: string, answer: string): boolean {
  if (!answer || !answer.trim()) return false;
  const guard = assessHealthUrgency(question);
  if (guard.urgency !== 'urgent') return false;
  return !VET_MENTION.test(answer);
}

/**
 * Returnerar svaret kompletterat med eskaleringsnotisen om den saknas,
 * annars oförändrat.
 */
export function ensureVetEscalation(question: string, answer: string): string {
  if (!responseMissesVetAdvice(question, answer)) return answer;
  return `${answer}\n\n---\n\n${HEALTH_ESCALATION_NOTICE}`;
}

/**
 * Upptäcker svar som ser ut att ordinera läkemedelsdoser — ett brott mot
 * Agdas systemregler. Används av eval-sviten (och kan larma i loggen),
 * men censurerar aldrig svaret i sig.
 */
export function containsDosageLikeAdvice(answer: string): boolean {
  return /\d+\s*(mg|ml|milligram|milliliter)\s*( per |\/\s*(kg|höna|kilo))/iu.test(answer)
    || /dosera\s+\d/iu.test(answer);
}
