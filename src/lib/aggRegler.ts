/**
 * Regeltröskel-vägvisaren – ren beslutsträdslogik för äggförsäljningsregler.
 *
 * Källor (hämtade 2026-08):
 * - Jordbruksverket: anläggningsregistret (alla fjäderfähållare).
 * - Livsmedelsverket: producentkod/äggmärkning (>50 värphöns, försäljning utanför
 *   gården), "små mängder" (≤350 fjäderfäns årsproduktion), godkännande vid
 *   grossistförsäljning, länsstyrelseregistrering av primärproduktion (>50 fjäderfän).
 * - SJVFS 2007:19 (salmonellakontroll): journalkrav för yrkesmässig äggproduktion.
 *
 * Logiken är avsiktligt konservativ: osäkra fall råder användaren att dubbelkolla
 * med myndigheten. Sidans texter ska alltid presenteras som vägledning, inte
 * juridisk rådgivning.
 */

export type SalesChannel =
  | 'gard'              // gårdsbutik / försäljning vid grinden
  | 'reko_prepaid'      // REKO med förbetalning (räknas som sålt på gården)
  | 'torg'              // torg, marknad, mässa – försäljning på plats utanför gården
  | 'restaurang_butik'  // direkt till restaurang, café eller butik
  | 'grossist'          // via grossist eller packeri
  | 'privat';           // familj, vänner, grannar

export interface VagvisareInput {
  /** Antal värphöns (lägghöns) användaren har */
  hens: number;
  /** Säljer användaren ägg över huvud taget? */
  sells: boolean;
  /** Valda försäljningskanaler (tom om sells = false) */
  channels: SalesChannel[];
}

export type RuleLevel = 'always' | 'required' | 'info';

export interface RuleResult {
  id: string;
  level: RuleLevel;
  title: string;
  body: string;
  authority: string;
  link: string;
  linkLabel: string;
}

export const SALES_CHANNEL_OPTIONS: { id: SalesChannel; label: string; hint: string }[] = [
  { id: 'gard', label: 'Gårdsbutik / vid grinden', hint: 'Kunden kommer till din gård' },
  { id: 'reko_prepaid', label: 'REKO-ring (förbetalt)', hint: 'Beställt och betalt i förväg via REKO-grupp' },
  { id: 'torg', label: 'Torg, marknad eller mässa', hint: 'Du säljer på plats utanför gården' },
  { id: 'restaurang_butik', label: 'Restaurang, café eller butik', hint: 'Direktförsäljning till detaljhandel' },
  { id: 'grossist', label: 'Grossist eller packeri', hint: 'Äggen säljs vidare av någon annan' },
  { id: 'privat', label: 'Familj, vänner och grannar', hint: 'Överskott i liten skala' },
];

/** Kanaler som innebär försäljning UTANFÖR gården (märkningskrav kan aktiveras) */
const OUTSIDE_FARM: SalesChannel[] = ['torg', 'restaurang_butik', 'grossist'];

/** Tröskelvärden från regelverket */
export const THRESHOLDS = {
  /** Fler än 50 värphöns → producentkod vid försäljning utanför gården + länsstyrelseregistrering */
  producentkodHens: 50,
  /** Årsproduktion motsvarande högst 350 fjäderfän = "små mängder" */
  smaMangderHens: 350,
} as const;

const JV_LINK = 'https://jordbruksverket.se';
const LIVS_LINK = 'https://www.livsmedelsverket.se';
const SKV_LINK = 'https://skatteverket.se';

