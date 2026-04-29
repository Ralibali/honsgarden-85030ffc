// Genererar omfattande, unikt innehåll per ort för /salja-agg/:ort
// Mål: minst ~1000 ord per sida, varierat per region/län/storlek.

import type { Ort } from './saljaAggOrter';

// Enkel deterministisk hash för att variera innehåll per ort
function seed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick<T>(slug: string, salt: string, arr: T[]): T {
  return arr[seed(slug + salt) % arr.length];
}

function pickN<T>(slug: string, salt: string, arr: T[], n: number): T[] {
  const out: T[] = [];
  const used = new Set<number>();
  let i = 0;
  while (out.length < Math.min(n, arr.length) && i < arr.length * 4) {
    const idx = seed(slug + salt + i) % arr.length;
    if (!used.has(idx)) {
      used.add(idx);
      out.push(arr[idx]);
    }
    i++;
  }
  return out;
}

const REGION_KLIMAT: Record<string, string> = {
  Götaland:
    'milt kustklimat med långa, ljusa somrar och relativt korta vintrar – perfekta förutsättningar för värpning från tidig vår till sen höst',
  Svealand:
    'tydliga årstider med varma somrar och kalla, snörika vintrar – vilket gör värmeisolering och belysning i hönshuset extra viktigt under vintern',
  Norrland:
    'långa, ljusa sommarnätter och kalla, mörka vintrar – många hönsägare här kompletterar med lampor från november till februari för att hålla värpningen igång',
};

const REGION_KOPARTYP: Record<string, string[]> = {
  Götaland: [
    'matintresserade familjer från villaområdena',
    'restauranger och caféer som vill profilera sig med svenska råvaror',
    'pensionärer som minns smaken från barndomens lantliga ägg',
    'småbarnsfamiljer som söker tryggare uppfödning än industriägg',
  ],
  Svealand: [
    'sommargäster och fritidshusägare som handlar lokalt på helgen',
    'matintresserade familjer från närliggande villaområden',
    'restauranger och bagerier som vill ha en lokal leverantör',
    'pensionärer som föredrar att handla direkt från gården',
  ],
  Norrland: [
    'sommargäster som vill ha närproducerat under semestern',
    'lokala matbutiker och gårdsbutiker i området',
    'familjer som värdesätter spårbarhet i råvaror',
    'pendlare som passar på att handla på vägen hem',
  ],
};

const VARDAG_SCEN = [
  'klockan halv sex på morgonen när du redan är ute med foderhinken',
  'mitt under en söndagslunch när telefonen vibrerar fem gånger på en kvart',
  'när du står i ladugården och plötsligt får tre sms samtidigt om “har du ägg kvar?”',
  'sent på en torsdagskväll efter att kvällsmaten är klar',
];

const SALJSTALLE = [
  'lokala Facebookgrupperna',
  'köp-och-sälj-grupper på Facebook',
  'anslagstavlan på ICA, Coop eller bygdegården',
  'små QR-skyltar längs vägen ut till tomten',
  'lokala matmarknader och torgdagar',
];

const TIPS_PRIS = [
  'Sätt ett pris som ligger på eller strax under priset för ekologiska ägg i din lokala matbutik – då känns ditt pris tryggt och förståeligt.',
  'Räkna med foderkostnad, strö och tid när du sätter pris. En bra tumregel är att foder utgör ungefär 60–70 % av kostnaden per ägg.',
  'Erbjud lägre pris vid avhämtning av flera kartor – t.ex. 50 kr för en, 90 kr för två och 130 kr för tre – det driver upp snittordervärdet.',
  'Om du har frigående höns och utehage – tveka inte att ta lite mer betalt. Köpare betalar gärna extra för bättre djurvälfärd.',
];

const TIPS_LEVERANS = [
  'Ange tydligt på säljsidan när hämtning sker. Två fasta hämtdagar i veckan är enklare för dig än “när det passar”.',
  'Lägg ut en sval låda eller kylbox vid grinden så köpare kan hämta även när du inte är hemma – många löser det med Swish-bekräftelse på säljsidan.',
  'Om du levererar lokalt, sätt en minimibeställning (t.ex. 3 kartor) för att det ska gå runt rent tidsmässigt.',
  'Skriv tydliga instruktioner med adress, hämtdagar och eventuell GPS-pinne så slipper du svara på samma fråga gång på gång.',
];

