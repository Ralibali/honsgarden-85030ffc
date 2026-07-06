// Långform-innehåll för SEO-landningssidor om hönsraser.
// Skrivet i jag-perspektiv av en hönsägare med ~10 års erfarenhet av
// svenska hobbyflockar. Tonen ska vara konkret, ärlig och praktisk –
// inte uppslagsverk. Inga uppfunna siffror; värpsiffror och äggvikter
// är vedertagna riktvärden för raserna, inte unika mätningar.

export interface BreedRow {
  namn: string;
  ursprung: string;
  vikt: string;
  agg_per_ar: string;
  aggfarg: string;
  temperament: string;
  passar: string;
}

export interface ContentSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LongformPage {
  slug: string;
  path: string;
  title: string;            // <60 tecken
  description: string;      // 50–160 tecken
  h1: string;
  eyebrow: string;
  intro: string[];          // 2–3 stycken
  toc: string[];            // tankestreck för innehåll
  sections: ContentSection[];
  breedTable?: BreedRow[];
  faq: { q: string; a: string }[];
  relatedLinks: { href: string; label: string }[];
  breedName?: string;       // om satt: koppling till breedLayingRates för värpstat
  canonicalPath?: string;   // om satt: canonical pekar hit istället för path
}

const standardRelated = [
  { href: '/blogg/bast-honsras-sverige', label: 'Bästa hönsrasen i Sverige – stor guide' },
  { href: '/blogg/skaffa-hons-nyborjare', label: 'Skaffa höns – nybörjarguide' },
  { href: '/blogg/foder-till-hons-guide', label: 'Foder till höns – komplett guide' },
  { href: '/borja-med-hons', label: 'Börja med höns' },
  { href: '/honskalender', label: 'Hönskalender och rutiner' },
];

