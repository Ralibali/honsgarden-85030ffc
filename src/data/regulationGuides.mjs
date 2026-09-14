// Delad datamodul för regelguiderna.
// Konsumeras av både `src/pages/RegulationGuide.tsx` (React) och
// `scripts/prerender-blog-posts.mjs` (SEO-prerender). Ändra innehåll här –
// prerender-scriptet plockar upp uppdateringen vid nästa build.

/** @typedef {{ id: string, heading: string, html: string }} Section */
/** @typedef {{ q: string, a: string }} Faq */
/**
 * @typedef {Object} RegulationGuide
 * @property {string} slug
 * @property {string} title
 * @property {string} h1
 * @property {string} metaDescription
 * @property {string} excerpt
 * @property {string} updated       ISO-datum (YYYY-MM-DD)
 * @property {string} ogImage
 * @property {string} introHtml
 * @property {Section[]} sections
 * @property {Faq[]} faqs
 * @property {{ href: string, label: string }[]} relatedLinks
 * @property {{ href: string, label: string }[]} authorityLinks
 */

/** @type {RegulationGuide[]} */
export const REGULATION_GUIDES = [
  {
    slug: 'registrera-hons-jordbruksverket',
    title: 'Registrera dina höns hos Jordbruksverket – så gör du (2026)',
    h1: 'Registrera dina höns hos Jordbruksverket – så gör du',
    metaDescription:
      'Alla som håller fjäderfän – även hobbyhöns – ska registrera sin anläggning hos Jordbruksverket. Så gör du registreringen, plus kommunens regler och fågelinfluensa.',
    excerpt:
      'Alla som håller fjäderfän, även hobbyhönsägare med tre höns i trädgården, ska anmäla sin anläggning till Jordbruksverket. Så gör du – och så koll du kommunens regler.',
    updated: '2026-07-02',
    ogImage: '/og-image.jpg',
    introHtml: `<p>Om du håller höns – oavsett om det är tre värphönor i villaträdgården eller trettio på gården – räknas du som djurhållare av fjäderfän. Enligt <strong>Jordbruksverkets föreskrifter</strong> ska alla anläggningar där fjäderfän hålls vara registrerade. Registreringen är gratis, gäller tills vidare och tar oftast bara några minuter. Här går vi igenom varför, hur och vad du dessutom bör kolla med din kommun.</p>`,
    sections: [
      {
        id: 'vem-maste-registrera',
        heading: 'Vem måste registrera sina höns?',
        html: `<p>Registreringskravet gäller <strong>alla</strong> som håller fjäderfän i Sverige – höns, kalkoner, ankor, gäss, vaktlar och strutsfåglar – oavsett antal och oavsett om djuren är för husbehov eller kommersiellt bruk. Även den som har två höns för äggproduktion till egen frukost omfattas.</p>
<p>Syftet är att myndigheterna snabbt ska kunna nå dig vid utbrott av smittsamma sjukdomar som <em>fågelinfluensa</em> eller <em>Newcastlesjuka</em>, och att spåra kontakter mellan besättningar. Utan registrering får du varken varningar eller information om restriktioner i ditt område.</p>`,
      },
      {
        id: 'sa-registrerar-du',
        heading: 'Så registrerar du – steg för steg',
        html: `<ol class="list-decimal ml-5 space-y-2 my-4 text-foreground/85">
<li>Gå till Jordbruksverkets e-tjänst <strong>"Anläggningsregistret"</strong> (även kallat "Registrera din anläggning för djurhållning").</li>
<li>Logga in med BankID.</li>
<li>Välj djurslag <em>fjäderfä</em> och ange högsta antal individer du planerar att hålla samtidigt.</li>
<li>Fyll i fastighetsbeteckning, adress och kontaktuppgifter.</li>
<li>Skicka in. Du får ett produktionsplatsnummer (PPN) i retur – spara det.</li>
</ol>
<p>Föredrar du papper går det att beställa hem blanketten <em>"Registrering av anläggning där djur hålls"</em> från Jordbruksverket och skicka in per post. E-tjänsten går normalt snabbare.</p>
<p><strong>Uppdatera registret</strong> om något ändras – nytt antal djur, ny adress, byte av djurslag eller om du slutar med hönshållning. Detta är också ett krav.</p>`,
      },
      {
        id: 'kommunens-regler',
        heading: 'Kommunen kan kräva tillstånd – kolla lokalt',
        html: `<p>Utöver Jordbruksverkets registrering har din <strong>kommun</strong> egna regler som styr om du får hålla höns på din fastighet. Inom <em>detaljplanerat område</em> (i praktiken de flesta villaområden och tätorter) kräver kommunen ofta ett särskilt tillstånd enligt lokala hälsoskyddsföreskrifter.</p>
<p>Typiska villkor från svenska kommuner:</p>
<ul class="my-3 ml-5 list-disc text-foreground/85">
<li><strong>Max 5–6 höns</strong>. Vissa kommuner tillåter upp till 10.</li>
<li><strong>Tupp är sällan tillåten</strong> i tätort – på grund av gal och grannklagomål.</li>
<li><strong>Minimiavstånd</strong> från hönshus till grannens tomtgräns (ofta 4,5 meter).</li>
<li>Krav på <strong>skadedjursfri förvaring</strong> av foder.</li>
<li>Grannehörande innan tillstånd beviljas.</li>
</ul>
<p>Ring miljö- och hälsoskyddskontoret i din kommun eller sök på "hålla höns [din kommun]" – de flesta kommuner har en tydlig sida om reglerna. Utanför detaljplanerat område (på landet) krävs oftast inget kommunalt tillstånd, men Jordbruksverkets registrering gäller lika mycket där.</p>`,
      },
      {
        id: 'fagelinfluensa',
        heading: 'Fågelinfluensa – restriktioner du bör känna till',
        html: `<p>När fågelinfluensa (särskilt <em>H5N1</em>) sprids i Sverige delar Jordbruksverket in landet i <strong>skydds- och övervakningsområden</strong> runt varje utbrott. Är du registrerad får du <strong>direktinformation</strong> om restriktioner som gäller din anläggning.</p>
<p>Under skärpta lägen kan det innebära:</p>
<ul class="my-3 ml-5 list-disc text-foreground/85">
<li><strong>Utegångsförbud</strong> – hönorna måste hållas inomhus eller under tak/nät.</li>
<li>Förbud mot att flytta fåglar eller ägg mellan anläggningar.</li>
<li>Skyldighet att rapportera onormal dödlighet.</li>
</ul>
<p>Håll koll på <strong>Jordbruksverkets kartverktyg</strong> för aktuella restriktionsområden. Rapportera själv misstänkta fall (plötslig dödlighet, blodig diarré, nedsatt värpning i kombination) till din länsveterinär.</p>`,
      },
      {
        id: 'checklista',
        heading: 'Checklista innan hönorna flyttar in',
        html: `<ul class="my-3 ml-5 list-disc text-foreground/85 space-y-1">
<li>✅ Registrerad anläggning hos Jordbruksverket (produktionsplatsnummer i handen)</li>
<li>✅ Kollat kommunens regler – tillstånd sökt om det behövs</li>
<li>✅ Hönshus och rastgård uppfyller djurskyddskraven (minst 0,5 m² inne, 4 m² ute per höna)</li>
<li>✅ Vet hur du hittar Jordbruksverkets restriktionskarta för fågelinfluensa</li>
<li>✅ Sparat kontaktuppgifter till länsstyrelsens djurskyddshandläggare och närmaste veterinär</li>
</ul>`,
      },
    ],
    faqs: [
      {
        q: 'Måste jag registrera mig även om jag bara har tre höns?',
        a: 'Ja. Registreringskravet gäller alla som håller fjäderfän i Sverige, oavsett antal och syfte. Även tre hobbyhöns räknas som en anläggning som ska anmälas till Jordbruksverket.',
      },
      {
        q: 'Vad kostar registreringen?',
        a: 'Registreringen hos Jordbruksverket är gratis och gäller tills vidare. Du behöver dock uppdatera uppgifterna om något ändras – till exempel adress, djurslag eller antal.',
      },
      {
        q: 'Får jag ha höns i villaträdgården?',
        a: 'Det beror på din kommun. Inom detaljplanerat område krävs ofta kommunalt tillstånd, och tupp är sällan tillåten. Kolla med miljö- och hälsoskyddskontoret i din kommun innan du skaffar höns.',
      },
      {
        q: 'Vad händer om jag inte registrerar mig?',
        a: 'Utan registrering riskerar du både föreläggande och sanktionsavgift, och du får ingen information om restriktioner vid smittutbrott. Vid en fågelinfluensakontroll räknas oregistrerad hönshållning som en försvårande omständighet.',
      },
      {
        q: 'Hur lång tid tar registreringen?',
        a: 'Själva ifyllandet via Jordbruksverkets e-tjänst tar oftast 5–10 minuter med BankID. Bekräftelsen med produktionsplatsnummer får du direkt på skärmen.',
      },
    ],
    relatedLinks: [
      { href: '/verktyg/aggregler-vagvisare', label: 'Äggregler-vägvisaren – vilka regler gäller just dig?' },
      { href: '/borja-med-hons', label: 'Börja med höns – nybörjarguide' },
      { href: '/guider/salja-agg-regler', label: 'Sälja ägg från egna höns – reglerna i klartext' },
      { href: '/salja-agg', label: 'Sälja ägg privat – översikt' },
    ],
    authorityLinks: [
      { href: 'https://jordbruksverket.se/djur/fjaderfa', label: 'Jordbruksverket – Fjäderfä' },
      { href: 'https://jordbruksverket.se/djur/lantbruksdjur/register-och-mark/registrera-anlaggning-med-djur', label: 'Jordbruksverket – Registrera anläggning med djur' },
    ],
  },
  {
    slug: 'salja-agg-regler',
    title: 'Sälja ägg från egna höns – reglerna i klartext (2026)',
    h1: 'Sälja ägg från egna höns – reglerna i klartext',
    metaDescription:
      'Får du sälja ägg från dina egna höns? Ja, direkt till konsument från upp till 350 fjäderfän – men det finns regler för registrering, foder och salmonella. Så funkar det.',
    excerpt:
      'Får du sälja överskottsäggen? Ja, direktförsäljning till konsument är tillåten upp till 350 fjäderfän – men reglerna om registrering, foder och salmonella måste följas. Här är sammanfattningen.',
    updated: '2026-07-02',
    ogImage: '/og-image.jpg',
    introHtml: `<p>Har du fler ägg än familjen orkar äta upp? Bra nyhet: att sälja överskottsägg direkt till konsument är i grunden tillåtet i Sverige – på gården, på torget eller via en REKO-ring. Men det finns regler kring registrering, foder och salmonella som du behöver ha koll på för att sälja lagligt. Här är sammanfattningen som täcker det viktigaste utan att bli en lagbok.</p>`,
    sections: [
      {
        id: 'grundregeln',
        heading: 'Grundregeln: 350 fjäderfän och direktförsäljning',
        html: `<p>Enligt EU:s hygienregler får en producent sälja ägg <strong>direkt till slutkonsument eller till lokal detaljhandel</strong> från en besättning på <strong>upp till 350 fjäderfän</strong>. Direktförsäljning innebär att äggen går från dig till den som ska äta dem – på gården, på bondens marknad, i en REKO-ring eller genom att kunden hämtar hos dig.</p>
<p>Har du fler än 350 fjäderfän, eller vill sälja via en butik (inte direkt till slutkonsument), behöver äggen gå via ett <strong>godkänt äggpackeri</strong> som klassificerar och märker äggen. Det är en helt annan hantering och kräver mer.</p>`,
      },
      {
        id: 'registrera-primarproduktion',
        heading: 'Registrera produktionen – två olika register',
        html: `<p>Det finns två registreringar som ofta blandas ihop:</p>
<ol class="list-decimal ml-5 space-y-2 my-4 text-foreground/85">
<li><strong>Jordbruksverket:</strong> alla som håller fjäderfän registrerar sin anläggning (se vår <a href="/guider/registrera-hons-jordbruksverket" class="text-primary underline">guide om Jordbruksverkets registrering</a>).</li>
<li><strong>Länsstyrelsen:</strong> om du säljer äggen behöver produktionen även vara registrerad som <em>primärproducent av livsmedel</em> hos länsstyrelsen i ditt län. Det görs via en enkel blankett/e-tjänst.</li>
</ol>
<p><strong>50-hönagränsen:</strong> Den som håller <strong>fler än 50 värphöns</strong> räknas automatiskt som <em>livsmedelsföretagare inom primärproduktion</em>. Då kommer länsstyrelsen på kontroll (oftast vart 3:e år), och det finns skarpare krav på egenkontroll, spårbarhet och salmonellaprovtagning. Under 50 höns räknas det oftast som "obetydlig omfattning", men grundreglerna om säker mat gäller ändå.</p>`,
      },
      {
        id: 'foder-och-smittskydd',
        heading: 'Foder – vad hönorna INTE får äta',
        html: `<p>Reglerna kring vad hönor får utfodras med är strikta av <strong>smittskyddsskäl</strong>. Det viktigaste förbudet: du får <strong>inte utfodra höns med animaliska restprodukter</strong> från köket – alltså inga matrester som innehåller kött, fisk, mejeri eller ägg.</p>
<p>Även om du bara säljer till grannen gäller detta. Reglerna finns för att förhindra spridning av sjukdomar som <em>fågelinfluensa</em>, <em>salmonella</em> och <em>galna ko-sjukan</em> (även om det senare inte drabbar höns direkt).</p>
<ul class="my-3 ml-5 list-disc text-foreground/85 space-y-1">
<li>✅ Kommersiellt hönsfoder – grunden</li>
<li>✅ Rent spannmål, gräs, grönsaker, frukt</li>
<li>✅ Grit och kalk för äggskal</li>
<li>❌ Matrester med kött, fisk eller mejerier</li>
<li>❌ Matavfall från restauranger eller kök där kött hanteras</li>
<li>❌ Egna eller andras hönsägg (även skal)</li>
</ul>`,
      },
      {
        id: 'salmonella',
        heading: 'Salmonella – provtagning kan krävas',
        html: `<p>Sverige har ett <strong>salmonellakontrollprogram</strong> för fjäderfä. För anläggningar över 250 värphöns finns krav på regelbunden salmonellaprovtagning enligt fastställt schema. Under den gränsen är kravet mildare, men om djurhållare eller köpare misstänker salmonella – till exempel efter magsjuka – har länsstyrelsen mandat att beställa provtagning.</p>
<p>Om salmonella påvisas är hela besättningen belagd med restriktioner, äggen får inte säljas och du behöver ofta avliva flocken. Det är därför god <strong>hygien i hönshuset</strong>, rent foder och skydd mot vilda fåglar (som kan bära smittan) är centralt för alla som säljer ägg – även småskaligt.</p>`,
      },
      {
        id: 'marknad-reko-torget',
        heading: 'REKO-ringar, torget och gårdsförsäljning',
        html: `<p>Alla tre kanaler räknas som direktförsäljning till konsument så länge du personligen (eller familjemedlem) lämnar över äggen. Det ställer inga extra krav utöver de ovan, men det finns några tumregler:</p>
<ul class="my-3 ml-5 list-disc text-foreground/85 space-y-1">
<li><strong>Märkning:</strong> äggen behöver inte vara stämplade om du säljer direkt till slutkonsument. Men det är rekommenderat att skriva <em>värpdatum</em> på förpackningen.</li>
<li><strong>Bäst-före:</strong> maximalt 28 dagar efter värpdatum. Ange datum tydligt.</li>
<li><strong>Förvaring:</strong> ägg ska förvaras svalt (helst under 20 °C, gärna 5–15 °C) från värpning till leverans.</li>
<li><strong>Kartonger:</strong> använd rena, oanvända kartonger. Återanvända kartonger med annan producents stämpel får inte användas kommersiellt.</li>
</ul>
<p>På Hönsgården kan du enkelt skapa en <a href="/salja-agg" class="text-primary underline">gratis säljsida</a> och synas på <a href="/karta" class="text-primary underline">äggkartan</a> – kunderna hittar dig och du håller koll på lagret utan krångel.</p>`,
      },
      {
        id: 'checklista-lagligt',
        heading: 'Checklista: Redo att sälja lagligt?',
        html: `<ul class="my-3 ml-5 list-disc text-foreground/85 space-y-1">
<li>✅ Anläggningen registrerad hos <strong>Jordbruksverket</strong></li>
<li>✅ Primärproduktionen registrerad hos <strong>länsstyrelsen</strong> (obligatoriskt om fler än 50 höns)</li>
<li>✅ Foder följer smittskyddsreglerna – inga animaliska matrester</li>
<li>✅ Rena, oanvända kartonger med <strong>värpdatum</strong></li>
<li>✅ Sval förvaring och max 28 dagars hållbarhet</li>
<li>✅ Koll på Jordbruksverkets restriktionskarta för fågelinfluensa</li>
</ul>`,
      },
    ],
    faqs: [
      {
        q: 'Får jag sälja ägg från mina hobbyhöns?',
        a: 'Ja. Direktförsäljning till konsument – på gården, torget eller i en REKO-ring – är tillåten från upp till 350 fjäderfän, förutsatt att din anläggning är registrerad hos Jordbruksverket och (om du säljer ägg) hos länsstyrelsen som primärproducent.',
      },
      {
        q: 'När räknas jag som livsmedelsföretagare?',
        a: 'När du har fler än 50 värphöns räknas du som livsmedelsföretagare inom primärproduktion. Då gäller skarpare krav på egenkontroll, spårbarhet och salmonellaprovtagning, och länsstyrelsen gör kontrollbesök.',
      },
      {
        q: 'Måste äggen vara stämplade?',
        a: 'Nej, inte vid direktförsäljning till slutkonsument. Men värpdatum bör skrivas på förpackningen, och äggen får som längst säljas i 28 dagar från värpning.',
      },
      {
        q: 'Kan jag sälja äggen i butik?',
        a: 'Inte utan att äggen först passerar ett godkänt äggpackeri som klassificerar och märker dem. Direktförsäljning till en enskild butik (lokal detaljhandel) räknas ibland som direktförsäljning – kolla med länsstyrelsen i ditt fall.',
      },
      {
        q: 'Får jag ge hönorna matrester?',
        a: 'Nej, inte om resterna innehåller kött, fisk, mejeri eller ägg. Rena rester av spannmål, grönsaker och frukt är okej. Reglerna finns för att förhindra smittspridning.',
      },
      {
        q: 'Vad händer om salmonella upptäcks?',
        a: 'Anläggningen beläggs med restriktioner, försäljning stoppas och hela besättningen behöver oftast avlivas. Därför är god hygien, rent foder och skydd mot vilda fåglar centralt även för småskalig försäljning.',
      },
    ],
    relatedLinks: [
      { href: '/verktyg/aggregler-vagvisare', label: 'Äggregler-vägvisaren – vilka regler gäller just dig?' },
      { href: '/salja-agg', label: 'Skapa gratis säljsida med Swish' },
      { href: '/karta', label: 'Äggkartan – hitta lokala säljare' },
      { href: '/guider/registrera-hons-jordbruksverket', label: 'Registrera dina höns hos Jordbruksverket' },
    ],
    authorityLinks: [
      { href: 'https://jordbruksverket.se/djur/fjaderfa/hons-och-agg', label: 'Jordbruksverket – Höns och ägg' },
      { href: 'https://www.livsmedelsverket.se/produktion-handel--kontroll/produktion-av-livsmedel/primarproduktion', label: 'Livsmedelsverket – Primärproduktion' },
      { href: 'https://jordbruksverket.se/djur/djurskydd/kontrollprogram-och-frivilliga-atgarder/salmonellakontroll', label: 'Jordbruksverket – Salmonellakontroll' },
    ],
  },
];

export function getRegulationGuide(slug) {
  return REGULATION_GUIDES.find((g) => g.slug === slug) || null;
}
