# Hönsgården – genomförandeplan 2026

Den här planen översätter produktstrategin till en prioriterad leveransordning. Fokus är först kvalitet och retention, därefter svensk tillväxt och sist internationell expansion.

## Principer för genomförandet

- Leverera små, mätbara förbättringar varje vecka.
- Varje epic ska ha ett användarmått och ett tekniskt kvalitetsmått.
- Nya funktioner ska bakom feature flags när de påverkar kärnflöden.
- Ta bort gammal kod när en ny version är bevisad.
- Stabilitet i daglig loggning går före nya marknadsföringsfunktioner.

---

# Fas 0 – stabil grund, vecka 1–3

## Mål

Ingen användare ska tappa data, få fel datum eller fastna i ett centralt flöde.

## Leveranser

### Tidszon och datum

- skapa gemensamt bibliotek för lokala datum,
- ersätt UTC-baserade datum i ägglogg, dashboard, streak, hälsa och uppgifter,
- lägg tester för Europe/Stockholm, America/Los_Angeles och Australia/Sydney,
- kontrollera rapportgränser vid sommar- och vintertid.

**Klart när:** en handling utförd 00.30 lokal tid alltid hamnar på lokal kalenderdag.

### Offline och synk

- dokumentera offlineköns tillstånd,
- visa väntande, synkad och misslyckad status,
- lägg till återförsök med backoff,
- bygg konfliktsäker idempotens för äggloggar,
- skapa felsida där användaren kan försöka igen eller exportera väntande data.

**Klart när:** samma offlinepost aldrig skapas dubbelt och användaren ser synkstatus.

### Produktionskvalitet

- inför felrapportering med releaseversion,
- larma vid fel i checkout, auth, orderportal och offline-synk,
- mät frontendfel per aktiv användare,
- sätt ett felbudgetmål.

**Mål:** färre än 1 % av aktiva sessioner ska innehålla ett ohanterat fel.

### Kodkonsolidering

- inventera filer med V2–V7-namn,
- identifiera aktiv implementation,
- flytta historiska versioner ur produktionskoden eller radera dem,
- verifiera att routes bara pekar på en version per flöde,
- dela upp första delen av `src/lib/api.ts` i domäntjänster.

**Mål:** minst 30 % färre parallella implementationsfiler i berörda flöden.

---

# Fas 1 – aktivering och daglig vana, vecka 4–7

## Mål

En ny användare ska förstå appen och få första värdet på mindre än tio minuter. En befintlig användare ska kunna logga dagens ägg på mindre än tre sekunder.

## Leveranser

### Ny aktiveringsresa

Steg:

1. välj användning: hobby, uppfödning eller äggförsäljning,
2. skapa flock,
3. lägg till en eller flera hönor,
4. logga första ägget,
5. välj påminnelsetid,
6. visa första personliga insikten.

Onboarding ska gå att hoppa över och återuppta.

**Mätning:**

- onboarding startad,
- flock skapad,
- höna skapad,
- första ägglogg,
- onboarding slutförd,
- tid mellan stegen.

### Dagens hönsgård

Bygg startsidan efter prioritet:

1. primär snabbhandling,
2. dagens uppgifter,
3. viktigaste avvikelse eller påminnelse,
4. aktuell kläckning eller hälsouppföljning,
5. veckosammanfattning.

Dölj kort som saknar data eller relevans.

### Ägglogg 3 sekunder

- ett tryck på vanligt antal,
- senaste höna eller flock förvald,
- ångra i minst tio sekunder,
- haptisk återkoppling,
- snabbval för skadat och smutsigt ägg,
- tydlig offlineindikator,
- lokal datumhantering.

### Personlig navigation

- behåll fem primära mobildestinationer,
- låt användaren välja två av dem,
- rekommendera genvägar efter användningstyp,
- flytta sällan använda funktioner till sök och kontextuella länkar.

## Mål efter fas 1

- minst 65 % av nya konton skapar en höna,
- minst 55 % loggar ett ägg första dagen,
- median till första ägglogg under fem minuter,
- D7-retention minst 25 %,
- median för återkommande ägglogg under tre sekunder.

---