// ---------- Hönsraser (1 600/mån, position 12) ----------
const honsraser: LongformPage = {
  slug: 'honsraser',
  path: '/honsraser',
  title: 'Hönsraser – guide till svenska & utländska raser',
  description:
    'Hönsraser jämförda av en hobbyhönsägare med 10 års erfarenhet: värpning, temperament, äggfärg, vinterhärdighet och vilken ras som passar dig.',
  h1: 'Hönsraser – så väljer du rätt ras för din flock',
  eyebrow: 'Stor rasguide',
  intro: [
    'Efter att ha haft höns hemma i tio år har jag testat allt från snälla orpington till lite mer karaktärsfulla leghorn. Det jag märkt är att “bästa hönsrasen” inte finns på riktigt – det finns en bästa ras för just dig, din tomt, ditt klimat och hur mycket ägg du faktiskt behöver. Den här guiden går igenom de vanligaste hönsraserna man stöter på i Sverige, från de svenska lantraserna till de stora produktionshönsen.',
    'Jag försöker hålla mig till sådant som faktiskt spelar roll i vardagen: hur många ägg du kan räkna med, hur de beter sig i flocken, hur de klarar vintern utan att man behöver bygga växthus åt dem, och om de är trevliga att ha runt benen när du står ute med kaffekoppen.',
    'Om du är helt ny på höns rekommenderar jag att du läser den här guiden parallellt med vår nybörjarguide. Det är lättare att välja ras när man också förstått grunderna i skötsel.',
  ],
  toc: [
    'Vad menas egentligen med “hönsras”?',
    'Svenska lantraser – kulturarv som värper',
    'Klassiska hobbyraser från utlandet',
    'Hybrider och produktionshöns',
    'Dvärgvarianter och prydnadshöns',
    'Stor jämförelsetabell',
    'Hur du väljer rätt ras för din situation',
    'Vanliga frågor',
  ],
  sections: [
    {
      heading: 'Vad menas egentligen med “hönsras”?',
      paragraphs: [
        'En hönsras är en grupp höns som avlats fram för att se ut och bete sig på ett visst sätt – färg, form, värpning, temperament. Vissa raser är hundratals år gamla, andra är moderna hybrider som tagits fram för att lägga maximalt antal ägg på minsta möjliga foder. För dig som hobbyhönsägare gör det skillnad, för en hybrid och en lantras lever inte alls samma liv.',
        'Hybriderna är effektivare första året men brukar tappa snabbare och bli sjukare i förtid. Lantraserna värper mindre men håller längre, blir bra mammor och är trevligare att leva med på en gård. Renrasiga utställningshöns är något helt annat – där handlar det om utseende, fjäderdräkt och ringnummer mer än om matig äggkorg.',
        'Bestäm dig först: vill du ha så många ägg som möjligt, ett trevligt sällskap på tomten, ett kulturarv att bevara, eller en blandning av allt? Då blir rasvalet mycket enklare.',
      ],
    },
    {
      heading: 'Svenska lantraser – kulturarv som värper',
      paragraphs: [
        'Sverige har ett gäng underbara lantraser som bevarats genom Svenska Lanthönsklubben. Det är genuint svenska höns, anpassade till vårt klimat, och de flesta av dem klarar en kall vinter utan att man behöver isolera hönshuset som ett passivhus.',
        'Skånsk blommehöna är min personliga favorit för småskaligt. De är vackra, har olika fjäderfärg från höna till höna (det är därför de heter blommehöns), värper bra för att vara en lantras och är lugna nog att ha barn springande omkring. Äggen är ofta krämfärgade till ljust beige och rätt stora för en så pass liten höna.',
        'Hedemora är härdigare än det mesta jag haft – frostbiten kam har jag aldrig sett på en hedemora. Bohuslän–Dals svarthöna är ovanlig och spännande, med mörkt skinn och mörka ben, lite som en svensk släkting till ayam cemani. Öländsk dvärghöna är en miniatyr om man vill ha en liten flock på en mindre tomt.',
      ],
      bullets: [
        'Skånsk blommehöna – färgglad, lugn, värper hyfsat året om.',
        'Hedemora – tålig, dunig, klarar svensk vinter mycket bra.',
        'Bohuslän–Dals svarthöna – ovanlig, mörkt kött och mörka ben.',
        'Öländsk dvärghöna – kompakt, perfekt på liten yta.',
        'Gotlandshöna – pigg, slimmad och en duktig värphöna för att vara lantras.',
      ],
    },
    {
      heading: 'Klassiska hobbyraser från utlandet',
      paragraphs: [
        'Utöver lantraserna finns de internationella klassikerna som många svenska hobbyflockar består av. Orpington är ett rejält, fluffigt klot av en höna – snäll, värper bra, blir ofta liggsjuka (vill ruva), och tål kyla för att de är så fjäderrika. Wyandotte är en annan favorit: kompakt, vacker, lugn och med fina mörkbeige ägg.',
        'Sussex är en gammal engelsk allroundras. Bra värpning, tål att gå ute mycket, hyfsad mammahöna. Plymouth Rock (ofta randig svartvit) är trygg, sällan stökig och blir hyfsat gammal. Marans har sina berömda chokladbruna ägg – de värper inte mest men det är något speciellt med att öppna äggkorgen och se ett djupbrunt ägg ovanpå de ljusa.',
        'Brahma är gigantiska och otroligt lugna; jag känner folk som har dem mest för att titta på. Araucana och Cream Legbar lägger blå eller ljusgröna ägg, vilket är roligt om man säljer ägg vid grinden och vill stå ut.',
      ],
    },
    {
      heading: 'Hybrider och produktionshöns',
      paragraphs: [
        'ISA Brown, Lohmann Brown, Bovans, Hisex – det här är de stora produktionshybriderna som ofta säljs som “bruksvärpare”. De är otroligt effektiva första 12–18 månaderna och kan lägga uppemot 300 ägg per år. Sedan trillar produktionen snabbt, och tyvärr drabbas de oftare av äggstocks- och äggledarproblem än lantraserna.',
        'För någon som vill ha mycket ägg utan att hålla en stor flock är hybriderna logiska. Jag har själv haft några ISA Brown bland lantraserna och de skötte sig fint – snälla, sociala, värpte i stort sett varje dag första året. Men jag har lärt mig att man inte ska planera ekonomi och äggleveranser efter att de ska göra det i fem år, för det gör de oftast inte.',
        'Vill du blanda hybrider och lantraser i samma flock fungerar det utmärkt – men introducera nya höns försiktigt, helst genom rastgård bredvid rastgård i några dagar innan ihopsläpp.',
      ],
    },
    {
      heading: 'Dvärgvarianter och prydnadshöns',
      paragraphs: [
        'Många klassiska raser finns även som dvärgvarianter – wyandotte bantam, orpington bantam, sebright, holländsk dvärg och så vidare. De värper färre och mindre ägg men tar mindre plats, äter mindre och passar familjer med små barn eller mindre tomter. Sebright och holländsk dvärg är mer prydnad än produktion, men charmiga att ha runt sig.',
        'Silkeshöna är en kategori för sig. De ser ut som mjuka tovor på ben, värper sådär (cirka 100 ägg per år), men de är fantastiska mammor och ruvar gärna både egna och andras ägg. Många kläckare har en silkeshöna eller två just för att ruva fram kycklingar från andra raser.',
      ],
    },
    {
      heading: 'Hur du väljer rätt ras för din situation',
      paragraphs: [
        'Börja med att svara på fyra frågor: hur mycket ägg behöver jag, hur mycket plats har jag, hur kallt blir det där jag bor, och hur mycket tid lägger jag på flocken? Behöver du ägg till en familj på fem personer dagligen är hybrider eller en duktig hobbyras som sussex/wyandotte vettigt. Vill du främst ha sällskap och något vackert att titta på är orpington eller silkeshöna ett mjukare val.',
        'Bor du långt norrut, satsa på lantraser med tätt dun (hedemora, orpington, brahma) och undvik raser med jättekam som leghorn, eftersom de lättare får frostskador. Har du barn som ska vara med ute, välj raser med lugnt temperament. Och har du en hund eller rovdjur i området, välj höns som är pigga nog att flytta sig själva.',
        'Slutligen – blanda gärna. En blandflock med några lantraser, en hybrid eller två för äggvolym och kanske en silkeshöna för ruvning är en otroligt rolig vardag.',
      ],
    },
  ],
  breedTable: [
    { namn: 'Skånsk blommehöna', ursprung: 'Sverige', vikt: '1,7–2,2 kg', agg_per_ar: '~180', aggfarg: 'Ljusbeige', temperament: 'Lugn', passar: 'Familj, lantligt' },
    { namn: 'Hedemora', ursprung: 'Sverige', vikt: '1,8–2,5 kg', agg_per_ar: '~150', aggfarg: 'Krämvit', temperament: 'Pigg, tålig', passar: 'Kalla vintrar' },
    { namn: 'Orpington', ursprung: 'England', vikt: '3–4,5 kg', agg_per_ar: '~180', aggfarg: 'Beige', temperament: 'Mjuk, hanterbar', passar: 'Barnfamiljer' },
    { namn: 'Wyandotte', ursprung: 'USA', vikt: '2,5–3,5 kg', agg_per_ar: '~200', aggfarg: 'Krämbeige', temperament: 'Lugn', passar: 'Allround hobby' },
    { namn: 'Sussex', ursprung: 'England', vikt: '2,5–3,5 kg', agg_per_ar: '~240', aggfarg: 'Beige', temperament: 'Aktiv, social', passar: 'Frigående' },
    { namn: 'Marans', ursprung: 'Frankrike', vikt: '2,5–3,5 kg', agg_per_ar: '~180', aggfarg: 'Mörkt choklad', temperament: 'Lugn', passar: 'Vackra ägg' },
    { namn: 'Araucana', ursprung: 'Chile', vikt: '1,5–2,5 kg', agg_per_ar: '~180', aggfarg: 'Blå/grön', temperament: 'Pigg', passar: 'Försäljning' },
    { namn: 'ISA Brown (hybrid)', ursprung: 'Frankrike', vikt: '2 kg', agg_per_ar: '~300 (år 1)', aggfarg: 'Brun', temperament: 'Snäll', passar: 'Mycket ägg' },
    { namn: 'Silkeshöna', ursprung: 'Asien', vikt: '0,8–1,5 kg', agg_per_ar: '~100', aggfarg: 'Krämvit', temperament: 'Mycket lugn', passar: 'Ruvning, barn' },
    { namn: 'Brahma', ursprung: 'USA/Asien', vikt: '4–5 kg', agg_per_ar: '~150', aggfarg: 'Beige', temperament: 'Lugn jätte', passar: 'Sällskap' },
  ],
  faq: [
    { q: 'Vilken är den bästa hönsrasen för nybörjare?', a: 'Orpington, sussex, wyandotte och skånsk blommehöna är trygga val. De är lugna, värper hyfsat och är förlåtande mot misstag i skötseln.' },
    { q: 'Hur många hönsraser finns det?', a: 'Det finns hundratals i världen. I Sverige stöter du oftast på 20–30 vanliga raser plus de svenska lantraserna.' },
    { q: 'Vilken hönsras värper flest ägg?', a: 'Hybrider som ISA Brown och Lohmann Brown lägger flest – upp till cirka 300 ägg första året. Av hobbyraserna är sussex och leghorn duktiga värpare.' },
    { q: 'Klarar alla hönsraser svensk vinter?', a: 'De flesta klarar sig bra med torr, dragfri inhysning. Raser med stora kammar (leghorn) är känsligare för frostbett. Lantraser och fjäderrika raser som orpington klarar kyla utmärkt.' },
    { q: 'Kan man blanda olika hönsraser i samma flock?', a: 'Ja, det går utmärkt. Introducera nya höns gradvis, helst genom delad rastgård i några dagar innan ihopsläpp, så blir hierarkin lugnare.' },
  ],
  relatedLinks: standardRelated,
};

