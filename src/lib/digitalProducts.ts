import { GUIDE_COVER_PATH, GUIDE_SAMPLE_URL } from './digitalGuide';

export type DigitalProductSlug = 'mina-forsta-hons' | 'vinterklar-honsgard' | 'aggbodens-saljpaket' | 'klackdagboken' | 'fran-honsgard-till-aggbod';
export interface DigitalProduct {
  slug: DigitalProductSlug;
  title: string;
  price: number;
  saleStatus?: 'preparing';
  vatPercent: number;
  pages: number;
  samplePages: number;
  fields: number;
  edition: string;
  cover: string;
  sample: string;
  tagline: string;
  description: string;
  scope: string;
  license: string;
  review: string;
  contents: Array<{ title: string; body: string }>;
}
const personalLicense = 'För ditt eget hushåll. Spara och fyll i filen, skriv ut arbetsblad flera gånger och lämna ifyllda skötselinstruktioner till den som passar flocken. Själva PDF-produkten får inte säljas eller spridas vidare.';
const animalReview = 'Sakråden källkontrollerades med AI-stöd den 7 september 2026. Källor och länkar finns i PDF:en. Materialet är inte veterinärgranskat. Myndigheterna och universiteten har inte granskat eller godkänt produkten.';
const asset = (slug: string, type: 'cover' | 'sample') => type === 'cover' ? `/images/digital-products/${slug}-cover.webp` : `/downloads/${slug}-smakprov.pdf`;