const TIPS_HYGIEN = [
  'Tvätta inte äggen direkt efter värpning – det förstör äggens naturliga skyddshinna. Borsta bara av eventuell smuts strax innan försäljning.',
  'Förvara äggen svalt (under 12 °C) men inte i kylen om de ska säljas inom en vecka. Då håller de både smak och hållbarhet bäst.',
  'Märk varje karta med värpdatum eller åtminstone vecka. Det skapar förtroende och påminner köparen om att äggen är färska.',
  'Återanvänd kartonger så länge de är hela och rena – det är både bra för miljön och uppskattat av återkommande kunder.',
];

const KOPARFRÅGOR = [
  'Är hönsen frigående hela året?',
  'Har de tillgång till utevistelse?',
  'Vilket foder får de?',
  'Hur länge håller äggen?',
  'Kan jag prenumerera på en karta i veckan?',
  'Säljer ni även köttkycklingar eller ankor?',
];

export type OrtSeoContent = {
  intro: string;
  marknadAvsnitt: string;
  saResonerarKöpare: string;
  prisIOrt: string;
  saSäljerDuMer: string;
  vardagsexempel: string;
  prisTips: string[];
  leveransTips: string[];
  hygienTips: string[];
  vanligaFragor: string[];
  klimatNot: string;
  longTailKeywords: string[];
};

export function buildOrtContent(ort: Ort): OrtSeoContent {
  const klimat = REGION_KLIMAT[ort.region];
  const kopartyper = REGION_KOPARTYP[ort.region];
  const koparBeskr = pickN(ort.slug, 'kopare', kopartyper, 3).join(', ');
  const scen = pick(ort.slug, 'scen', VARDAG_SCEN);
  const saljstalle = pickN(ort.slug, 'saljstalle', SALJSTALLE, 3).join(', ');
  const stadsstorlek = ort.invanare
    ? `Med cirka ${ort.invanare} invånare`
    : `I ${ort.name}`;

  const intro = `${stadsstorlek} finns det en växande efterfrågan på lokalt producerade ägg från frigående höns. Allt fler i ${ort.name} och resten av ${ort.lan} vill veta exakt var maten kommer ifrån, hur djuren mår och hur långt äggen har transporterats innan de hamnar på frukostbordet. Den här guiden samlar allt du behöver veta för att börja sälja ägg lokalt i ${ort.name} – från prissättning och bokningssystem till hygienregler, kundkommunikation och hur du marknadsför dig utan att betala dyra avgifter till mellanhänder.`;

  const marknadAvsnitt = `Marknaden för lokalt producerade ägg i ${ort.name} ser annorlunda ut idag jämfört med för bara fem år sedan. Människor som tidigare köpte sina ägg på rutin i den stora matbutiken söker nu aktivt efter alternativ. De googlar uttryckligen på “sälja ägg ${ort.name.toLowerCase()}”, “färska ägg ${ort.name.toLowerCase()}” eller “lokala ägg ${ort.lan.toLowerCase()}”. Just därför är det så värdefullt att ha en egen säljsida som rankar på dessa sökord – istället för att hoppas att någon ska se ditt inlägg i en Facebookgrupp innan det försvinner i flödet efter några timmar.`;

  const saResonerarKöpare = `De som handlar ägg direkt från hönsägare i ${ort.name} är ofta ${koparBeskr}. De är beredda att betala lite mer per karta om de får en tydlig historia om var äggen kommer ifrån, hur hönsen lever och om de har en chans att hämta nära hemmet. En egen säljsida på Hönsgården ger dig möjligheten att berätta hela den historien – med foton från hönshuset, en kort beskrivning av rasen och en karta som visar exakt var hämtning sker.`;

  const prisIOrt = `Prisbilden för ägg i ${ort.name} följer i stort sett samma mönster som i resten av ${ort.region}: en karta med sex frigående ägg ligger oftast mellan 35 och 55 kronor, medan ekologiska ägg i butik kan kosta upp emot 60–70 kronor för en sexpack. Direkt från gården ligger du oftast bra till runt 40–55 kronor per karta beroende på säsong, efterfrågan och hur mycket du producerar. Under vintern, när värpningen sjunker naturligt, är det helt rimligt att höja priset något eftersom efterfrågan ofta är högre än tillgången.`;

  const saSäljerDuMer = `För att sälja mer i ${ort.name} räcker det inte med att bara ha bra ägg – köparna måste också hitta dig. De flesta lokala hönsägare lyckas bäst genom att kombinera tre kanaler: ${saljstalle}. Med Hönsgården skapar du en kort, snygg länk som du kan klistra in överallt. Köparen klickar, väljer hämtdag och antal kartor, och betalar via Swish när de hämtar. Du slipper bollandet med sms och du har alltid en aktuell lagerstatus så du inte lovar bort fler ägg än du har.`;

  const vardagsexempel = `Föreställ dig ${scen}. Istället för att svara på “har du ägg kvar?” en i taget kan du peka på din säljsida. Köparen ser direkt om det finns kartor kvar denna vecka, vilken dag det går att hämta och vad det kostar. Du får en notis när bokningen är gjord och pengarna ligger på Swish när de hämtar. På så sätt frigörs både din tid och köparens tid – något som är extra värdefullt för dig som driver hönseriet vid sidan av jobb eller familj.`;

  const klimatNot = `Eftersom ${ort.name} ligger i ${ort.region} har du ${klimat}. Det påverkar både hur du planerar säsongen och hur du kommunicerar med kunder – t.ex. genom att informera om eventuella vinterstopp eller minskad värpning under de mörkaste månaderna direkt på säljsidan, så slipper besvikna köpare.`;

  return {
    intro,
    marknadAvsnitt,
    saResonerarKöpare,
    prisIOrt,
    saSäljerDuMer,
    vardagsexempel,
    klimatNot,
    prisTips: pickN(ort.slug, 'pris', TIPS_PRIS, 3),
    leveransTips: pickN(ort.slug, 'lev', TIPS_LEVERANS, 3),
    hygienTips: pickN(ort.slug, 'hyg', TIPS_HYGIEN, 3),
    vanligaFragor: pickN(ort.slug, 'fragor', KOPARFRÅGOR, 4),
    longTailKeywords: [
      `sälja ägg ${ort.name.toLowerCase()}`,
      `färska ägg ${ort.name.toLowerCase()}`,
      `gårdsägg ${ort.name.toLowerCase()}`,
      `frigående hönsägg ${ort.lan.toLowerCase()}`,
      `äggförsäljning Swish ${ort.name.toLowerCase()}`,
    ],
  };
}

