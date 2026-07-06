// Kategori-landningssidor för /marknad/k/:kategori. Både frontend (SEO/filter)
// och prerender-scriptet importerar från denna fil.

export type MarketplaceCategorySlug = 'hons-till-salu' | 'klackagg' | 'tillbehor' | 'honshus';

export interface MarketplaceCategoryPage {
  slug: MarketplaceCategorySlug;
  /** Filtret som ska sättas på Marketplace-sidan. 'all' = ingen filtrering. */
  categoryFilter: string;
  title: string;
  h1: string;
  intro: string;
  metaDescription: string;
  faq: { q: string; a: string }[];
}

export const MARKETPLACE_CATEGORY_PAGES: MarketplaceCategoryPage[] = [
  {
    slug: 'hons-till-salu',
    categoryFilter: 'hons-kycklingar',
    title: 'Höns till salu – köp värphöns, kycklingar & unghöns | Hönsgården',
    h1: 'Höns till salu i Sverige',
    intro:
      'Hitta värphöns, unghöns och kycklingar från svenska hobbyuppfödare. Alla annonser är gratis och du tar kontakt direkt med säljaren – inga mellanhänder, ingen provision. Filtrera på region, ras och pris för att hitta höns nära dig.',
    metaDescription:
      'Köp höns direkt av svenska hobbyuppfödare. Värphöns, unghöns och kycklingar i alla raser. Gratis annonser, direkt kontakt med säljaren.',
    faq: [
      { q: 'Var köper jag höns i Sverige?', a: 'På Hönsgårdens marknad annonserar hobbyuppfödare värphöns, unghöns och kycklingar i hela Sverige. Du tar kontakt direkt med säljaren – Hönsgården är gratis och tar ingen provision.' },
      { q: 'Vad kostar en höna?', a: 'En värpfärdig unghöna kostar oftast 200–400 kr, en vuxen värphöna 150–300 kr och specialraser mer. Kläckägg och dagsgamla kycklingar är billigare.' },
      { q: 'Hur många höns bör jag börja med?', a: 'Tre höns är en bra början – de mår bäst i grupp och en enda höna blir stressad. Kolla lokala regler kring djurhållning i din kommun.' },
    ],
  },
  {
    slug: 'klackagg',
    categoryFilter: 'klackagg',
    title: 'Kläckägg till salu – befruktade ägg för äggkläckare | Hönsgården',
    h1: 'Kläckägg till salu',
    intro:
      'Beställ befruktade kläckägg från svenska uppfödare av rashöns och lantraser. Många säljer med posten. Bra alternativ om du vill ha specifika raser och driva egen kläckning i äggkläckare eller under en ruvande höna.',
    metaDescription:
      'Kläckägg från svenska hobbyuppfödare – rashöns, lantraser och hybrider. Bra pris, posten eller upphämtning. Alla annonser gratis.',
    faq: [
      { q: 'Hur länge kläcks kläckägg?', a: 'Hönsägg kläcks efter 21 dagar vid 37,5 °C och 55 % luftfuktighet (65 % de sista tre dagarna). Räkna med att 60–80 % av äggen kläcker.' },
      { q: 'Kan man skicka kläckägg med posten?', a: 'Ja, kläckägg går bra med Postnord. Fråga alltid säljaren om paketering – professionella uppfödare använder skumgummiskydd och märker "ömtåligt".' },
      { q: 'Vilken äggkläckare bör jag välja?', a: 'Nybörjare kan börja med enkla automatiska kläckare (Brinsea Mini, R-Com, Rcom Max eller Borotto). Manuell vändning fungerar men kräver mer tid.' },
    ],
  },
  {
    slug: 'tillbehor',
    categoryFilter: 'all',
    title: 'Tillbehör till höns – foder, äggkläckare, kläckmaskiner | Hönsgården',
    h1: 'Tillbehör och utrustning till höns',
    intro:
      'Köp och sälj tillbehör, foder, maskiner, äggkläckare, drickare, foderautomater och stängsel för hönsskötsel. Sveriges enkla marknad för hobbyhönsägare – helt gratis att både lägga in och svara på annonser.',
    metaDescription:
      'Marknaden för hönstillbehör: foder, äggkläckare, drickare, foderautomater, stängsel och redskap. Köp och sälj gratis mellan svenska hönsägare.',
    faq: [
      { q: 'Var köper jag äggkläckare begagnat?', a: 'På Hönsgårdens marknad annonseras begagnade kläckmaskiner regelbundet – från små Brinsea-modeller till större automatiska kläckare för 50+ ägg.' },
      { q: 'Vilket foder är bäst för värphöns?', a: 'Färdigt värpfoder från välrenommerade märken (Granngården, Kalles Kok, Krafft) är enklast. Komplettera med grönt, spannmål och äggskal/kalk.' },
      { q: 'Behöver hönsen värme på vintern?', a: 'Nej, friska höns klarar svensk vinter utan värmelampa om hönshuset är torrt och dragfritt. Frostfria drickare gör dock livet enklare.' },
    ],
  },
  {
    slug: 'honshus',
    categoryFilter: 'honshus-inredning',
    title: 'Hönshus till salu – nya och begagnade hönshus i Sverige | Hönsgården',
    h1: 'Hönshus till salu',
    intro:
      'Hitta hönshus, hönsgårdar, mobila coops, ägglådor, sittpinnar och komplett inredning från svenska hobbyhönsägare. Både nya och begagnade hönshus – ofta betydligt billigare än att bygga från grunden.',
    metaDescription:
      'Nya och begagnade hönshus till salu i Sverige. Färdiga coops, mobila hönshus, ägglådor, sittpinnar och inredning. Gratis annonser på Hönsgården.',
    faq: [
      { q: 'Hur stort hönshus behöver jag?', a: 'Räkna med 1 kvm hönshus per 3 höns plus 4 kvm rastgård per höna. Ju mer plats, desto lugnare flock och färre problem med hackning.' },
      { q: 'Vad ska ett bra hönshus ha?', a: 'Torrt tak, dragfria men ventilerade väggar, sittpinnar (25 cm per höna), ägglådor (1 per 4 höns), lätthanterlig lucka och skydd mot rovdjur.' },
      { q: 'Var köper man begagnat hönshus?', a: 'På Hönsgårdens marknad och Blocket. Hobbyhönsägare säljer ofta hela paket med hönshus, rastgård och inredning när de trappar ner.' },
    ],
  },
];

export const MARKETPLACE_CATEGORY_SLUGS = MARKETPLACE_CATEGORY_PAGES.map((p) => p.slug);

export function findMarketplaceCategoryPage(slug: string | undefined): MarketplaceCategoryPage | null {
  if (!slug) return null;
  return MARKETPLACE_CATEGORY_PAGES.find((p) => p.slug === slug) ?? null;
}