export const DIGITAL_PRODUCT_CATALOG: Record<DigitalProductSlug, DigitalProduct> = {
  'fran-honsgard-till-aggbod': {
    "slug": "fran-honsgard-till-aggbod",
    "title": "Från hönsgård till äggbod",
    "saleStatus": "preparing",
    "price": 179,
    "vatPercent": 6,
    "pages": 30,
    "samplePages": 4,
    "fields": 164,
    "edition": "1.0",
    "cover": "/images/digital-products/fran-honsgard-till-aggbod-cover.webp",
    "sample": "/downloads/fran-honsgard-till-aggbod-smakprov.pdf",
    "tagline": "En genomtänkt start för småskalig äggförsäljning i Sverige.",
    "description": "Välj försäljningsväg, ta rätt myndighetskontakter och räkna på priset. En praktisk handbok med konkreta exempel, kundtexter och rutiner som fungerar när kunden kommer för att hämta.",
    "scope": "För egna hönsägg som livsmedel till privatkunder i Sverige. Du får 30 formgivna sidor, en 30-dagarsplan och 164 ifyllbara fält. Kalkylerna räknas manuellt. Skyltpaketet Äggbodens säljpaket säljs separat.",
    "license": "Licens för ett hushåll eller en egen verksamhet. Spara och fyll i filen, skriv ut arbetsblad flera gånger och anpassa kundtexterna till din verksamhet. Själva PDF-produkten får inte säljas eller spridas vidare.",
    "review": "Källor och räkneexempel kontrollerades med AI-stöd den 8 september 2026. Guiden innehåller 20 klickbara myndighetskällor. Den är inte externt granskad eller godkänd av jurist, veterinär eller myndighet. Otydliga gränsfall redovisas; kontrollmyndighetens bedömning av din verksamhet och aktuella regler gäller.",
    "contents": [
        {
            "title": "Hitta din försäljningsväg",
            "body": "Gårdsförsäljning, REKO och marknad. Förstå vilka frågor försäljning till andra företag väcker och vilka kontakter du behöver ta."
        },
        {
            "title": "Myndighetskarta och startkontroll",
            "body": "Kontaktunderlag, skillnaden mellan registreringar och tydligt redovisade gränsfall. Samla besked för just din verksamhet."
        },
        {
            "title": "Från värpdag till utlämning",
            "body": "Planera smittskydd, hantering, förvaring, datum och spårbarhet. Arbetsblad för produktion och leveranser ingår."
        },
        {
            "title": "Räkna på ett hållbart pris",
            "body": "Ett genomräknat exempel visar kostnader, egen arbetstid och moms. Jämför också med en vecka då färre ägg blir sålda."
        },
        {
            "title": "Kundtexter som hjälper i vardagen",
            "body": "Anpassningsbara exempel för presentation, orderbekräftelse, påminnelse och minskad tillgång. Håll ihop bokning, betalning och hämtning."
        },
        {
            "title": "Din första månad",
            "body": "En 30-dagarsplan, journaler, uppföljning och plats för avvikelser. Använd handboken fristående eller tillsammans med Hönsgårdens app."
        }
    ]
},
  'mina-forsta-hons': {
    slug: 'mina-forsta-hons', title: 'Mina första höns', price: 199, vatPercent: 6, pages: 24, samplePages: 4, fields: 216, edition: '1.2',
    cover: GUIDE_COVER_PATH, sample: GUIDE_SAMPLE_URL, tagline: 'Planera din första flock.',
    description: 'Svenskt startpaket med checklistor, budget och arbetsblad för nya hönsägare.',
    scope: 'För dig som skaffar unghöns eller vuxna höns.', license: personalLicense, review: animalReview, contents: [],
  },
  'vinterklar-honsgard': {
    slug: 'vinterklar-honsgard', title: 'Vinterklar hönsgård', price: 129, vatPercent: 6, pages: 18, samplePages: 3, fields: 147, edition: '1.0',
    cover: asset('vinterklar-honsgard', 'cover'), sample: asset('vinterklar-honsgard', 'sample'),
    tagline: 'Förbered vintern. Gör vardagen lättare att sköta.',
    description: 'En praktisk vinterhandbok för vuxna hobbyhöns. Gå igenom hönshuset, ordna reservlösningar och samla rutinerna så att någon annan kan ta över.',
    scope: 'För vuxna hobbyhöns. Du anpassar planen till flocken, platsen och utrustningen. Boken innehåller inga universella temperaturgränser, byggdimensioneringar eller medicinska behandlingar.',
    license: personalLicense, review: animalReview,
    contents: [
      { title: 'Din vinterplan', body: 'Gör en lägesbild av flock och hönshus. Ett konkret åtgärdsexempel visar hur du skriver något som går att följa upp.' },
      { title: 'Luft, vatten och foder', body: 'Kontrollrundor för fukt, ventilation, vatten, förvaring och rengöring. Räkneexempel för att planera ditt foderlager.' },
      { title: 'Ytterskydd och el', body: 'Gå runt anläggningen, dokumentera brister och prova hur skötseln fungerar vid strömavbrott eller utrustningsfel.' },
      { title: 'Smittskydd och avvikelser', body: 'Planera egna rutiner, hitta aktuella myndighetsråd och dokumentera observationer inför kontakt med veterinär.' },
      { title: 'En tydlig veckoplan', body: 'Ett ifyllt exempel med namngivna ansvariga följs av en egen plan med utrymme för extra tillsyn.' },
      { title: 'Blad att använda igen', body: 'Vinterinstruktion till hönsvakten, prioriterad inköpslista och logg för observation, åtgärd och resultat.' },
    ],
  },
  'aggbodens-saljpaket': {
    slug: 'aggbodens-saljpaket', title: 'Äggbodens säljpaket', price: 149, vatPercent: 25, pages: 21, samplePages: 3, fields: 193, edition: '1.0',
    cover: asset('aggbodens-saljpaket', 'cover'), sample: asset('aggbodens-saljpaket', 'sample'),
    tagline: 'En genomtänkt äggbod med ditt eget namn.',
    description: 'Skyltar, kundkort och planeringsblad för dig som säljer ägg från egna höns. Fyll i dina uppgifter och skriv ut ett enhetligt material för din verksamhet.',
    scope: 'Textfälten är ifyllbara; layout, illustrationer och färgteman är fasta. Paketet innehåller skyltar och arbetsblad, inte kompletta livsmedelsetiketter, en Canva-mall eller automatiserad bokföring. Ingen QR-kod ingår.',
    license: 'Licens för en egen verksamhet. Fyll i mallarna, skriv ut obegränsat för eget bruk och publicera dina färdiga skyltar. Du får lämna färdigt skyltmaterial till ett tryckeri. Själva mallpaketet får inte säljas eller spridas vidare.',
    review: 'Regelöversikten källkontrollerades med AI-stöd den 7 september 2026 mot Livsmedelsverket. Den är inte en bedömning av din enskilda verksamhet. Myndigheten har inte granskat eller godkänt produkten.',
    contents: [
      { title: 'Fyra A4-skyltar', body: 'Samma grundskylt i skogsgrönt, varm sand, terrakotta och svartvitt. Egna fält för producent, kontakt, hämtning och pris.' },
      { title: 'Pris och betalning', body: 'En A4-prislista och en A4-betalningsskylt med textfält för betalningssätt, nummer, mottagare och meddelande.' },
      { title: 'Fyra mindre skyltar', body: 'Välkommen, tillfälligt slut, beställning och upphämtning. Två A5-skyltar per A4-sida med skärlinje.' },
      { title: 'Fyra kundkort per ark', body: 'A6-kort för tack, återbeställning och kontakt. Skyltar och kort har ingen Hönsgården-logotyp: din verksamhet är avsändare.' },
      { title: 'Ordning på beställningarna', body: 'Privat beställningslista, veckoplan för utlämning och blad för produktion och leveranser.' },
      { title: 'Exempel och utskriftskontroll', body: 'Ett tydligt räkneexempel, egen planeringskalkyl, kontrollruta på 50 × 50 mm och en sista genomgång av kundens väg.' },
    ],
  },
  'klackdagboken': {
    slug: 'klackdagboken', title: 'Kläckdagboken', price: 99, vatPercent: 25, pages: 16, samplePages: 3, fields: 235, edition: '1.0',
    cover: asset('klackdagboken', 'cover'), sample: asset('klackdagboken', 'sample'),
    tagline: 'Följ äggen. Bevara erfarenheten.',
    description: 'En ifyllbar planeringsjournal för hönsägg i kläckmaskin eller under ruvande höna. Samla förberedelser, observationer och resultat för en egen omgång.',
    scope: 'En journal med planeringsstöd, inte en fullständig kurs i kläckning eller kycklinguppfödning. Inställningar hämtas från rätt anvisning för din metod. Datum och procent räknas manuellt.',
    license: personalLicense, review: animalReview,
    contents: [
      { title: 'Förbered omgången', body: 'Checklista för plats, fortsatta skötseln, ursprung, reservperson och vem du kontaktar vid problem.' },
      { title: 'Rätt anvisning på rätt plats', body: 'Ett utrustningsblad samlar dina egna inställningar, enheter och referenser till manualen.' },
      { title: 'Datum utan en dags förskjutning', body: 'Tydligt exempel med start som dag 0 och ungefärlig kläckdag 21 dagar senare. En fiktiv omgång visar hur dokumentationen hänger ihop.' },
      { title: 'Äggregister och dagliga loggar', body: 'Tolv egna äggreferenser per blad och loggar för dag 0–23. Fyll i datum, tid, värde och observation. Skriv ut fler blad vid behov.' },
      { title: 'Lysning och kläckning', body: 'Skilj på observation, osäker bedömning och beslut. Koppla kläckta kycklingar till äggreferensen och dokumentera avvikelser.' },
      { title: 'Ett resultat som går att tolka', body: 'Exemplet 8 av 12 = 66,7 % visar rätt nämnare. Avsluta med vad som fungerade, vad som är osäkert och nästa förbättring.' },
    ],
  },
};

export function getPublicDigitalProduct(slug: unknown): DigitalProduct | null {
  return typeof slug === 'string' && Object.prototype.hasOwnProperty.call(DIGITAL_PRODUCT_CATALOG, slug)
    ? DIGITAL_PRODUCT_CATALOG[slug as DigitalProductSlug] : null;
}

export const NEW_DIGITAL_PRODUCTS = Object.values(DIGITAL_PRODUCT_CATALOG).filter(p => p.slug !== 'mina-forsta-hons');

export const AVAILABLE_DIGITAL_PRODUCTS = Object.values(DIGITAL_PRODUCT_CATALOG).filter(p => p.saleStatus !== 'preparing');
