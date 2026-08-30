/**
 * Agda V2 — deterministiska snabbsvar (Swarm L).
 *
 * Ett litet, kuraterat register över vanliga frågor med fast, mänskligt
 * skrivna svar. Används i två lägen:
 *  1. Graceful degradation: om AI-tjänsten är nere eller krediterna slut
 *     (402) kan Agda ändå svara på de vanligaste frågorna.
 *  2. Eval-sviten verifierar att varje snabbsvar faktiskt träffar sin
 *     avsedda fråga.
 *
 * Svaren är generella och icke-medicinska. Hälsofrågor hanteras av
 * agdaHealthGuard + veterinär-eskalation, aldrig av snabbsvar.
 */

export interface AgdaQuickAnswer {
  id: string;
  /** Normaliserade nyckelfraser — träff om någon ingår i frågan. */
  phrases: string[];
  answer: string;
  /** Valfri intern länk för fördjupning. */
  link?: { href: string; label: string };
}

/** Normaliserar svensk frågetext: gemener, åäö-diacritik av, skiljetecken bort. */
export function normalizeQuestion(text: string): string {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const AGDA_QUICK_ANSWERS: AgdaQuickAnswer[] = [
  {
    id: 'eggs_per_hen',
    phrases: ['hur manga agg', 'hur mycket agger', 'agg per dag', 'agg per vecka', 'hur ofta varper'],
    answer: 'En värphöna i hobbys flock lägger i snitt cirka 4–6 ägg per vecka under värpsäsongen – alltså ungefär ett ägg varannan dag. Ras, ålder, årstid och foder spelar stor roll, och på vintern är det normalt att värpningen sjunker eller pausar helt.',
  },
  {
    id: 'laying_start_age',
    phrases: ['nar borjar', 'hur gammal', 'vilken alder borjar', 'borjar lagga agg', 'borjar varpa'],
    answer: 'De flesta hönor börjar värpa vid cirka 18–24 veckors ålder, men det varierar med ras och årstid. Lantraser tar ofta lite längre tid än värphybrider. Ett tecken på att värpningen närmar sig är att hönorna blir röda i kam och ansikte och börjar undersöka redeplatser.',
  },
  {
    id: 'incubation_days',
    phrases: ['hur lange ruvar', 'klackn', 'ruvningstid', 'hur manga dagar', 'nar klack'],
    answer: 'Hönsägg kläcks normalt efter cirka 21 dagars ruvning. Viktiga milstolpar är lysning omkring dag 7 och att sluta vända äggen cirka dag 18. Räkna ut din exakta tidplan med vår kläckningskalkylator.',
    link: { href: '/verktyg/klackningskalkylator', label: 'Öppna kläckningskalkylatorn' },
  },
  {
    id: 'winter_laying',
    phrases: ['varper inte', 'slutat varpa', 'inga agg', 'farre agg', 'varfor inga agg'],
    answer: 'Den vanligaste orsaken till minskad värpning är kortare dagsljus – särskilt november till mars. Det är helt normalt och inget fel på hönorna. Andra vanliga orsaker är ruggning, ålder, stress eller byte av foder. Om hönan dessutom verkar sjuk (slö, uppburrad, äter inte) bör du kontakta veterinär.',
  },
  {
    id: 'feed_basics',
    phrases: ['vad ater', 'vilket foder', 'hur mycket foder', 'mata hons', 'foder till'],
    answer: 'En värphöna äter ungefär 100–130 gram komplett hönsfoder per dag. Komplettera med grus (för matsmältningen) och kalcium, till exempel krossade ostronskal, för starka äggskal. Rent vatten ska alltid finnas tillgängligt.',
  },
  {
    id: 'registration_rules',
    phrases: ['registrera', 'anmala', 'jordbruksverket', 'tillaten', 'lag', 'regler for hons'],
    answer: 'Alla som håller fjäderfä – även ett enda hobbyhöns – ska registrera sin anläggning hos Jordbruksverket. Reglerna skiljer sig åt beroende på flockstorlek och om du säljer ägg. Vår regelguide går igenom vad som gäller steg för steg.',
    link: { href: '/guider/registrera-hons-jordbruksverket', label: 'Läs regelguiden' },
  },
  {
    id: 'egg_sale_rules',
    phrases: ['salja agg', 'salja mina agg', 'aggforsaljning', 'lagligt att salja'],
    answer: 'Med en liten flock (upp till 50 hönor) får du sälja omärkta ägg direkt till konsument, men du ska anmäla verksamheten till länsstyrelsen när du har fler hönor eller säljer via butik. Ägg till butik eller restaurang måste sorteras och stämplas av ett godkänt äggpackeri. Läs hela genomgången i vår guide.',
    link: { href: '/guider/salja-agg-regler', label: 'Läs guiden om äggförsäljning' },
  },
  {
    id: 'coop_size',
    phrases: ['hur stort honshus', 'plats', 'kvm', 'kvadratmeter', 'hur manga hons per'],
    answer: 'Riktmåttet är minst 0,5 m² golvyta per höna inomhus och helst flera kvadratmeter per höna i utegården. Sittpinnar räknas i cirka 20–25 cm per höna, och räkna med ett rede per 3–4 hönor. Mer plats är alltid bättre än minimimåttet.',
  },
];

/**
 * Hittar ett kuraterat snabbsvar för frågan, eller null.
 * Matchning sker på ordgränser — frasen "lag" får aldrig träffa inuti
 * "lagligt". Tröskeln är medvetet konservativ: hellre AI-svar än fel
 * snabbsvar.
 */
export function findQuickAnswer(question: string): AgdaQuickAnswer | null {
  const normalized = normalizeQuestion(question);
  if (normalized.length < 8) return null;
  for (const entry of AGDA_QUICK_ANSWERS) {
    for (const phrase of entry.phrases) {
      const key = normalizeQuestion(phrase);
      if (!key) continue;
      const boundary = new RegExp(`(?<![a-z0-9])${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`);
      if (boundary.test(normalized)) return entry;
    }
  }
  return null;
}
