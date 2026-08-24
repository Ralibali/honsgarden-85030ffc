/**
 * Integritetspolicyns innehåll (svenska + engelska).
 * Delad mellan /terms (sektion) och /integritet (dedikerad sida) –
 * redigera INTE bägge ställena separat, ändra här.
 */
import { brandName } from '@/lib/brand';

export function PrivacyContentSv() {
  return (
    <>
    <h1 className="font-serif text-2xl sm:text-3xl text-foreground mb-1">Integritetspolicy</h1>
    <p className="text-xs text-muted-foreground mb-6">I enlighet med EU:s dataskyddsförordning (GDPR) och den svenska dataskyddslagen (2018:218)</p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">1. Personuppgiftsansvarig</h2>
    <p className="text-sm text-foreground leading-relaxed">Personuppgiftsansvarig för behandlingen av dina personuppgifter är:</p>
    <p className="text-sm text-foreground leading-relaxed">
      Hönsgården / honsgarden.se<br />
      E-post: <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a><br />
      Webbplats: <a href="https://www.honsgarden.se" className="text-primary hover:underline">www.honsgarden.se</a>
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">2. Vilka personuppgifter vi samlar in</h2>
    <p className="text-sm text-foreground leading-relaxed">Vi samlar in följande kategorier av personuppgifter:</p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Kontouppgifter:</strong> Namn (visningsnamn) och e-postadress vid registrering</li>
      <li><strong>Användarskapat innehåll:</strong> Data du själv lägger in i tjänsten, t.ex. hönsdata, äggregistreringar, hälsologgar, ekonomiska transaktioner, foton, annonser och anteckningar</li>
      <li><strong>Marknadsplats & Agdas äggbod:</strong> Kontaktuppgifter du väljer att publicera i annonser (t.ex. förnamn, telefon, e-post, ungefärlig plats/postort), bokningar och meddelanden mellan köpare och säljare</li>
      <li><strong>Community/forum:</strong> Inlägg, kommentarer och reaktioner du publicerar samt anmälningar av olämpligt innehåll (DSA)</li>
      <li><strong>AI-chatt (Agda):</strong> Frågor du ställer och svar från AI-assistenten sparas i en chattlogg för kvalitet, missbruksskydd och felsökning</li>
      <li><strong>Referral/vänbjudan:</strong> Din referral-kod, vem du bjudit in och när inbjudan lösts in</li>
      <li><strong>Notiser:</strong> Push-token (iOS/webb), e-postpreferenser samt geografisk sökprofil för Agdas äggbod-notiser</li>
      <li><strong>Kamera & bilder:</strong> Foton du väljer att ladda upp till hönsprofiler eller annonser (mobilappen ber om kamera- och biblioteksåtkomst separat)</li>
      <li><strong>Platsdata:</strong> Endast om du aktivt anger postort/adress för väderprognoser eller marknadsplatsannonser – vi spårar inte din realtidsposition</li>
      <li><strong>Tekniska data:</strong> IP-adress, enhetstyp, webbläsare, operativsystem och sessionsinformation</li>
      <li><strong>Användningsdata:</strong> Sidvisningar, klickhändelser och navigeringsmönster (anonymiserat)</li>
      <li><strong>Betalningsuppgifter:</strong> Hanteras av Stripe – vi lagrar aldrig kortuppgifter</li>
    </ul>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      Vi samlar inte in känsliga personuppgifter enligt art. 9 GDPR (t.ex. hälsodata om personer, religiös övertygelse eller politisk tillhörighet).
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">3. Rättslig grund för behandlingen</h2>
    <p className="text-sm text-foreground leading-relaxed">Vi behandlar dina personuppgifter med stöd av följande rättsliga grunder (artikel 6 GDPR):</p>
    <ul className="text-sm text-foreground space-y-2 list-disc pl-5">
      <li><strong>Fullgörande av avtal (art. 6.1 b)</strong> – Behandling som är nödvändig för att tillhandahålla tjänsten du registrerat dig för, t.ex. lagring av dina äggregistreringar, hantering av ditt konto och betalning.</li>
      <li><strong>Samtycke (art. 6.1 a)</strong> – För utskick av nyhetsbrev och marknadsföring samt cookies för analys. Du kan när som helst återkalla ditt samtycke.</li>
      <li><strong>Berättigat intresse (art. 6.1 f)</strong> – För säkerhet, felsökning, missbruksskydd och förbättring av tjänsten. Vi har gjort en intresseavvägning och bedömt att vårt intresse inte väger tyngre än dina rättigheter.</li>
      <li><strong>Rättslig förpliktelse (art. 6.1 c)</strong> – När vi är skyldiga att spara uppgifter enligt lag, t.ex. bokföringslagen.</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">4. Hur vi använder dina uppgifter</h2>
    <p className="text-sm text-foreground leading-relaxed">Vi använder dina personuppgifter för att:</p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Tillhandahålla, underhålla och förbättra tjänsten</li>
      <li>Skapa och hantera ditt konto</li>
      <li>Skicka tjänstrelaterade meddelanden (t.ex. lösenordsåterställning, veckorapporter)</li>
      <li>Skicka nyhetsbrev och erbjudanden (med ditt samtycke)</li>
      <li>Hantera betalningar och prenumerationer via Stripe</li>
      <li>Upptäcka och förhindra missbruk och säkerhetshot</li>
      <li>Analysera användningsmönster för att förbättra tjänsten (anonymiserat)</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">5. Delning med tredje part & underbiträden</h2>
    <p className="text-sm text-foreground leading-relaxed">
      Vi säljer aldrig dina personuppgifter. Vi delar uppgifter med följande tjänsteleverantörer (underbiträden) som behövs för att driva tjänsten:
    </p>
    <div className="overflow-x-auto mt-2">
      <table className="text-sm text-foreground w-full border-collapse">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-2 pr-4 font-semibold">Leverantör</th>
            <th className="text-left py-2 pr-4 font-semibold">Syfte</th>
            <th className="text-left py-2 font-semibold">Plats</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Lovable Cloud (Supabase)</td>
            <td className="py-2 pr-4">Databas, autentisering, backend-funktioner</td>
            <td className="py-2">EU/EES</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Stripe</td>
            <td className="py-2 pr-4">Betalningshantering</td>
            <td className="py-2">USA (EU SCC)</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Brevo (Sendinblue)</td>
            <td className="py-2 pr-4">E-postutskick, nyhetsbrev, transaktionsmejl</td>
            <td className="py-2">EU (Frankrike)</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Google (Gemini) / Lovable AI Gateway</td>
            <td className="py-2 pr-4">AI-funktioner (Agda-chatt, dagliga tips, insikter)</td>
            <td className="py-2">EU/USA (EU SCC)</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Apple Push Notification Service</td>
            <td className="py-2 pr-4">Pushnotiser i iOS-appen</td>
            <td className="py-2">USA (EU SCC)</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Open-Meteo</td>
            <td className="py-2 pr-4">Väderprognoser (endast koordinater/postort)</td>
            <td className="py-2">EU</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Firecrawl</td>
            <td className="py-2 pr-4">Produktdata för affiliate-länkar (ingen personuppgift)</td>
            <td className="py-2">USA (EU SCC)</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      Vid överföring av personuppgifter utanför EU/EES säkerställer vi att adekvat skyddsnivå upprätthålls genom EU:s standardavtalsklausuler (Standard Contractual Clauses, SCC) i enlighet med artikel 46.2 c GDPR.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">6. Cookies och liknande tekniker</h2>
    <p className="text-sm text-foreground leading-relaxed">
      Vi använder cookies i enlighet med lagen om elektronisk kommunikation (LEK, 2022:482).
    </p>

    <h3 className="font-serif text-base text-foreground mt-4 mb-1">Nödvändiga cookies (kräver ej samtycke):</h3>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Autentisering</strong> – Sessionshantering för inloggade användare</li>
      <li><strong>Cookie-val</strong> – Sparar ditt val av cookieinställningar (<code>cookie-consent</code> i localStorage)</li>
    </ul>

    <h3 className="font-serif text-base text-foreground mt-4 mb-1">Valfria cookies (kräver samtycke):</h3>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Analys</strong> – Anonymiserad sidvisningsstatistik för att förbättra tjänsten</li>
    </ul>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      Du kan ändra dina cookieinställningar när som helst via cookie-bannern eller i din webbläsare. Att blockera nödvändiga cookies kan påverka tjänstens funktion.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">7. Lagringstid</h2>
    <p className="text-sm text-foreground leading-relaxed">Vi lagrar dina personuppgifter enligt följande principer:</p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Kontodata och användarinnehåll:</strong> Så länge ditt konto är aktivt</li>
      <li><strong>Vid kontoavslut:</strong> Personuppgifter raderas inom 30 dagar</li>
      <li><strong>Ekonomiska transaktioner:</strong> Sparas i 7 år enligt bokföringslagen (1999:1078)</li>
      <li><strong>E-postloggar:</strong> Sparas i 90 dagar för felsökning</li>
      <li><strong>Anonymiserad statistik:</strong> Sparas utan tidsgräns (är inte personuppgifter)</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">8. Dina rättigheter</h2>
    <p className="text-sm text-foreground leading-relaxed">Enligt GDPR har du följande rättigheter:</p>
    <ul className="text-sm text-foreground space-y-2 list-disc pl-5">
      <li><strong>Rätt till tillgång (art. 15)</strong> – Du kan begära information om vilka personuppgifter vi behandlar om dig.</li>
      <li><strong>Rätt till rättelse (art. 16)</strong> – Du kan begära att felaktiga uppgifter korrigeras.</li>
      <li><strong>Rätt till radering (art. 17)</strong> – Du kan radera ditt konto och all tillhörande data via <em>Inställningar → Radera konto</em> i appen.</li>
      <li><strong>Rätt till begränsning (art. 18)</strong> – Du kan begära att behandlingen av dina uppgifter begränsas.</li>
      <li><strong>Rätt till dataportabilitet (art. 20)</strong> – Du kan exportera dina uppgifter som CSV-fil via <em>Inställningar → Exportera data</em>.</li>
      <li><strong>Rätt att invända (art. 21)</strong> – Du har rätt att invända mot behandling baserad på berättigat intresse.</li>
      <li><strong>Rätt att återkalla samtycke</strong> – Du kan när som helst återkalla samtycke för nyhetsbrev via avprenumerationslänken eller via inställningar i appen.</li>
    </ul>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      Radering och export kan du göra direkt i appen. För övriga förfrågningar, kontakta oss på <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a>. Vi besvarar din begäran inom 30 dagar.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">9. Automatiserat beslutsfattande</h2>
    <p className="text-sm text-foreground leading-relaxed">
      Vi använder inte automatiserat beslutsfattande eller profilering som har rättslig verkan eller på liknande sätt väsentligt påverkar dig (artikel 22 GDPR). AI-funktioner i appen (t.ex. dagliga tips) ger generella rekommendationer och fattar inga beslut som rör dig personligen.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">10. Säkerhetsåtgärder</h2>
    <p className="text-sm text-foreground leading-relaxed">
      Vi vidtar lämpliga tekniska och organisatoriska åtgärder för att skydda dina personuppgifter enligt artikel 32 GDPR, bland annat:
    </p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Krypterad dataöverföring (HTTPS/TLS)</li>
      <li>Dataseparering genom Row Level Security (RLS) på databasnivå</li>
      <li>Hashade lösenord – vi lagrar aldrig lösenord i klartext</li>
      <li>Rate limiting för att förhindra missbruk</li>
      <li>Regelbunden säkerhetsgranskning av koden</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">11. Personuppgiftsincidenter</h2>
    <p className="text-sm text-foreground leading-relaxed">
      Om en personuppgiftsincident inträffar som kan innebära risk för dina rättigheter och friheter, anmäler vi detta till Integritetsskyddsmyndigheten (IMY) inom 72 timmar i enlighet med artikel 33 GDPR. Om incidenten sannolikt medför hög risk för dig informeras du utan onödigt dröjsmål (artikel 34 GDPR).
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">12. E-postkommunikation</h2>
    <p className="text-sm text-foreground leading-relaxed">Vi skiljer på tjänstemeddelanden och marknadsföring:</p>
    <h3 className="font-serif text-base text-foreground mt-4 mb-1">Tjänstemeddelanden (utan separat samtycke):</h3>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Kontobekräftelse och lösenordsåterställning</li>
      <li>Veckorapporter om din äggproduktion</li>
      <li>Påminnelser om prenumerationer och betalningar</li>
    </ul>
    <h3 className="font-serif text-base text-foreground mt-4 mb-1">Marknadsföring (med samtycke):</h3>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Nyhetsbrev med tips och nyheter om hönsuppfödning</li>
      <li>Erbjudanden och kampanjer</li>
      <li>Information om nya funktioner</li>
    </ul>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      Du kan avprenumerera från marknadsföring via länken i varje utskick eller via inställningar i appen. Samtycke till marknadsföring påverkar inte tjänstemeddelanden.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">13. Barns personuppgifter</h2>
    <p className="text-sm text-foreground leading-relaxed">
      Tjänsten riktar sig inte till barn under 16 år. Vi samlar inte medvetet in personuppgifter från barn under 16 år. Om vi upptäcker att en person under 16 år har registrerat sig utan vårdnadshavares samtycke raderar vi uppgifterna.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">14. Tillsynsmyndighet</h2>
    <p className="text-sm text-foreground leading-relaxed">
      Om du anser att vår behandling av dina personuppgifter bryter mot GDPR har du rätt att lämna klagomål till:
    </p>
    <p className="text-sm text-foreground leading-relaxed">
      <strong>Integritetsskyddsmyndigheten (IMY)</strong><br />
      Box 8114, 104 20 Stockholm<br />
      <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.imy.se</a><br />
      E-post: <a href="mailto:imy@imy.se" className="text-primary hover:underline">imy@imy.se</a><br />
      Telefon: 08-657 61 00
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">15. Marknadsplats, Agdas äggbod & Community (DSA)</h2>
    <p className="text-sm text-foreground leading-relaxed">
      När du publicerar annonser, bokningar, recensioner eller inlägg på tjänsten agerar Hönsgården som värd för användarskapat innehåll enligt EU:s förordning om digitala tjänster (DSA, EU 2022/2065).
    </p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Du är själv ansvarig för innehållet du publicerar och för att det följer svensk lag (t.ex. Jordbruksverkets regler om äggförsäljning, konsumentköplagen, GDPR).</li>
      <li>Kontaktuppgifter som du väljer att publicera i en annons blir synliga för besökare – publicera inte mer än nödvändigt.</li>
      <li>Vi kan när som helst ta bort innehåll som strider mot villkoren, är olagligt, vilseledande eller skadligt.</li>
      <li>Anmälan av olagligt eller olämpligt innehåll (art. 16 DSA): mejla <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a> med länk och beskrivning. Vi bekräftar och åtgärdar utan onödigt dröjsmål.</li>
      <li>Beslut om nedtagning kan överklagas till oss inom 6 månader. Utomrättslig tvistlösning: Allmänna reklamationsnämnden (ARN).</li>
      <li>Vi visar inte riktad reklam baserad på profilering och använder inga "mörka mönster" enligt art. 25 DSA.</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">16. Mobilapp, pushnotiser & kamera</h2>
    <p className="text-sm text-foreground leading-relaxed">
      När du använder iOS-appen (App Store) eller installerar webbappen (PWA) gäller följande utöver denna policy:
    </p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Pushnotiser:</strong> Skickas endast om du aktivt godkänt det i operativsystemet. Innehåller ex. äggpåminnelser, marknadsplatsnotiser och abonnemangsstatus. Kan stängas av när som helst i enhetens inställningar.</li>
      <li><strong>Kamera & fotobibliotek:</strong> Åtkomst begärs endast när du väljer att lägga till bilder på höns eller annonser. Bilderna lagras krypterat i tjänsten och tas bort när du raderar dem eller ditt konto.</li>
      <li><strong>Offline-läge:</strong> Loggade ägg sparas lokalt i din enhet och synkas vid uppkoppling. Ingen tredje part har tillgång till offline-kön.</li>
      <li><strong>Betalning i appen:</strong> All betalning sker via Stripe på webben. Vi använder inte Apples köp inom app (IAP) för prenumeration.</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">17. E-postnotiser om ägg till salu (publikt formulär)</h2>
    <p className="text-sm text-foreground leading-relaxed">
      På våra publika ort- och kartsidor kan besökare anmäla sig till gratis e-postnotiser när nya äggannonser publiceras i närområdet. För detta behandlar vi:
    </p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>E-postadress, valfri ort/postnummer och sökradie</li>
      <li>Rättslig grund: samtycke (art. 6.1 a GDPR) via <strong>dubbel opt-in</strong> – du måste bekräfta via länk i e-post</li>
      <li>Avanmälan: länk finns i varje utskick och tar omedelbar effekt</li>
      <li>Lagringstid: tills du avanmäler dig; vid inaktivitet i 24 månader raderas prenumerationen</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">18. Referral- och vänbjudansprogram</h2>
    <p className="text-sm text-foreground leading-relaxed">
      När du bjuder in en vän via personlig länk (t.ex. <code>/r/DINKOD</code>) registrerar vi din referral-kod och kopplar din vän till din inbjudan vid registrering. Vi delar inte din e-post med den inbjudne. Belöningen (30 dagar Plus) delas ut automatiskt när villkoret uppfyllts (första äggloggning). Missbruk (bots, självinbjudan, falska konton) kan leda till att belöningen dras tillbaka och kontot spärras.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">19. Familjedelning</h2>
    <p className="text-sm text-foreground leading-relaxed">
      När du bjuder in familjemedlemmar till en gård delas gårdens data (höns, ägg, ekonomi, foton) med de inbjudna. Personuppgifter om dig som ägare visas endast i form av visningsnamn. Du kan när som helst ta bort en medlem via <em>Inställningar → Familj</em>, vilket omedelbart återkallar deras åtkomst.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">20. Kontakt</h2>
    <p className="text-sm text-foreground leading-relaxed">Frågor om denna policy eller dina personuppgifter? Kontakta oss:</p>
    <p className="text-sm text-foreground leading-relaxed">
      Hönsgården / honsgarden.se<br />
      E-post: <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a><br />
      Webbplats: <a href="https://www.honsgarden.se" className="text-primary hover:underline">www.honsgarden.se</a>
    </p>
    </>
  );
}

