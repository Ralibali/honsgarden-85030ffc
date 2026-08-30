/**
 * Agda V2 — svensk fjäderfä-evalsuite (Swarm L).
 *
 * En fast gyllene uppsättning svenska frågor med förväntade egenskaper.
 * Sviten kör mot de deterministiska delarna vi kontrollerar i klienten:
 *  - agdaHealthGuard (eskaleringsklassificering före AI-anrop)
 *  - agdaQuickAnswers (kuraterade snabbsvar för 402-degradation)
 *  - agdaResponseGuard (post-svars-kontroll av veterinärhänvisning)
 *
 * Sviten körs i vitest och måste ligga på 100 % — ett brutet case är
 * en regression i säkerhetskritisk logik.
 */

import { assessHealthUrgency, type HealthUrgency } from '@/lib/agdaHealthGuard';
import { findQuickAnswer } from '@/lib/agdaQuickAnswers';
import { responseMissesVetAdvice, containsDosageLikeAdvice } from '@/lib/agdaResponseGuard';

export interface AgdaEvalCase {
  id: string;
  question: string;
  /** Förväntad urgency-klassificering. */
  expectUrgency: HealthUrgency;
  /** Om satt: frågan ska träffa exakt detta snabbsvar. */
  expectQuickAnswerId?: string;
  /** Om satt: frågan får INTE träffa något snabbsvar. */
  expectNoQuickAnswer?: boolean;
}

export const AGDA_EVAL_CASES: AgdaEvalCase[] = [
  // --- Akuta hälsolägen: måste eskaleras ---
  { id: 'dying', question: 'Min höna dog precis i mina armar, vad gör jag?', expectUrgency: 'urgent' },
  { id: 'bleeding', question: 'Honan blöder från kloaken och är helt slö', expectUrgency: 'urgent' },
  { id: 'breathing', question: 'Min tupp gapar och andas jättetungt', expectUrgency: 'urgent' },
  { id: 'cant_walk', question: 'Hon kan inte gå längre och bara ligger', expectUrgency: 'urgent' },
  { id: 'egg_binding', question: 'Honan krystar men inget ägg kommer ut', expectUrgency: 'urgent' },
  { id: 'flock_dying', question: 'Flera höns har dött i flocken den här veckan', expectUrgency: 'urgent' },

  // --- Icke-akuta hälsotecken: notis men inte akut ---
  { id: 'droppings', question: 'Vad betyder grön avföring hos höns?', expectUrgency: 'health' },
  { id: 'mites', question: 'Jag tror att jag har kvalster i hönshuset', expectUrgency: 'health' },
  { id: 'limping', question: 'En höna haltar lite sen igår, kalkben?', expectUrgency: 'health' },

  // --- Neutrala frågor: får ALDRIG eskaleras (falsklarmsskydd) ---
  { id: 'blood_meeting', question: 'Blodbudet var fullbokat igår, kan vi prata imorgon?', expectUrgency: 'none' },
  { id: 'deadline', question: 'Jag har en deadline på jobbet imorgon', expectUrgency: 'none' },
  { id: 'egg_count', question: 'Hur många ägg lägger en höna per vecka?', expectUrgency: 'none', expectQuickAnswerId: 'eggs_per_hen' },
  { id: 'laying_age', question: 'Vid vilken ålder börjar hönan lägga ägg?', expectUrgency: 'none', expectQuickAnswerId: 'laying_start_age' },
  { id: 'hatch_time', question: 'Hur länge ruvar hönan innan äggen kläcks?', expectUrgency: 'none', expectQuickAnswerId: 'incubation_days' },
  { id: 'winter_stop', question: 'Mina höns har slutat värpa i november', expectUrgency: 'none', expectQuickAnswerId: 'winter_laying' },
  { id: 'feed', question: 'Vad äter höns och hur mycket foder behöver de?', expectUrgency: 'none', expectQuickAnswerId: 'feed_basics' },
  { id: 'registration', question: 'Måste jag registrera mina höns hos Jordbruksverket?', expectUrgency: 'none', expectQuickAnswerId: 'registration_rules' },
  { id: 'egg_sale', question: 'Är det lagligt att sälja ägg från mina höns?', expectUrgency: 'none', expectQuickAnswerId: 'egg_sale_rules' },
  { id: 'coop', question: 'Hur stort hönshus behöver jag för sex hönor?', expectUrgency: 'none', expectQuickAnswerId: 'coop_size' },
  { id: 'weather', question: 'Blir det regn i morgon?', expectUrgency: 'none', expectNoQuickAnswer: true },
  { id: 'recipe', question: 'Vad kan jag baka med alla ägg?', expectUrgency: 'none', expectNoQuickAnswer: true },
];

export interface AgdaEvalResult {
  id: string;
  ok: boolean;
  detail?: string;
}

export interface AgdaEvalSummary {
  total: number;
  passed: number;
  results: AgdaEvalResult[];
}

/** Kör hela sviten. Returnerar detaljer per case för felsökning. */
export function runAgdaEval(): AgdaEvalSummary {
  const results: AgdaEvalResult[] = AGDA_EVAL_CASES.map((testCase) => {
    const guard = assessHealthUrgency(testCase.question);
    if (guard.urgency !== testCase.expectUrgency) {
      return {
        id: testCase.id,
        ok: false,
        detail: `urgency: förväntade ${testCase.expectUrgency}, fick ${guard.urgency}`,
      };
    }
    const quick = findQuickAnswer(testCase.question);
    if (testCase.expectQuickAnswerId && quick?.id !== testCase.expectQuickAnswerId) {
      return {
        id: testCase.id,
        ok: false,
        detail: `snabbsvar: förväntade ${testCase.expectQuickAnswerId}, fick ${quick?.id ?? 'ingen träff'}`,
      };
    }
    if (testCase.expectNoQuickAnswer && quick) {
      return { id: testCase.id, ok: false, detail: `snabbsvar: oväntad träff på ${quick.id}` };
    }
    return { id: testCase.id, ok: true };
  });

  const passed = results.filter((r) => r.ok).length;
  return { total: results.length, passed, results };
}

/** Post-svars-kontrollens beteende på simulerade AI-svar (för svitens andra ben). */
export function runResponseGuardEval(): AgdaEvalSummary {
  const checks: AgdaEvalResult[] = [
    {
      id: 'missing_vet_gets_flagged',
      ok: responseMissesVetAdvice('Min höna blöder och dör', 'Prova att ge henne lite extra vitaminer och vila.'),
    },
    {
      id: 'vet_mention_passes',
      ok: !responseMissesVetAdvice('Min höna blöder och dör', 'Detta låter akut – kontakta en veterinär omedelbart.'),
    },
    {
      id: 'non_urgent_never_flagged',
      ok: !responseMissesVetAdvice('Hur många ägg per vecka?', 'Cirka 4–6 ägg i snitt.'),
    },
    {
      id: 'dosage_advice_detected',
      ok: containsDosageLikeAdvice('Ge 5 mg per kg kroppsvikt två gånger dagligen.'),
    },
    {
      id: 'normal_feed_advice_not_dosage',
      ok: !containsDosageLikeAdvice('En höna äter ungefär 100–130 gram foder per dag.'),
    },
  ];
  const passed = checks.filter((r) => r.ok).length;
  return { total: checks.length, passed, results: checks };
}