export function evaluateRegler(input: VagvisareInput): RuleResult[] {
  const { hens, sells, channels } = input;
  const results: RuleResult[] = [];
  const sellsOutsideFarm = sells && channels.some((c) => OUTSIDE_FARM.includes(c));
  const onlyOnFarmOrPrivate =
    sells && channels.length > 0 && !sellsOutsideFarm;

  // 1. Alla fjäderfähållare – oavsett antal och försäljning
  results.push({
    id: 'anlaggningsregistret',
    level: 'always',
    title: 'Anmäl din anläggning till Jordbruksverket',
    body: 'Alla som håller fjäderfän i Sverige – även tre hobbyhöns i trädgården – ska anmäla sin anläggning till Jordbruksverkets anläggningsregister. Det är gratis, tar några minuter med BankID och gör att du nås av varningar vid t.ex. fågelinfluensa.',
    authority: 'Jordbruksverket',
    link: JV_LINK,
    linkLabel: 'Jordbruksverkets e-tjänst',
  });

  results.push({
    id: 'kommunens_regler',
    level: 'always',
    title: 'Kolla kommunens regler för djurhållning',
    body: 'Kommunens ordningsföreskrifter kan ställa egna krav på hönshållning (antal djur, avstånd till grannar, hönshus). En del kommuner kräver anmälan eller tillstånd för hönshus – kolla din kommuns hemsida innan du bygger eller utökar.',
    authority: 'Din kommun',
    link: 'https://www.lansstyrelsen.se',
    linkLabel: 'Hitta din kommun via Länsstyrelsen',
  });

  if (!sells) {
    results.push({
      id: 'ingen_forsaljning',
      level: 'info',
      title: 'Säljer du inga ägg slipper du resten',
      body: 'Så länge du inte säljer ägg (eller äggprodukter) gäller inga livsmedelskrav på märkning, journal eller registrering utöver punkterna ovan. Börjar du sälja senare – kom tillbaka och kör vägvisaren igen.',
      authority: '',
      link: '',
      linkLabel: '',
    });
    return results;
  }

  // 2. Skatt – alla som säljer
  results.push({
    id: 'skatt',
    level: 'required',
    title: 'Deklarera äggförsäljningen',
    body: 'Äggförsäljning ska deklareras. Säljer du i liten skala utan vinstsyfte räknas det oftast som hobbyverksamhet; säljer du regelbundet med vinstsyfte kan det bli näringsverksamhet. Blir omsättningen större än 120 000 kr per år måste du momsregistrera dig. Osäker? Kolla med Skatteverket.',
    authority: 'Skatteverket',
    link: SKV_LINK,
    linkLabel: 'Hobby eller näringsverksamhet?',
  });

  // 3. Länsstyrelseregistrering – fler än 50 fjäderfän för äggproduktion
  if (hens > THRESHOLDS.producentkodHens) {
    results.push({
      id: 'lansstyrelse_registrering',
      level: 'required',
      title: 'Registrera anläggningen hos länsstyrelsen',
      body: `Med fler än ${THRESHOLDS.producentkodHens} fjäderfän för äggproduktion ska din anläggning registreras hos länsstyrelsen som primärproduktionsanläggning. Det är länsstyrelsen som sedan följer upp salmonellakontrollen på plats.`,
      authority: 'Länsstyrelsen / Livsmedelsverket',
      link: LIVS_LINK,
      linkLabel: 'Läs mer hos Livsmedelsverket',
    });
  }

  // 4. Producentkod & äggmärkning
  if (hens > THRESHOLDS.producentkodHens && sellsOutsideFarm) {
    results.push({
      id: 'producentkod',
      level: 'required',
      title: 'Skaffa producentkod och märk dina ägg',
      body: `Med fler än ${THRESHOLDS.producentkodHens} värphöns som säljer ägg utanför gården (torg, marknad, restaurang, butik eller grossist) måste äggen märkas med din producentkod. Koden ansöker du om hos Livsmedelsverket och den stämplas på varje ägg.`,
      authority: 'Livsmedelsverket',
      link: LIVS_LINK,
      linkLabel: 'Ansök om producentkod',
    });
  } else if (hens <= THRESHOLDS.producentkodHens && sellsOutsideFarm) {
    results.push({
      id: 'namn_adress',
      level: 'required',
      title: 'Namn och adress på försäljningsplatsen',
      body: `Med högst ${THRESHOLDS.producentkodHens} värphöns behöver du ingen producentkod – men när du säljer utanför gården ska ditt namn och din adress finnas väl synliga på försäljningsplatsen så köparen vet vem producenten är.`,
      authority: 'Livsmedelsverket',
      link: LIVS_LINK,
      linkLabel: 'Reglerna i detalj',
    });
  } else if (onlyOnFarmOrPrivate && hens > THRESHOLDS.producentkodHens) {
    results.push({
      id: 'producentkod_undantag',
      level: 'info',
      title: 'Du slipper producentkod – så länge du säljer på gården',
      body: 'Försäljning direkt till konsument på gården (gårdsbutik, vid grinden) och förbeställd, förbetald REKO-försäljning räknas som "sålt på gården" – då krävs ingen producentkod oavsett flockstorlek. Men börjar du sälja på torg eller till butik måste du skaffa koden.',
      authority: 'Livsmedelsverket',
      link: LIVS_LINK,
      linkLabel: 'Undantagen i detalj',
    });
  }

  // 5. Kommunal livsmedelsregistrering – över "små mängder"-gränsen
  if (hens > THRESHOLDS.smaMangderHens) {
    results.push({
      id: 'kommun_livsmedel',
      level: 'required',
      title: 'Registrera livsmedelsverksamhet hos kommunen',
      body: `Säljer du mer än "små mängder" – ungefär årsproduktionen från ${THRESHOLDS.smaMangderHens} fjäderfän – räknas du inte längre som undantagen. Då ska verksamheten registreras hos kommunen, som gör livsmedelskontroller (mot avgift) och förväntar sig ett eget kontrollprogram.`,
      authority: 'Din kommun',
      link: LIVS_LINK,
      linkLabel: 'Vad räknas som små mängder?',
    });
  }

  // 6. Grossist/packeri – godkännande från Livsmedelsverket
  if (channels.includes('grossist')) {
    results.push({
      id: 'lsl_godkannande',
      level: 'required',
      title: 'Godkännande från Livsmedelsverket krävs',
      body: 'Ska äggen säljas via grossist eller packeri räcker det inte med kommunregistrering – anläggningen måste godkännas av Livsmedelsverket. Det ställer krav på lokaler, sortering, märkning och egenkontroll.',
      authority: 'Livsmedelsverket',
      link: LIVS_LINK,
      linkLabel: 'Om godkännande',
    });
  }

  // 7. Salmonellakontroll + försäljningsjournal – yrkesmässig produktion
  const yrkesmassigt = hens > THRESHOLDS.producentkodHens || channels.includes('torg') || channels.includes('restaurang_butik') || channels.includes('grossist');
  if (yrkesmassigt) {
    results.push({
      id: 'salmonella',
      level: 'required',
      title: 'Salmonellakontroll och försäljningsjournal',
      body: 'Yrkesmässig äggproduktion omfattas av salmonellakontrollen: besättningen ska provtas regelbundet (ungefär var 15:e vecka under värpperioden plus årlig veterinärkontroll), och du ska löpande föra journal över alla äggförsäljningar med datum, antal och köpare. Journalen ska kunna visas upp för länsstyrelsen.',
      authority: 'Jordbruksverket / Länsstyrelsen',
      link: JV_LINK,
      linkLabel: 'Om salmonellakontrollen',
    });
  } else if (sells) {
    results.push({
      id: 'salmonella_gransfall',
      level: 'info',
      title: 'Journal – ett smart säkerhetsnet',
      body: 'Säljer du bara överskott till några grannar omfattas du normalt inte av salmonellakontrollens journalkrav. Men växer försäljningen kan du snabbt hamna där – för journal från dag ett så är du redo (och köpare uppskattar spårbarheten).',
      authority: '',
      link: '/app/forsaljningsjournal',
      linkLabel: 'Öppna försäljningsjournalen',
    });
  }

  return results;
}

/** Kort sammanfattningsnivå för resultatsidans rubrik */
export function summarizeLevel(input: VagvisareInput): 'hobby' | 'gransfall' | 'producent' {
  if (!input.sells) return 'hobby';
  if (input.hens > THRESHOLDS.smaMangderHens || input.channels.includes('grossist')) return 'producent';
  if (input.hens > THRESHOLDS.producentkodHens || input.channels.some((c) => OUTSIDE_FARM.includes(c))) return 'gransfall';
  return 'hobby';
}

export const LEVEL_LABELS: Record<ReturnType<typeof summarizeLevel>, string> = {
  hobby: 'Hobbynivå – enkla regler',
  gransfall: 'Mellanläget – dags att ha koll',
  producent: 'Producentnivå – full efterlevnad',
};