export function PrivacyContentEn() {
  const brand = brandName();
  return (
    <>
    <h1 className="font-serif text-2xl sm:text-3xl text-foreground mb-1">Privacy Policy</h1>
    <p className="text-xs text-muted-foreground mb-6">In accordance with the EU General Data Protection Regulation (GDPR)</p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">1. Data controller</h2>
    <p className="text-sm text-foreground leading-relaxed">The controller responsible for processing your personal data is:</p>
    <p className="text-sm text-foreground leading-relaxed">
      {brand} / honsgarden.app<br />
      Email: <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a><br />
      Website: <a href="https://honsgarden.app" className="text-primary hover:underline">honsgarden.app</a>
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">2. Personal data we collect</h2>
    <p className="text-sm text-foreground leading-relaxed">We collect the following categories of personal data:</p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Account data:</strong> Name (display name) and email address at registration</li>
      <li><strong>User-generated content:</strong> Data you enter into the service, e.g. hen data, egg records, health logs, financial transactions, photos, listings and notes</li>
      <li><strong>Marketplace & Agda's egg shop:</strong> Contact details you choose to publish in listings (e.g. first name, phone, email, approximate location), bookings and messages between buyers and sellers</li>
      <li><strong>Community/forum:</strong> Posts, comments, reactions you publish, and reports of inappropriate content (DSA)</li>
      <li><strong>AI chat (Agda):</strong> Questions you ask and answers from the AI assistant are stored in a chat log for quality, abuse prevention and troubleshooting</li>
      <li><strong>Referral program:</strong> Your referral code, who you invited and when the invitation was redeemed</li>
      <li><strong>Notifications:</strong> Push token (iOS/web), email preferences and geographic search profile for egg-shop alerts</li>
      <li><strong>Camera & photos:</strong> Photos you choose to upload to hen profiles or listings (the mobile app requests camera and library access separately)</li>
      <li><strong>Location data:</strong> Only if you actively enter a postcode/address for weather or marketplace listings — we do not track your real-time location</li>
      <li><strong>Technical data:</strong> IP address, device type, browser, operating system and session information</li>
      <li><strong>Usage data:</strong> Page views, click events and navigation patterns (anonymized)</li>
      <li><strong>Payment data:</strong> Handled by Stripe — we never store card details</li>
    </ul>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      We do not collect special-category personal data under art. 9 GDPR (e.g. health data about individuals, religious beliefs or political affiliation).
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">3. Legal basis for processing</h2>
    <p className="text-sm text-foreground leading-relaxed">We process your personal data based on the following legal grounds (article 6 GDPR):</p>
    <ul className="text-sm text-foreground space-y-2 list-disc pl-5">
      <li><strong>Performance of a contract (art. 6.1 b)</strong> — Processing necessary to provide the service you registered for, e.g. storing your egg records, managing your account and processing payments.</li>
      <li><strong>Consent (art. 6.1 a)</strong> — For newsletters and marketing, and analytics cookies. You can withdraw consent at any time.</li>
      <li><strong>Legitimate interest (art. 6.1 f)</strong> — For security, debugging, abuse prevention and service improvement. We have balanced this interest against your rights.</li>
      <li><strong>Legal obligation (art. 6.1 c)</strong> — When we are required to retain data under law, e.g. accounting regulations.</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">4. How we use your data</h2>
    <p className="text-sm text-foreground leading-relaxed">We use your personal data to:</p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Provide, maintain and improve the service</li>
      <li>Create and manage your account</li>
      <li>Send service-related messages (e.g. password reset, weekly reports)</li>
      <li>Send newsletters and offers (with your consent)</li>
      <li>Process payments and subscriptions via Stripe</li>
      <li>Detect and prevent abuse and security threats</li>
      <li>Analyze usage patterns to improve the service (anonymized)</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">5. Third parties & sub-processors</h2>
    <p className="text-sm text-foreground leading-relaxed">
      We never sell your personal data. We share data with the following service providers (sub-processors) required to operate the service:
    </p>
    <div className="overflow-x-auto mt-2">
      <table className="text-sm text-foreground w-full border-collapse">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-2 pr-4 font-semibold">Provider</th>
            <th className="text-left py-2 pr-4 font-semibold">Purpose</th>
            <th className="text-left py-2 font-semibold">Location</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Lovable Cloud (Supabase)</td>
            <td className="py-2 pr-4">Database, authentication, backend functions</td>
            <td className="py-2">EU/EEA</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Stripe</td>
            <td className="py-2 pr-4">Payment processing</td>
            <td className="py-2">USA (EU SCC)</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Brevo (Sendinblue)</td>
            <td className="py-2 pr-4">Email delivery, newsletters, transactional mail</td>
            <td className="py-2">EU (France)</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Google (Gemini) / Lovable AI Gateway</td>
            <td className="py-2 pr-4">AI features (Agda chat, daily tips, insights)</td>
            <td className="py-2">EU/USA (EU SCC)</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Apple Push Notification Service</td>
            <td className="py-2 pr-4">Push notifications in the iOS app</td>
            <td className="py-2">USA (EU SCC)</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Open-Meteo</td>
            <td className="py-2 pr-4">Weather forecasts (coordinates/postcode only)</td>
            <td className="py-2">EU</td>
          </tr>
          <tr className="border-b border-border/30">
            <td className="py-2 pr-4">Firecrawl</td>
            <td className="py-2 pr-4">Product data for affiliate links (no personal data)</td>
            <td className="py-2">USA (EU SCC)</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      When transferring personal data outside the EU/EEA, we ensure an adequate level of protection through the EU Standard Contractual Clauses (SCC) in accordance with article 46.2 c GDPR.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">6. Cookies and similar technologies</h2>
    <p className="text-sm text-foreground leading-relaxed">We use cookies in accordance with applicable electronic communications law.</p>

    <h3 className="font-serif text-base text-foreground mt-4 mb-1">Necessary cookies (no consent required):</h3>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Authentication</strong> — Session management for signed-in users</li>
      <li><strong>Cookie choice</strong> — Stores your cookie preferences (<code>cookie-consent</code> in localStorage)</li>
    </ul>

    <h3 className="font-serif text-base text-foreground mt-4 mb-1">Optional cookies (consent required):</h3>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Analytics</strong> — Anonymized page-view statistics to improve the service</li>
    </ul>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      You can change your cookie settings at any time via the cookie banner or in your browser. Blocking necessary cookies may affect how the service works.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">7. Retention</h2>
    <p className="text-sm text-foreground leading-relaxed">We retain your personal data according to the following principles:</p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Account data and user content:</strong> As long as your account is active</li>
      <li><strong>On account closure:</strong> Personal data is deleted within 30 days</li>
      <li><strong>Financial transactions:</strong> Retained for 7 years under applicable accounting law</li>
      <li><strong>Email logs:</strong> Retained for 90 days for troubleshooting</li>
      <li><strong>Anonymized statistics:</strong> Retained without time limit (not personal data)</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">8. Your rights</h2>
    <p className="text-sm text-foreground leading-relaxed">Under GDPR you have the following rights:</p>
    <ul className="text-sm text-foreground space-y-2 list-disc pl-5">
      <li><strong>Right of access (art. 15)</strong> — Request information about what personal data we process about you.</li>
      <li><strong>Right to rectification (art. 16)</strong> — Request that inaccurate data be corrected.</li>
      <li><strong>Right to erasure (art. 17)</strong> — Delete your account and all related data via <em>Settings → Delete account</em> in the app.</li>
      <li><strong>Right to restriction (art. 18)</strong> — Request that the processing of your data be restricted.</li>
      <li><strong>Right to data portability (art. 20)</strong> — Export your data as a CSV file via <em>Settings → Export data</em>.</li>
      <li><strong>Right to object (art. 21)</strong> — Object to processing based on legitimate interest.</li>
      <li><strong>Right to withdraw consent</strong> — Withdraw consent for newsletters at any time via the unsubscribe link or in app settings.</li>
    </ul>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      Deletion and export can be done directly in the app. For other requests, contact us at <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a>. We will respond within 30 days.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">9. Automated decision-making</h2>
    <p className="text-sm text-foreground leading-relaxed">
      We do not use automated decision-making or profiling that has legal effects or similarly significantly affects you (article 22 GDPR). AI features in the app (e.g. daily tips) provide general recommendations and do not make decisions concerning you personally.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">10. Security measures</h2>
    <p className="text-sm text-foreground leading-relaxed">
      We implement appropriate technical and organizational measures to protect your personal data under article 32 GDPR, including:
    </p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Encrypted data transmission (HTTPS/TLS)</li>
      <li>Data separation through Row Level Security (RLS) at the database level</li>
      <li>Hashed passwords — we never store passwords in plain text</li>
      <li>Rate limiting to prevent abuse</li>
      <li>Regular security reviews of the code</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">11. Data breaches</h2>
    <p className="text-sm text-foreground leading-relaxed">
      If a personal data breach occurs that may pose a risk to your rights and freedoms, we report it to the competent supervisory authority within 72 hours in accordance with article 33 GDPR. If the breach is likely to result in a high risk to you, you will be informed without undue delay (article 34 GDPR).
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">12. Email communication</h2>
    <p className="text-sm text-foreground leading-relaxed">We distinguish between service messages and marketing:</p>
    <h3 className="font-serif text-base text-foreground mt-4 mb-1">Service messages (no separate consent):</h3>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Account confirmation and password reset</li>
      <li>Weekly reports about your egg production</li>
      <li>Subscription and payment reminders</li>
    </ul>
    <h3 className="font-serif text-base text-foreground mt-4 mb-1">Marketing (with consent):</h3>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Newsletters with tips and news about chicken keeping</li>
      <li>Offers and promotions</li>
      <li>Information about new features</li>
    </ul>
    <p className="text-sm text-foreground leading-relaxed mt-2">
      You can unsubscribe from marketing via the link in each email or in app settings. Consent to marketing does not affect service messages.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">13. Children's personal data</h2>
    <p className="text-sm text-foreground leading-relaxed">
      The service is not directed at children under 16. We do not knowingly collect personal data from children under 16. If we discover that a person under 16 has registered without parental consent, we will delete the data.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">14. Supervisory authority</h2>
    <p className="text-sm text-foreground leading-relaxed">
      If you believe our processing of your personal data violates GDPR, you have the right to lodge a complaint with your local data protection authority in the EU/EEA. For Sweden:
    </p>
    <p className="text-sm text-foreground leading-relaxed">
      <strong>Integritetsskyddsmyndigheten (IMY)</strong><br />
      Box 8114, 104 20 Stockholm, Sweden<br />
      <a href="https://www.imy.se" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.imy.se</a><br />
      Email: <a href="mailto:imy@imy.se" className="text-primary hover:underline">imy@imy.se</a>
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">15. Marketplace, Agda's egg shop & Community (DSA)</h2>
    <p className="text-sm text-foreground leading-relaxed">
      When you publish listings, bookings, reviews or posts, Honsgarden acts as a host of user-generated content under the EU Digital Services Act (DSA, EU 2022/2065).
    </p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>You are responsible for the content you publish and for complying with applicable law (e.g. local food-safety rules for egg sales, consumer protection, GDPR).</li>
      <li>Contact details you choose to publish in a listing are visible to visitors — publish only what is necessary.</li>
      <li>We may remove content that violates the terms, is unlawful, misleading or harmful.</li>
      <li>Notice of illegal or inappropriate content (art. 16 DSA): email <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a> with a link and description. We confirm and act without undue delay.</li>
      <li>Takedown decisions may be appealed within 6 months. Out-of-court dispute resolution: the Swedish National Board for Consumer Disputes (ARN).</li>
      <li>We do not display targeted advertising based on profiling and use no "dark patterns" under art. 25 DSA.</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">16. Mobile app, push notifications & camera</h2>
    <p className="text-sm text-foreground leading-relaxed">
      When you use the iOS app (App Store) or install the web app (PWA), the following applies in addition to this policy:
    </p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li><strong>Push notifications:</strong> Sent only if you actively opt in via the operating system. Content includes egg reminders, marketplace alerts and subscription status. Can be disabled anytime in device settings.</li>
      <li><strong>Camera & photo library:</strong> Access is requested only when you choose to add images to hens or listings. Images are stored encrypted and deleted when you remove them or your account.</li>
      <li><strong>Offline mode:</strong> Logged eggs are stored locally on your device and synced when online. No third party has access to the offline queue.</li>
      <li><strong>In-app payment:</strong> All payments are processed via Stripe on the web. We do not use Apple In-App Purchase for subscriptions.</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">17. Email alerts for eggs for sale (public form)</h2>
    <p className="text-sm text-foreground leading-relaxed">
      On our public city and map pages, visitors may sign up for free email alerts when new egg listings appear nearby. For this we process:
    </p>
    <ul className="text-sm text-foreground space-y-1 list-disc pl-5">
      <li>Email address, optional city/postcode and search radius</li>
      <li>Legal basis: consent (art. 6.1 a GDPR) via <strong>double opt-in</strong> — you must confirm via an email link</li>
      <li>Unsubscribe: link included in every message, with immediate effect</li>
      <li>Retention: until you unsubscribe; after 24 months of inactivity the subscription is deleted</li>
    </ul>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">18. Referral program</h2>
    <p className="text-sm text-foreground leading-relaxed">
      When you invite a friend via personal link (e.g. <code>/r/YOURCODE</code>), we record your referral code and link the invitee to your invitation at registration. We do not share your email with the invitee. The reward (30 days Plus) is granted automatically once the condition is met (first egg logged). Abuse (bots, self-referrals, fake accounts) may result in reward revocation and account suspension.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">19. Family sharing</h2>
    <p className="text-sm text-foreground leading-relaxed">
      When you invite family members to a farm, the farm's data (hens, eggs, finances, photos) is shared with the invitees. Personal data about you as the owner is shown only as a display name. You may remove a member at any time via <em>Settings → Family</em>, which immediately revokes their access.
    </p>

    <h2 className="font-serif text-lg text-foreground mt-6 mb-2">20. Contact</h2>
    <p className="text-sm text-foreground leading-relaxed">Questions about this policy or your personal data? Contact us:</p>
    <p className="text-sm text-foreground leading-relaxed">
      {brand} / honsgarden.app<br />
      Email: <a href="mailto:info@auroramedia.se" className="text-primary hover:underline">info@auroramedia.se</a><br />
      Website: <a href="https://honsgarden.app" className="text-primary hover:underline">honsgarden.app</a>
    </p>
    </>
  );
}