// ---------- Hönsraser lista (140/mån, position 21) ----------
const honsraserLista: LongformPage = {
  slug: 'honsraser-lista',
  path: '/honsraser-lista',
  title: 'Hönsraser lista – alla vanliga raser i Sverige',
  description:
    'Lista över hönsraser i Sverige: svenska lantraser, klassiska hobbyraser, dvärgraser och hybrider med vikt, äggfärg och temperament.',
  h1: 'Hönsraser – komplett lista över vanliga raser i Sverige',
  eyebrow: 'A–Ö-lista',
  intro: [
    'Det här är listan jag själv hade velat ha när jag började med höns – alla vanligare hönsraser samlade, med det som faktiskt spelar roll: ursprung, storlek, äggvolym, äggfärg och temperament. Jag har haft eller hjälpt vänner med många av dem genom åren och försöker beskriva varje ras ärligt.',
    'Listan är organiserad i fem kategorier: svenska lantraser, klassiska hobbyraser, dvärgraser, prydnadshöns och produktionshybrider. Vill du bara ha en snabb jämförelsetabell, scrolla längst ner.',
  ],
  toc: [
    'Svenska lantraser',
    'Klassiska hobbyraser',
    'Dvärgraser',
    'Prydnadshöns',
    'Produktionshybrider',
    'Stor jämförelsetabell',
    'Vanliga frågor',
  ],
  sections: [
    {
      heading: 'Svenska lantraser',
      paragraphs: [
        'De svenska lantraserna är genbankshöns som bevaras av Svenska Lanthönsklubben. De är historiskt anpassade till vårt klimat och har överlag bra hälsa, även om värpningen är blygsammare än hybrider.',
      ],
      bullets: [
        'Skånsk blommehöna – färgglad, lugn, ~180 ägg/år.',
        'Hedemora – mycket tålig, fjäderrik, perfekt för kalla vintrar.',
        'Bohuslän–Dals svarthöna – mörkt skinn och ben, ovanlig.',
        'Öländsk dvärghöna – kompakt och pigg.',
        'Gotlandshöna – smal, aktiv och en duktig värpare för en lantras.',
        'Åsbohöna – sällsynt, samlarintresse.',
        'Kindahöna – pigga och självständiga.',
        'Orusthöna – sällsynt västsvensk ras.',
      ],
    },
    {
      heading: 'Klassiska hobbyraser',
      paragraphs: [
        'Det här är de raser man oftast ser i svenska hobbyflockar utanför lantrasvärlden. De har funnits länge och har stabila egenskaper.',
      ],
      bullets: [
        'Orpington – fluffig, snäll, värper hyfsat, ruvar gärna.',
        'Wyandotte – kompakt, lugn, vacker.',
        'Sussex – allround, värper bra, frigående.',
        'Plymouth Rock – ofta randig, robust och trygg.',
        'Rhode Island Red – klassisk värphöna, lite mer framåt.',
        'Marans – berömd för sina mörkbruna ägg.',
        'Araucana / Cream Legbar – blå/gröna ägg.',
        'Brahma – jätte, otroligt lugn.',
        'New Hampshire – vänlig och produktiv.',
        'Vorwerk – ovanlig men vacker bicolour.',
      ],
    },
    {
      heading: 'Dvärgraser',
      paragraphs: [
        'Dvärgraserna tar mindre plats, äter mindre och passar små tomter, barnfamiljer och pedagogiskt syfte. De värper mindre ägg som ofta väger 35–45 gram istället för 60+.',
      ],
      bullets: [
        'Sebright – liten, vacker med tydligt fjädermönster.',
        'Holländsk dvärg – pigg och liten.',
        'Wyandotte bantam – samma lugn som standard, halva storleken.',
        'Orpington bantam – charmig miniatyr.',
        'Booted bantam – fjäderbenta dvärgar.',
      ],
    },
    {
      heading: 'Prydnadshöns',
      paragraphs: [
        'Här hamnar raser som man har för att de är vackra eller speciella, snarare än för produktion. Värpningen är ofta låg men de tillför karaktär.',
      ],
      bullets: [
        'Silkeshöna – ulligt fjäderdräkt, fantastisk ruvare.',
        'Polverara / Polish – höga fjädertofsar på huvudet.',
        'Houdan – tofs och muff.',
        'Frizzle – krullig fjäderdräkt.',
        'Ayam Cemani – helsvart inifrån och ut, sällsynt.',
      ],
    },
    {
      heading: 'Alla 30 rasguider – A till Ö',
      paragraphs: [
        'Här är alla enskilda rasguider vi har skrivit. Klicka dig vidare för fördjupning: värpning, temperament, vinterhärdighet i svenskt klimat, ljudnivå, nybörjarvänlighet och FAQ per ras.',
      ],
      bullets: [
        'Araucana – blå/gröna ägg, pigg. Läs mer: /honsraser/araucana',
        'Australorp – lugn högvärpare (~250). Läs mer: /honsraser/australorp',
        'Barnevelder – mörkbruna ägg, snäll. Läs mer: /honsraser/barnevelder',
        'Bielefelder – modern autosexande allroundras. Läs mer: /honsraser/bielefelder',
        'Bohuslän-Dals svarthöna – svensk lantras, svart. Läs mer: /honsraser/bohuslan-dals-svarthona',
        'Brahma – lugn jätte. Läs mer: /honsraser/brahma',
        'Cochin – fluffig ruvare. Läs mer: /honsraser/cochin',
        'Dvärghöns – översikt av dvärgraser. Läs mer: /dvarghons',
        'Faverolle – lugn skäggig fransk ras. Läs mer: /honsraser/faverolle',
        'Frisisk höna – pigg gammal lantras. Läs mer: /honsraser/frisisk-hona',
        'Gotlandshöna – svensk lantras, aktiv. Läs mer: /honsraser/gotlandshona',
        'Hedemorahöna – extremt vinterhärdig svensk lantras. Läs mer: /honsraser/hedemorahona',
        'Kindahöna – östgötsk svensk lantras. Läs mer: /honsraser/kindahona',
        'Maran – chokladbruna ägg. Läs mer: /honsraser/maran',
        'New Hampshire – snällare version av RIR. Läs mer: /honsraser/new-hampshire',
        'Orpington – fluffig allroundras. Läs mer: /honsraser/orpington',
        'Plymouth Rock – trygg amerikansk klassiker. Läs mer: /honsraser/plymouth-rock',
        'Rhode Island Red – härdig brunvärpare. Läs mer: /honsraser/rhode-island-red',
        'Sebright – vacker prydnadsdvärg. Läs mer: /honsraser/sebright',
        'Silkeshöns – världens bästa ruvare. Läs mer: /honsraser/silkeshons',
        'Skånsk blommehöna – sydsvensk lantras. Läs mer: /honsraser/skansk-blommehona',
        'Sussex – nyfiken engelsk allroundras. Läs mer: /honsraser/sussex',
        'Vit leghorn – italiensk högvärpare. Läs mer: /honsraser/vit-leghorn',
        'Vorwerk – ovanlig tysk bicolour. Läs mer: /honsraser/vorwerk',
        'Welsumer – terrakotta-bruna prickiga ägg. Läs mer: /honsraser/welsumer',
        'Wyandotte – kompakt lugn allroundras. Läs mer: /honsraser/wyandotte',
        'Öländsk höna – svensk lantras-dvärg. Läs mer: /honsraser/olandsk-hona',
      ],
    },
    {
      heading: 'Produktionshybrider',
      paragraphs: [
        'Hybriderna är inte “raser” i strikt mening utan korsningar avlade för maximal äggvolym. De är vanliga att köpa unga från större uppfödare.',
      ],
      bullets: [
        'ISA Brown – ~300 ägg år 1, snäll, brun ägg.',
        'Lohmann Brown – mycket lik ISA, stabil värpning.',
        'Bovans Brown – brunbrukshöna.',
        'Hisex – vitvärpande hybrid.',
        'Dekalb White – vita ägg, livlig.',
      ],
    },
  ],
  breedTable: [
    { namn: 'Skånsk blommehöna', ursprung: 'Sverige', vikt: '1,7–2,2 kg', agg_per_ar: '~180', aggfarg: 'Ljusbeige', temperament: 'Lugn', passar: 'Familj' },
    { namn: 'Hedemora', ursprung: 'Sverige', vikt: '1,8–2,5 kg', agg_per_ar: '~150', aggfarg: 'Krämvit', temperament: 'Tålig', passar: 'Kall vinter' },
    { namn: 'Bohusläns svarthöna', ursprung: 'Sverige', vikt: '1,5–2 kg', agg_per_ar: '~150', aggfarg: 'Krämvit', temperament: 'Pigg', passar: 'Ovanlig samling' },
    { namn: 'Öländsk dvärghöna', ursprung: 'Sverige', vikt: '0,6–0,9 kg', agg_per_ar: '~120', aggfarg: 'Vit', temperament: 'Aktiv', passar: 'Liten tomt' },
    { namn: 'Orpington', ursprung: 'England', vikt: '3–4,5 kg', agg_per_ar: '~180', aggfarg: 'Beige', temperament: 'Mjuk', passar: 'Barnfamilj' },
    { namn: 'Wyandotte', ursprung: 'USA', vikt: '2,5–3,5 kg', agg_per_ar: '~200', aggfarg: 'Krämbeige', temperament: 'Lugn', passar: 'Allround' },
    { namn: 'Sussex', ursprung: 'England', vikt: '2,5–3,5 kg', agg_per_ar: '~240', aggfarg: 'Beige', temperament: 'Social', passar: 'Frigående' },
    { namn: 'Plymouth Rock', ursprung: 'USA', vikt: '2,5–3,5 kg', agg_per_ar: '~200', aggfarg: 'Beige', temperament: 'Trygg', passar: 'Hobby' },
    { namn: 'Rhode Island Red', ursprung: 'USA', vikt: '2,5–3,5 kg', agg_per_ar: '~250', aggfarg: 'Brun', temperament: 'Aktiv', passar: 'Värpning' },
    { namn: 'Marans', ursprung: 'Frankrike', vikt: '2,5–3,5 kg', agg_per_ar: '~180', aggfarg: 'Chokladbrun', temperament: 'Lugn', passar: 'Vackra ägg' },
    { namn: 'Araucana', ursprung: 'Chile', vikt: '1,5–2,5 kg', agg_per_ar: '~180', aggfarg: 'Blå/grön', temperament: 'Pigg', passar: 'Försäljning' },
    { namn: 'Brahma', ursprung: 'USA/Asien', vikt: '4–5 kg', agg_per_ar: '~150', aggfarg: 'Beige', temperament: 'Lugn jätte', passar: 'Sällskap' },
    { namn: 'Silkeshöna', ursprung: 'Asien', vikt: '0,8–1,5 kg', agg_per_ar: '~100', aggfarg: 'Krämvit', temperament: 'Mycket lugn', passar: 'Ruvning' },
    { namn: 'Sebright (dvärg)', ursprung: 'England', vikt: '0,5–0,7 kg', agg_per_ar: '~80', aggfarg: 'Liten vit', temperament: 'Aktiv', passar: 'Prydnad' },
    { namn: 'ISA Brown (hybrid)', ursprung: 'Frankrike', vikt: '2 kg', agg_per_ar: '~300', aggfarg: 'Brun', temperament: 'Snäll', passar: 'Äggvolym' },
    { namn: 'Lohmann Brown (hybrid)', ursprung: 'Tyskland', vikt: '2 kg', agg_per_ar: '~300', aggfarg: 'Brun', temperament: 'Snäll', passar: 'Äggvolym' },
  ],
  faq: [
    { q: 'Hur många hönsraser finns i Sverige?', a: 'Drygt 25–30 räknas som vanliga i hobbyflockar, plus de svenska lantraserna och ett antal sällsynta utställningsraser.' },
    { q: 'Vilken hönsras är vanligast i Sverige?', a: 'Bland hobbyflockar är orpington, wyandotte och sussex bland de absolut vanligaste. I produktion dominerar ISA Brown och Lohmann Brown.' },
    { q: 'Är hybridhöns en egen ras?', a: 'Nej, det är korsningar mellan olika linjer som avlats för stora ägg eller mycket kött. De är inte stamboksförda raser.' },
    { q: 'Vilken ras lägger blå ägg?', a: 'Araucana, Cream Legbar och vissa korsningar (ibland kallade Easter Eggers) lägger blå eller grönaktiga ägg.' },
  ],
  relatedLinks: standardRelated,
};