# Fas 2 – hälsa, säkerhet och smarta insikter, vecka 8–12

## Mål

Hönsgården ska ge tydligare vardagsnytta än en vanlig tracker och bli svår att ersätta med anteckningar eller kalkylblad.

## Leveranser

### Hälsotidslinje

Per höna:

- observation,
- symptomkategori,
- vikt,
- foto,
- åtgärd,
- medicin,
- uppföljningsdatum,
- status: pågående, bättre, avslutad.

### Äggsäkerhet vid medicinering

- ange startdatum och karenstid,
- räkna slutdatum,
- markera berörda äggloggar,
- varna vid försäljning eller lager,
- visa tydligt att användaren ansvarar för att följa veterinärens och produktens instruktioner.

### Datadriven Agda

Första versionen ska endast ge fem typer av insikter:

1. värpning avviker från egen baslinje,
2. möjlig säsongs- eller väderförklaring,
3. höna saknar uppföljning efter hälsohändelse,
4. foderkostnad per ägg förändras,
5. kommande kläckningsmilstolpe.

Varje insikt visar datakälla, säkerhet och rekommenderad nästa handling.

### Veckorapport som retentionmotor

Rapporten ska innehålla:

- veckans ägg,
- förändring mot egen normalnivå,
- topphöna och avvikelse,
- foderkostnad,
- utförda och missade uppgifter,
- hälsouppföljningar,
- ett prioriterat nästa steg.

Leverera i app och valfritt via e-post eller push.

## Mål efter fas 2

- 20 % av aktiva användare använder hälsologgen,
- 35 % öppnar veckorapporten minst två gånger per månad,
- minst 25 % av Plus-användarna agerar på en Agda-insikt,
- vecka 4-retention minst 20 %.

---

# Fas 3 – svensk marknadsdominans, månad 4–6

## Mål

Hönsgården ska bli den produkt som svenska hönsägare rekommenderar till andra.

## Leveranser

### Agdas Bod 2.0

- automatiskt ägglager,
- flera packstorlekar,
- återkommande kunder,
- hämtningstider,
- orderstatus,
- Swish- och betalstatus,
- orderpåminnelser,
- enkel försäljningsrapport,
- svinn och reserverade ägg.

### Sveriges hönskarta

- lokal upptäckt av äggförsäljare,
- filtrering på avstånd och tillgänglighet,
- verifierade profiler,
- recension efter genomförd order,
- säkra kontaktflöden,
- moderation och rapportering.

### Svensk kunskapsmotor

- raser,
- säsongskalender,
- grundläggande hönshållning,
- kläckning,
- foder,
- vanliga frågor,
- artiklar som länkar till rätt funktion i appen.

### Ambassadörsprogram

- värvningskod,
- belöning med Plus-månader,
- material för hönsgrupper och föreningar,
- betaambassadörer med direkt feedbackkanal.

## Mål efter fas 3

- minst 3 000 registrerade svenska konton,
- minst 1 000 Weekly Active Coops,
- organisk eller rekommenderad trafik står för minst 40 % av nya aktiverade konton,
- minst 10 % av aktiva svenska konton använder marknadsplats eller Agdas Bod,
- betalande konvertering 5–10 % av aktiverade användare.

---

# Fas 4 – internationell beta, månad 7–9

## Förutsättningar

Lansering sker endast om:

- D7-retention är minst 30 % i en svensk kärnkohort,
- vecka 4-retention är minst 20 %,
- offline och datum har automatiska tester,
- supportflödet fungerar,
- appen är tekniskt översättningsbar,
- centrala vyer uppfyller grundläggande tillgänglighetskrav.

## Leveranser

### Internationalisering

- engelska,
- måttsystem och imperial,
- Celsius och Fahrenheit,
- valutor,
- datumformat,
- packstorlekar,
- tidszoner,
- regionala betalnings- och försäljningsfunktioner bakom konfiguration.

### Engelskspråkig produktbeta

Målgrupper:

- hobbyflock 5–30 hönor,
- småskalig homestead,
- nybörjare som vill ha guidning,
- användare som tycker befintliga breeder-system är för komplexa.

### Distribution