export type FaqItem = { question: string; answer: string };

// 14 frågesvars-mallar – 8–12 plockas deterministiskt per ort.
// Skrivna med naturligt språk + lokala signaler för rich results.
function FAQ_TEMPLATES(ort: Ort): FaqItem[] {
  const n = ort.name;
  const lan = ort.lan;
  const region = ort.region;
  const lower = n.toLowerCase();
  return [
    {
      question: `Hur säljer jag ägg lokalt i ${n}?`,
      answer: `Det enklaste sättet att sälja ägg i ${n} är att skapa en gratis säljsida på Hönsgården. Du anger pris, antal kartor och hämtadress – sedan delar du länken i lokala Facebook-grupper, på anslagstavlor eller via QR-kod vid vägen. Köpare i ${n} bokar själva, väljer hämtdag och betalar via Swish när de hämtar. Hela processen tar runt två minuter att sätta upp.`,
    },
    {
      question: `Vad får man för ägg i ${n}?`,
      answer: `Priset på lokalt sålda ägg i ${n} ligger oftast mellan 35 och 60 kronor per karta om sex ägg. Frigående ägg från gård kan ofta säljas för 45–55 kr, medan ekologiska eller specialraser ibland tar 60–70 kr. Du sätter alltid själv ditt pris på Hönsgården – du behåller hela summan och betalar ingen provision.`,
    },
    {
      question: `Krävs det tillstånd för att sälja ägg från sina höns i ${lan}?`,
      answer: `För småskalig försäljning direkt från gården (under 350 värphöns) i ${lan} räcker det i de flesta fall att registrera primärproduktion hos Länsstyrelsen. Du behöver inte stämpla varje ägg eller söka livsmedelstillstånd. Säljer du till butik eller restaurang gäller andra regler – kontakta då kommunens miljökontor i ${n}.`,
    },
    {
      question: `Hur länge håller färska ägg från gården?`,
      answer: `Otvättade ägg från frigående höns håller minst 28 dagar i rumstemperatur tack vare det naturliga skyddshinna som finns på skalet. I kylskåp håller de 6–8 veckor utan problem. Märk gärna varje karta med värpdatum så köparen i ${n} vet exakt hur färska äggen är.`,
    },
    {
      question: `Behöver jag tvätta äggen innan försäljning?`,
      answer: `Nej, äggen ska helst inte tvättas. Det naturliga skyddshinnet (kutikulan) håller ute bakterier och förlänger hållbarheten. Om ett ägg är synligt smutsigt – borsta torrt, eller skölj snabbt i ljummet vatten precis innan det levereras till köparen.`,
    },
    {
      question: `Hur tar jag betalt – fungerar Swish?`,
      answer: `Swish är det absolut vanligaste betalsättet vid äggförsäljning i ${n}. På din säljsida på Hönsgården kan du visa ditt Swish-nummer eller en QR-kod, och köparen Swishar antingen vid bokning eller vid hämtning. Du slipper helt mellanhänder, kortavgifter och utbetalningstider.`,
    },
    {
      question: `Hur skaffar jag fler kunder i ${n}?`,
      answer: `De flesta lokala hönsägare i ${n} får sina första kunder via lokala Facebook-grupper (t.ex. "Köp och sälj ${n}"), genom anslag på ICA eller bygdegården, samt via en QR-skylt vid vägen ut till tomten. När du har en länk till en riktig säljsida (istället för bara ett telefonnummer) blir det mycket enklare att dela – och dina inlägg ser mer professionella ut.`,
    },
    {
      question: `Kan jag begränsa hur många kartor varje köpare får boka?`,
      answer: `Ja, på Hönsgården kan du sätta både max antal per bokning och totalt veckolager. Det är användbart för dig i ${n} som vill säkerställa att fler kunder får chans att handla, snarare än att en enda köpare bokar hela veckans produktion.`,
    },
    {
      question: `Vad händer om värpningen sjunker under vintern?`,
      answer: `I ${region} sjunker värpningen naturligt när dagsljuset minskar i november–februari. Du kan enkelt pausa lagret i Hönsgården eller skriva en kort notis på säljsidan om att du har vinterpaus eller färre kartor per vecka. Många köpare i ${n} uppskattar transparensen och kommer tillbaka när säsongen drar igång igen.`,
    },
    {
      question: `Kan kunder i ${n} prenumerera på ägg varje vecka?`,
      answer: `Många hönsägare löser det genom att lägga upp återkommande hämtdagar (t.ex. varje fredag) där lojala köpare kan boka i förväg. Du kan också föra en intresselista direkt i Hönsgården, så att stamkunder i ${n} alltid får erbjudande först innan veckans kartor läggs ut publikt.`,
    },
    {
      question: `Är det skattepliktigt att sälja ägg i liten skala?`,
      answer: `Hobbyförsäljning av ägg räknas i Sverige normalt som hobbyverksamhet upp till en viss inkomstgräns. Om dina sammanlagda hobbyinkomster överstiger 50 000 kr per år bör du registrera enskild firma. Hönsgården ger dig en tydlig översikt över intäkter så du enkelt kan deklarera korrekt – kontrollera alltid aktuella regler hos Skatteverket.`,
    },
    {
      question: `Hur märker och förpackar jag äggen?`,
      answer: `Använd hela, rena äggkartonger – gärna återanvända så länge de är torra och utan sprickor. Märk med värpdatum eller åtminstone vecka, samt gärna ditt gårds- eller hönserinamn. Det skapar förtroende hos köpare i ${n} och gör att återkommande kunder enkelt känner igen din kartong.`,
    },
    {
      question: `Vad gör jag om någon klagar på äggen?`,
      answer: `Det händer sällan, men om en köpare i ${n} hör av sig om ett trasigt eller dåligt ägg är det god ton att erbjuda byte vid nästa hämtning. Genom att svara snabbt och vänligt vänder du oftast situationen till en lojal kund. Spara köpkontakten i Hönsgården så har du historiken nära till hands.`,
    },
    {
      question: `Behöver jag en hemsida om jag använder Hönsgården?`,
      answer: `Nej. Din säljsida på Hönsgården fungerar som en mini-hemsida med pris, antal lediga kartor, hämtinfo och bokning. Många hönsägare i ${n} och resten av ${lan} använder enbart länken till sin Hönsgården-sida i sina Facebook-inlägg, sin Instagram-bio och sina QR-koder.`,
    },
  ];
}