// ---------- Dvärghöns (480/mån, position 30) ----------
const dvarghons: LongformPage = {
  slug: 'dvarghons',
  path: '/dvarghons',
  title: 'Dvärghöns – små höns för tomten | Hönsgården',
  description:
    'Dvärghöns är perfekta för små tomter, barnfamiljer och de som vill ha färre ägg men mer charm. Guide till raser, skötsel och ägg.',
  h1: 'Dvärghöns – små höns med stor personlighet',
  eyebrow: 'Guide till dvärghöns',
  intro: [
    'Dvärghöns – eller bantamhöns som många säger – är en favoritkategori för många hobbyhönsägare. De tar mindre plats, äter mindre, är ofta otroligt charmiga och passar familjer där hönsen ska vara en del av vardagen snarare än en äggfabrik. Jag har själv haft öländska dvärghöns och wyandotte bantam i mindre flockar och kan varmt rekommendera dem till nybörjare.',
    'Den här guiden går igenom vad dvärghöns egentligen är, vilka raser som finns, hur mycket ägg du kan räkna med, hur du sköter dem och vad du ska tänka på om du redan har stora höns och funderar på att blanda.',
  ],
  toc: [
    'Vad är dvärghöns?',
    'Populära dvärgraser',
    'Hur många ägg lägger en dvärghöna?',
    'Skötsel och hönshus för dvärgar',
    'Att blanda dvärghöns med stora höns',
    'Vanliga frågor',
  ],
  sections: [
    {
      heading: 'Vad är dvärghöns?',
      paragraphs: [
        'Dvärghöns delas i två grupper: äkta dvärgraser (true bantams) som bara finns i miniatyr, och miniatyrer av större raser. Sebright, holländsk dvärg och öländsk dvärghöna är exempel på äkta dvärgar. Wyandotte bantam, orpington bantam och plymouth rock bantam är miniatyrversioner av sina större kusiner.',
        'En dvärghöna väger typiskt mellan 600 gram och 1,2 kilo. Det är ungefär en tredjedel av en standardhöna. Äggen är också mindre, ofta 35–45 gram istället för 55–65 gram, men ändå fullt användbara i köket. Jag brukar säga till nybörjare att “två dvärghönsägg är ett vanligt ägg” – det stämmer inte riktigt matematiskt, men praktiskt ofta bra.',
      ],
    },
    {
      heading: 'Populära dvärgraser',
      paragraphs: [
        'Det finns dussintals dvärgraser. Här är de som du oftast ser i Sverige och som jag rekommenderar att titta på:',
      ],
      bullets: [
        'Öländsk dvärghöna – svensk lantras, kompakt, värper hyfsat, klarar vintern fint.',
        'Wyandotte bantam – samma lugn som stora wyandotte, halva storleken, kommer i många färger.',
        'Orpington bantam – fluffig och snäll, perfekt familjehöna.',
        'Sebright – små guld- eller silverspetsade, mer prydnad än värphöna.',
        'Holländsk dvärg – pigg, social, lägger flitigt små ägg.',
        'Booted bantam – fjäderbenta, charmiga.',
        'Silkeshöna – tekniskt en lättviktsras snarare än dvärg, men ofta i samma kategori.',
      ],
    },
    {
      heading: 'Hur många ägg lägger en dvärghöna?',
      paragraphs: [
        'Räkna med 100–180 ägg per år beroende på ras. Öländsk dvärghöna och holländsk dvärg ligger högt, sebright och booted lägre. Äggen är mindre men ofta otroligt smakrika och passar utmärkt till bakning, frukost eller äggröra om man tar två istället för ett.',
        'En liten flock med fem dvärghöns räcker bra för en familj som äter ägg några gånger i veckan. Det blir inte de stora säljvolymerna, men det blir alltid något i äggkorgen.',
      ],
    },
    {
      heading: 'Skötsel och hönshus för dvärgar',
      paragraphs: [
        'Dvärghöns behöver lite mindre yta än stora höns men principerna är samma: torrt och dragfritt hönshus, sittpinne, rede, rastgård och rovdjurssäkring. Eftersom de är små kan de bli byten för katter, kråkor och måsar mer än stora höns – tänk extra på taknät eller överbyggd rastgård.',
        'Foderåtgången är cirka en tredjedel av en stor höna, runt 70–90 gram per dygn. De äter samma värpfoder som vanliga höns, gärna kompletterat med musselskal för bra äggskal. Vinterhärdigheten är ras-beroende: hedemora-släkten och fjäderrika raser klarar kyla mycket bra, sebright är känsligare.',
        'Det enda jag tycker man särskilt ska tänka på är att dvärghöns ofta vill ruva. Sätt rätt antal ägg under en ruvande dvärghöna (6–8 räcker) och låt henne inte ruva igen direkt efteråt, för det sliter på små höns.',
      ],
    },
    {
      heading: 'Att blanda dvärghöns med stora höns',
      paragraphs: [
        'Det går att blanda – men introducera dem försiktigt. Stora höns kan hacka och köra över små i hierarkikampen, särskilt vid kommande matplats och sittpinne. Min erfarenhet är att blandning fungerar bäst när:',
      ],
      bullets: [
        'Du har gott om plats, både i hönshus och rastgård.',
        'Du introducerar nya genom delad rastgård i några dagar innan ihopsläpp.',
        'Du har flera matskålar och vattenkällor utspridda.',
        'Du har sittpinnar i flera höjder.',
        'De stora hönsens raser har lugnt temperament – orpington och wyandotte funkar bra, en aggressiv leghorn kanske inte.',
      ],
    },
  ],
  faq: [
    { q: 'Hur många ägg lägger en dvärghöna per år?', a: 'Vanligen 100–180 ägg per år beroende på ras. Äggen är mindre, ofta 35–45 gram.' },
    { q: 'Klarar dvärghöns svensk vinter?', a: 'Ja, de flesta klarar svensk vinter bra om hönshuset är torrt och dragfritt. Fjäderrika och svenska raser är extra härdiga.' },
    { q: 'Hur mycket plats behöver dvärghöns?', a: 'Räkna med minst 1 kvm hönshus per 3–4 höns och en rastgård på minst 5–10 kvm per höna för bra trivsel.' },
    { q: 'Kan dvärghöns vara med stora höns i flocken?', a: 'Ja, men introducera dem gradvis och säkerställ flera mat- och vattenplatser så hierarkin inte blir orättvis.' },
    { q: 'Vad är skillnaden mellan dvärghöns och bantam?', a: 'Det är samma sak. Bantam är det engelska ordet, dvärghöns det svenska.' },
  ],
  relatedLinks: standardRelated,
};

