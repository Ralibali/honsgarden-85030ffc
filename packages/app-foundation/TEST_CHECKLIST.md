# Gemensam testlista: Odling + Höns

Kör i båda apparna på svenska, på mobil och dator, med ett helt nytt konto samt ett befintligt konto. Testa backendändringar i en separat testmiljö först. Använd testdata som tydligt kan identifieras; skicka inga inbjudningar eller meddelanden till riktiga personer under testet.

## Adresser och inloggning

- `/villkor`, `/integritet`, `/priser` och alias `/pris` laddar eller omdirigerar till rätt innehåll. Meny och sidfot använder samma prisdestination.
- Ny registrering visar inga påhittade odlingar, höns, ägg, zoner eller skördar.
- Bekräftelsemejlets klickbara länk börjar på appens egen domän. Site URL ensam räcker inte: kontrollera även Supabases mall och eventuell e-post-hook.
- Giltig länk visar **Din e-post är bekräftad** före appen. Oanvändbar länk ger ett svenskt fel; en tidigare session får inte räcka för att visa framgång.
- Länkar, tokenfragment och privata orderadresser hamnar inte i analysverktyg eller referrers.
- Hoppa över kräver ingen påhittad profil. Misslyckad lagring lämnar användaren kvar med sina val.
- Provperiod visar slutdatum och om betalning sker automatiskt. Gratis, provperiod, betald Plus och kombopaket går att skilja åt.

## Kontokoppling och Plus

- Bekräfta båda kontona. Samma e-postadress ska aldrig ensam slå ihop konton.
- Inloggad användare bekräftar kontobyte; gammal session och frågecache töms före byte.
- Länkar går ut efter fem minuter, kan användas en gång och fungerar bara i den andra appen.
- Koppla fel par, återanvänd en länk, använd en utgången länk och försök med avstängt konto. Alla försök ska nekas.
- Visa ett faktiskt konfigurerat pris inklusive moms och förnyelseintervall. Köpknapp saknas före aktivering.
- Befintliga betalda abonnemang/livstidsåtkomst blockerar nytt komboköp. Köp av separat Plus blockeras medan kombopaketet är aktivt.
- Med Stripe-testläge: lyckad betalning, avbruten kassa, dubbelklick, förnyelse, utebliven betalning, avslut vid periodslut, omstart efter avslut och dubbla/omkastade webhooks.
- Plus fungerar i både UI och serverkontrollerade funktioner. Provperioder och App Store/Google Play-rättigheter ändras inte av kombopaketet.
- Hantera kombopaket öppnar rätt Stripe-kund. Inaktiv koppling kan tas bort efter bekräftelse.
- Kontoradering stoppar kombopaketets kommande debiteringar före dataradering. Fel i avslutet stoppar raderingen. Kontrollera även den andra appens åtkomst.

## Data och siffror

- Logga **120 g** i Odlingsdagboken: översikt, kalender, statistik och säsongsbild ska visa **0,12 kg** för samma urval.
- Ändra pris per gröda; samma beräknade värde ska följa med överallt. Värdet är märkt som uppskattat.
- I Hönsgården: jämför samma datumintervall, flock och medlemskap mellan Ägglogg, Översikt och Statistik. Inget nätfel får visas som en sann nolla.
- Kontrollera över 1 000 historikrader: summeringar får inte tappa den äldsta historiken.
- Avbokad, återbetald och hämtad men obetald äggorder ska inte räknas som betald försäljning.

## Odling

- Flytta en bädd med pekare och tangentbord. Spara, ladda om och prova ett sparfel.
- Planera en gröda: Växtföljd och Samplantering ska uppdateras, men ingen sådd skapas förrän användaren loggar den.
- Kål i samma bädd förra året ger varning. Annan bädd eller okänd familj ger ingen uppdiktad varning. Historiska planer skiljs från loggade sådder.
- Fröuppgifter följer vald zon och faktisk såperiod. Saknad zon/okänd sort hittar inte på sådatum. Gamla frön föreslår groningstest.
- Påminnelser sparas en gång och bevarar befintliga inställningar vid konflikt eller nätfel.
- Regnråd använder avslutade dygn och en sparad plats. Saknat/regionalt väder presenteras inte som lokalt uppmätt regn.
- Bladfoto förbereds lokalt och väntar på AI-samtycke och Skicka. Avstå från AI och fortsätt använda resten av appen.
- Bjud in två testkonton: en länk är engångs. Medlem kan logga i delad bädd men inte läsa privata dagboksanteckningar eller betalningar. Återkallad medlem tappar läsrätt och skrivrätt.
- Fröbyte: skapa annons, kontakta, svara, avsluta. En tredje användare får aldrig se samtalet. Befintliga deltagare kan läsa ett avslutat samtal.
- Säsongsbilden kan förhandsgranskas, laddas ned och delas med rätt vikt, största skörd och uppskattat värde. Inga privata anteckningar eller koordinater finns i bilden.

## Äggboden

- Anonym kund kan boka utan SELECT-rättighet till kundtabellen. Bekräftelsen behåller det bokade antalet efter att formuläret tömts.
- Två kunder försöker boka sista kartan/tiden samtidigt: bara en lyckas. Halva/negativa antal, annan säljares tid, full tid och passerad tid nekas.
- Upprepa samma request-id efter nätfel: en order, en reservation och samma kvitto.
- Ändra listpris/rabatt efter bokning: kvitto, kundportal, påminnelser och statistik behåller orderns sparade pris.
- Ändrat pris mellan visning och bokning kräver att kunden uppdaterar och godkänner det nya priset.
- Betald efter Hämtad behåller Hämtad. Ogiltig statusövergång och ändringar av annan säljares order nekas. Ett fel i en gruppändring återställer hela gruppen.
- Avbokning kräver bekräftelse. Markera återbetald skickar inga pengar och återför inte hämtade ägg till lagret.
- Äldre order utan sparat pris märks som uppskattningar; historiskt pris får inte hittas på.