export function buildOrtFaq(ort: Ort): FaqItem[] {
  const all = FAQ_TEMPLATES(ort);
  // Plocka 8–12 frågor deterministiskt baserat på slug
  const count = 8 + (seed(ort.slug + 'faqcount') % 5); // 8..12
  const indices: number[] = [];
  let i = 0;
  while (indices.length < count && i < all.length * 4) {
    const idx = seed(ort.slug + 'faq' + i) % all.length;
    if (!indices.includes(idx)) indices.push(idx);
    i++;
  }
  return indices.map((idx) => all[idx]);
}

// ===== SEO-meta per ort =====
// Genererar unika title- och meta description-varianter per ort.
// Mål: <60 tecken (title), <160 tecken (description), unik kombination per slug.

export type OrtMeta = {
  title: string;
  description: string;
  keywords: string[];
};

function clampTitle(s: string, max = 60): string {
  if (s.length <= max) return s;
  // Klipp vid sista mellanslag före max
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut).replace(/[–\-,:\s]+$/, '');
}

function clampDesc(s: string, max = 158): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).replace(/[.,;:\s]+$/, '') + '…';
}

export function buildOrtMeta(ort: Ort): OrtMeta {
  const n = ort.name;
  const lan = ort.lan.replace(/ län$/, '');

  // 6 title-varianter med olika long-tail-vinklar
  const titleVariants = [
    `Sälja ägg i ${n} – gratis säljsida med Swish | Hönsgården`,
    `Sälja ägg ${n} – ta emot bokningar & Swish gratis`,
    `Äggförsäljning i ${n} – egen säljsida på 2 min | Hönsgården`,
    `Sälj färska gårdsägg i ${n} – Swish, 0 kr provision`,
    `Lokala ägg ${n} – starta försäljning gratis | Hönsgården`,
    `Sälja ägg från höns i ${n} (${lan}) – gratis bokningssida`,
  ];

  // 6 description-varianter
  const descVariants = [
    `Sälj dina ägg lokalt i ${n} (${ort.lan}). Skapa en gratis säljsida på 2 minuter, ta emot bokningar och få betalt direkt via Swish – utan avgifter eller mellanhand.`,
    `Har du höns i ${n}? Skapa en gratis säljsida med pris, hämtning och Swish-betalning. Köpare i ${lan} bokar själva – du behåller hela försäljningen.`,
    `Starta äggförsäljning i ${n} på 2 minuter. Lokal säljsida, bokningskalender och Swish – helt gratis. Slipp sms-pingla och håll koll på lagret automatiskt.`,
    `Allt fler i ${n} söker färska gårdsägg. Skapa en egen säljsida hos Hönsgården, dela länken lokalt och låt köparna i ${lan} boka själva. 0 kr i avgift.`,
    `Sälj ägg från dina höns i ${n} utan mellanhänder. Egen säljsida, lager, bokningar och Swish-betalning – färdigt på minuter, helt gratis att starta.`,
    `Säljmodul för hönsägare i ${n} och hela ${lan}: pris, hämtdagar, lagersaldo och Swish. Skapa kontot gratis och få första bokningen redan i veckan.`,
  ];

  const tIdx = seed(ort.slug + 'title') % titleVariants.length;
  const dIdx = seed(ort.slug + 'desc') % descVariants.length;

  return {
    title: clampTitle(titleVariants[tIdx]),
    description: clampDesc(descVariants[dIdx]),
    keywords: [
      `sälja ägg ${n.toLowerCase()}`,
      `äggförsäljning ${n.toLowerCase()}`,
      `färska ägg ${n.toLowerCase()}`,
      `gårdsägg ${n.toLowerCase()}`,
      `sälja ägg ${lan.toLowerCase()}`,
      `äggförsäljning swish`,
      `sälja ägg från höns`,
    ],
  };
}