// ---------- Skånsk blommehöna äggfärg (140/mån, position 10) ----------
const skanskBlommehona: LongformPage = {
  slug: 'skansk-blommehona',
  path: '/skansk-blommehona',
  title: 'Skånsk blommehöna – äggfärg, värpning & skötsel',
  description:
    'Allt om skånsk blommehöna: äggfärg, värpning per år, temperament, vinterhärdighet och varför den är en av Sveriges bästa lantraser.',
  h1: 'Skånsk blommehöna – en av Sveriges vackraste lantraser',
  eyebrow: 'Svensk lantras',
  intro: [
    'Av alla höns jag haft genom åren är skånsk blommehöna den jag oftast rekommenderar till familjer som vill ha en mindre, snäll flock av en svensk lantras. Den är vacker, värper hyfsat, klarar vintern utan dramatik och har ett lugnt temperament som gör den lätt att leva med.',
    'En sak folk googlar oerhört mycket är “skånsk blommehöna äggfärg”, så jag tar det direkt: äggen är ljust krämbeige, ibland nästan vita, ibland med en svag rosaton. De är förvånansvärt stora för en sådan liten höna, runt 50–60 gram, vilket är en stor del av charmen.',
  ],
  toc: [
    'Vad är en skånsk blommehöna?',
    'Äggfärg och äggstorlek',
    'Värpning – hur många ägg per år?',
    'Temperament och beteende',
    'Vinterhärdighet och skötsel',
    'Var köper man skånsk blommehöna?',
    'Vanliga frågor',
  ],
  sections: [
    {
      heading: 'Vad är en skånsk blommehöna?',
      paragraphs: [
        'Skånsk blommehöna är en svensk lantras som bevaras av Svenska Lanthönsklubben. Den har funnits i sydligaste Sverige i flera hundra år och fick sitt namn eftersom varje höna är “blommig” – ingen ser likadan ut. Fjäderdräkten är ofta vit eller svartvit som grund med stora färgfläckar i brunt, svart och beige.',
        'Det är ingen utställningsras i traditionell mening – det är meningen att varje individ ska vara unik. För mig är det en del av tjusningen. När man har en flock på sex stycken är det som att gå ut till sex helt egna personligheter.',
      ],
    },
    {
      heading: 'Äggfärg och äggstorlek',
      paragraphs: [
        'Skånsk blommehöna lägger ägg som är ljust krämfärgade till svagt beige. Inom samma flock kan det finnas individer som lägger nästan vita ägg och andra som lägger något mer beige. De är inte chokladbruna som marans, inte blå som araucana – utan en mjuk, lite varmare vit. Många tycker att de ser ut som typiska “gårdsägg”, vilket de är.',
        'Äggvikten ligger oftast på 50–60 gram, vilket är riktigt bra med tanke på att en blommehöna bara väger 1,7–2,2 kg. Stora höns lägger inte alltid större ägg, och blommehönan är ett bra exempel på att en liten höna kan leverera nästan i klass med en standardstor.',
      ],
    },
    {
      heading: 'Värpning – hur många ägg per år?',
      paragraphs: [
        'Räkna med cirka 150–200 ägg per höna och år. Det är bättre än många andra lantraser, men förstås en bra bit under vad en ISA Brown levererar första året. Den stora skillnaden är att blommehönan håller längre – det är inte ovanligt att en blommehöna värper hyfsat i fyra–fem år, medan hybriderna ofta börjar krascha efter två.',
        'På vintern går värpningen ner som hos alla höns. Min erfarenhet är att blommehönorna ändå lägger något ägg då och då även i mörka december, särskilt om de är yngre. Vill du ha jämn produktion året om kan du blanda in en hybrid eller två.',
      ],
    },
    {
      heading: 'Temperament och beteende',
      paragraphs: [
        'Det här är skånsk blommehönans riktigt stora styrka. De är lugna, social och inte alls aggressiva. De flesta lär sig snabbt att hoppa upp i knät för att få lite gurka. Jag har aldrig haft en blommehöna som varit hetsig mot barn.',
        'De ruvar gärna och blir ofta riktigt bra mammor. Vill du föda upp egna kycklingar är blommehönan ett naturligt val – och man slipper kläckningsmaskin om man har en ruvande höna i flocken.',
      ],
    },
    {
      heading: 'Vinterhärdighet och skötsel',
      paragraphs: [
        'Som inhemsk lantras klarar blommehönan svensk vinter väldigt bra. Kammen är inte enorm och därför sällan utsatt för frostbett. Det viktiga är samma som för alla höns: torrt och dragfritt hönshus, sittpinne, friskt vatten varje dag, värpfoder som baskost och tillgång till strö för dammbad.',
        'Eftersom de gärna går ute behöver rastgården vara rovdjurssäker. Räv, hök och mård är de vanligaste fienderna jag haft besök av. Ett ordentligt nät uppåt mot rovfåglar är värt all möda.',
      ],
    },
    {
      heading: 'Var köper man skånsk blommehöna?',
      paragraphs: [
        'Eftersom det är en genbanksras säljs den oftast direkt av uppfödare som är anslutna till Svenska Lanthönsklubben. Du hittar dem genom klubbens uppfödarregister, ibland via Facebook-grupper för svenska lantraser, och i mindre utsträckning via Blocket. Köp helst som unghöna (16–20 veckor) första gången – då är de nära värpning men förbi den känsligaste kycklingfasen.',
        'Räkna med 250–500 kronor per unghöna beroende på säljare. Köp gärna 3–5 stycken samtidigt; höns är flockdjur och mår dåligt ensamma.',
      ],
    },
  ],
  faq: [
    { q: 'Vilken äggfärg har skånsk blommehöna?', a: 'Ljust krämbeige, ibland nästan vita med svag rosaton. Färgen kan variera lite mellan individer i samma flock.' },
    { q: 'Hur många ägg lägger en skånsk blommehöna per år?', a: 'Cirka 150–200 ägg per år. De värper hyfsat även som äldre, ofta i 4–5 år.' },
    { q: 'Hur stor är en skånsk blommehöna?', a: 'En höna väger 1,7–2,2 kg och en tupp 2,2–2,8 kg. Det är en småmedelstor lantras.' },
    { q: 'Klarar skånsk blommehöna vintern utomhus?', a: 'Ja, den är härdig och klarar svensk vinter mycket bra om hönshuset är torrt och dragfritt.' },
    { q: 'Är skånsk blommehöna snäll mot barn?', a: 'Ja, den är en av de lugnaste svenska lantraserna och passar barnfamiljer utmärkt.' },
    { q: 'Var kan jag köpa skånsk blommehöna?', a: 'Via Svenska Lanthönsklubbens uppfödarregister, lantrasgrupper på Facebook och ibland på Blocket. Räkna med 250–500 kronor per unghöna.' },
  ],
  relatedLinks: standardRelated,
};

import { BREED_PROFILES, buildBreedPage } from './honsraserBreedProfiles';

const staticPages: Record<string, LongformPage> = {
  honsraser,
  'honsraser-lista': honsraserLista,
  dvarghons,
  'skansk-blommehona': skanskBlommehona,
};

const breedPages: Record<string, LongformPage> = Object.fromEntries(
  BREED_PROFILES.map((b) => [b.slug, buildBreedPage(b)]),
);

export const longformPages: Record<string, LongformPage> = {
  ...staticPages,
  ...breedPages,
};

export const longformSlugs = Object.keys(longformPages);
export const breedLongformSlugs = Object.keys(breedPages);