- Capacitor-baserad iOS- och Android-app,
- pushnotiser,
- App Store Optimization,
- store-bilder som visar ägglogg, hälsa, Agda och rapporter,
- support och onboarding på engelska.

## Mål efter fas 4

- 500 internationella beta-användare,
- D7-retention inom fem procentenheter från svensk kohort,
- minst 50 betalande internationella användare,
- minst 30 kvalitativa intervjuer.

---

# Fas 5 – internationell differentiering, månad 10–12

## Leveranser

### Breeder Pro

- bulkimport och bulkredigering,
- bandnummer,
- egenskaper och färger,
- full härstamning,
- avelsgrupper,
- flera äggkällor i kläckning,
- fertilitet och kläckningsgrad per källa,
- batchskapande av avkomma,
- delbara fågelprofiler.

### Multi-user

- ägare,
- familjemedlem,
- medhjälpare,
- endast läsning,
- aktivitetslogg.

### Benchmarking

Frivilligt och anonymiserat:

- jämför med liknande flockstorlek,
- ras- och åldersnormaler,
- regionala säsongsmönster,
- kostnad per ägg,
- kläckningsutfall.

## Internationell prismodell att testa

- Free,
- Plus: cirka 29 USD per år,
- Pro: cirka 79–99 USD per år,
- familje- eller teamtillägg senare.

Priset ska valideras genom tester. Det ska inte hårdkodas utifrån svenska kostnader.

---

# Teknisk backlog i rekommenderad ordning

1. Lokal datumfunktion och tester.
2. Offlinekö med synlig status och idempotens.
3. Produktanalys med domänhändelser.
4. Felrapportering och releaseversioner.
5. Konsolidering av V2–V7-filer.
6. Uppdelning av `api.ts`.
7. Test av auth, RLS och sessionsbyte.
8. Dashboardens query- och renderingsprestanda.
9. Feature flags.
10. i18n och regional konfiguration.
11. Capacitor och pushnotiser.
12. Multi-user och audit log.

---

# Produktdashboard

Följ varje vecka:

## Förvärv

- nya besökare,
- startade registreringar,
- skapade konton,
- källa och kampanj.

## Aktivering

- första flock,
- första höna,
- första ägg,
- aktivering inom 10 minuter,
- PWA-installation,
- påminnelse aktiverad.

## Retention

- D1, D7, D30,
- Weekly Active Coops,
- loggdagar per vecka,
- antal använda moduler,
- återkomst efter veckorapport.

## Intäkt

- trial start,
- trial till betalning,
- månads- kontra årsplan,
- churn,
- återkommande intäkt,
- intäkt per aktiverad användare.

## Kvalitet

- ohanterade fel,
- misslyckade synkar,
- dubbla loggar,
- laddningstid,
- supportärenden per 100 aktiva användare.

---

# Definition of Done för produktfunktioner

En funktion är inte färdig förrän:

- den har ett tydligt användarproblem,
- den har mätbara händelser,
- loading, tomt läge och fel är designade,
- mobil och tangentbord fungerar,
- offlinebeteende är definierat,
- tillgänglighet är kontrollerad,
- tester täcker kritisk logik,
- dokumentation är uppdaterad,
- gammal ersatt implementation är borttagen,
- resultatet följs upp efter lansering.

---

# Första sprinten

## Sprintmål

Säkra korrekt daglig data och skapa mätbar aktivering.

## Sprintinnehåll

- central lokal datumfunktion,
- tester för tre tidszoner,
- ersätt datum i QuickEggFAB och dashboard,
- definiera produktens event taxonomy,
- instrumentera första höna och första ägg,
- skapa enkel aktiveringsfunnel i admin,
- inventera parallella versioner av äggförsäljningssidor,
- välj och dokumentera canonical implementation,
- lägg felrapportering i produktion.

## Sprintens framgångskriterium

Vi ska kunna svara på följande utan gissningar:

1. Hur många nya användare skapar en höna?
2. Hur många loggar ett ägg samma dag?
3. Hur lång tid tar det?
4. Hur många återkommer inom sju dagar?
5. Hur många loggar får fel datum, dubbleras eller misslyckas att synka?