// ===== Bilder per ort (alt-text + caption) =====
// Roterar deterministiskt mellan befintliga assetbilder, men ger unik
// alt-text och caption per ort så bilderna också bidrar till unik SEO.

export type OrtImage = {
  src: string;          // import-path (löses i sidan)
  assetKey: 'coop' | 'farm' | 'eggs' | 'hen';
  alt: string;          // unik alt-text per ort
  caption: string;      // kort rubrik under bilden
};

const COOP_ALT = [
  (n: string, l: string) => `Hönshus med utehage hos lokal hönsägare i ${n}, ${l}`,
  (n: string) => `Frigående höns vid hönshuset på en gård utanför ${n}`,
  (n: string) => `Lantligt hönshus med plats för värphöns i ${n}`,
  (n: string, l: string) => `Småskaligt hönseri i ${n} (${l}) med utomhusvistelse`,
];
const COOP_CAP = [
  (n: string) => `Hönshus i trakten av ${n}`,
  (n: string) => `Frigående höns nära ${n}`,
  (n: string) => `Lokalt hönseri i ${n}`,
  (n: string) => `Utehage hos hönsägare i ${n}`,
];

const FARM_ALT = [
  (n: string) => `Karta över hämtplats för färska ägg i ${n}`,
  (n: string, l: string) => `Lokal äggleverans från gård i ${n}, ${l}`,
  (n: string) => `Gårdsbutik och hämtning av ägg i ${n}`,
  (n: string) => `Vy från gård som säljer ägg lokalt i ${n}`,
];
const FARM_CAP = [
  (n: string) => `Hämtning på gården nära ${n}`,
  (n: string) => `Lokal leverans i ${n}`,
  (n: string) => `Hämtplats i ${n}`,
  (n: string) => `Gårdens läge utanför ${n}`,
];

const EGGS_ALT = [
  (n: string) => `Färska ägg i kartong från höns i ${n}`,
  (n: string, l: string) => `Karta med sex frigående ägg från ${n} (${l})`,
  (n: string) => `Nyvärpta ägg från lokal producent i ${n}`,
  (n: string) => `Färdigpackade kartor med ägg från ${n} redo för Swish-hämtning`,
];
const EGGS_CAP = [
  (n: string) => `Färska ägg från ${n}`,
  (n: string) => `Karta med sex ägg, värpt i ${n}`,
  (n: string) => `Nyplockade ägg i ${n}`,
  (n: string) => `Klart för hämtning i ${n}`,
];

const HEN_ALT = [
  (n: string) => `Värphöna hos lokal hönsägare i ${n}`,
  (n: string, l: string) => `Höna av brun ras hos småskalig producent i ${n}, ${l}`,
  (n: string) => `Frigående höna i utehagen utanför ${n}`,
  (n: string) => `Höna nyligen ute ur värpredet på gård i ${n}`,
];
const HEN_CAP = [
  (n: string) => `Värphöna nära ${n}`,
  (n: string) => `Frigående höna i ${n}`,
  (n: string) => `Hos hönsägaren i ${n}`,
  (n: string) => `En av flockens höns i ${n}`,
];

const ASSET_PATHS: Record<OrtImage['assetKey'], string> = {
  coop: '/src/assets/hero-coop.jpg',
  farm: '/src/assets/hero-farm.jpg',
  eggs: '/src/assets/eggs-basket.jpg',
  hen: '/src/assets/hen-portrait.jpg',
};

function pickFn<T>(slug: string, salt: string, arr: T[]): T {
  return arr[seed(slug + salt) % arr.length];
}

export function buildOrtImages(ort: Ort): { coop: OrtImage; farm: OrtImage; eggs: OrtImage } {
  const n = ort.name;
  const l = ort.lan;

  return {
    coop: {
      src: ASSET_PATHS.coop,
      assetKey: 'coop',
      alt: pickFn(ort.slug, 'coop-alt', COOP_ALT)(n, l),
      caption: pickFn(ort.slug, 'coop-cap', COOP_CAP)(n),
    },
    farm: {
      src: ASSET_PATHS.farm,
      assetKey: 'farm',
      alt: pickFn(ort.slug, 'farm-alt', FARM_ALT)(n, l),
      caption: pickFn(ort.slug, 'farm-cap', FARM_CAP)(n),
    },
    eggs: {
      src: ASSET_PATHS.eggs,
      assetKey: 'eggs',
      alt: pickFn(ort.slug, 'eggs-alt', EGGS_ALT)(n, l),
      caption: pickFn(ort.slug, 'eggs-cap', EGGS_CAP)(n),
    },
  };
}

// Behövs för enstaka bonusbild om vi vill (höna)
export function buildOrtHenImage(ort: Ort): OrtImage {
  const n = ort.name;
  const l = ort.lan;
  return {
    src: ASSET_PATHS.hen,
    assetKey: 'hen',
    alt: pickFn(ort.slug, 'hen-alt', HEN_ALT)(n, l),
    caption: pickFn(ort.slug, 'hen-cap', HEN_CAP)(n),
  };
}
