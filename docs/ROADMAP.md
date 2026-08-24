# Roadmap för Hönsgården

Det här dokumentet samlar förslag på hur Hönsgården kan utvecklas vidare. Fokus är att skapa mer nytta för hobbyhönsägare, öka återkommande användning och bygga tydliga premiumvärden.

## Prioritet 1 – Snabba förbättringar med hög effekt

### 1. Integritetssäker tracking

Status: påbörjad.

- Tracking av sidvisningar och klick ska bara ske när användaren accepterat cookies.
- Nödvändiga cookies ska inte trigga analytics-events.
- Cookie-texten bör vara tydligare med vad som räknas som nödvändigt respektive statistik.

### 2. Påminnelser ska sparas i databasen

Nuvarande påminnelsesida använder lokal exempeldata i komponenten. Nästa steg är att koppla påminnelser till Supabase så de följer användaren mellan enheter.

Förslag:

- Spara påminnelser per användare.
- Koppla påminnelser till en specifik höna, flock eller hela gården.
- Stöd för återkommande påminnelser, till exempel varje vecka, månad eller kvartal.
- Lägg till status: kommande, försenad, klar och arkiverad.

### 3. Starkare onboarding

Första upplevelsen bör hjälpa användaren att komma igång snabbt.

Förslag:

- Enkel checklista: skapa flock, lägg till hönor, registrera första ägget, ange foderkostnad.
- Visa exempeldata endast innan användaren har lagt in egen data.
- Visa smarta tips beroende på vad användaren saknar.

### 4. Bättre exporter

Det finns redan CSV/PDF-export på flera ställen. Nästa steg är att göra exporterna mer användbara.

Förslag:

- Datumfilter före export.
- Export per flock eller höna.
- Månadsrapport i PDF med ägg, kostnader, intäkter och nyckeltal.
- Snygg rapportlayout med Hönsgården-branding.

## Äggloggning

Nuvarande styrkor:

- Registrering av ägg.
- Koppling till höna och flock.
- Statistik för idag, vecka och månad.
- CSV- och PDF-export.
- Grupperad vy och listvy.

Utvecklingsförslag:

- Kalenderläge där användaren ser ägg per dag.
- Snabbregistrering från dashboarden: plus/minus för dagens antal.
- Automatisk trendanalys: "Din produktion är 12 % högre än förra veckan".
- Varningssignal om äggproduktionen faller ovanligt mycket.
- Jämförelse per höna och flock.
- Noteringar för avvikande ägg, till exempel tunna skal, små ägg eller smutsiga ägg.
- Prognos för månadens totala produktion.

## Hönor och flockar

Nuvarande styrkor:

- Hantering av hönor och tuppar.
- Flockar.
- Aktiv/inaktiv status.
- Individuella profiler.

Utvecklingsförslag:

- Livshändelser per höna: inköpt, började värpa, sjuk, såld, avliden.
- Hälsologg per individ.
- Bildgalleri per höna.
- Rasregister med vanliga raser och typisk äggproduktion.
- Åldersbaserade tips: unghöna, vuxen, äldre höna.
- Flockhistorik: när en höna flyttats mellan flockar.
- Släktskap/stamtavla för användare som kläcker fram egna kycklingar.

## Foder

Utvecklingsförslag:

- Foderlager: hur mycket foder finns kvar?
- Automatisk beräkning av dagar kvar baserat på förbrukning.
- Kostnad per ägg baserat på foderkostnad och produktion.
- Foderrecept/blandningar.
- Påminnelse när foder börjar ta slut.
- Jämförelse mellan olika fodertyper och kostnadseffekt.

## Ekonomi

Nuvarande styrkor:

- Intäkter och kostnader.
- Kategorier.
- Budgetmål.
- Ekonomisk analys.
- CSV/PDF-export.

Utvecklingsförslag:

- Automatisk koppling mellan sålda ägg och intäkter.
- Pris per ägg, 6-pack, 12-pack och flak.
- Kundlista för återkommande äggköpare.
- Skuld/saldo per kund: vem har hämtat men inte betalat?
- Resultat per månad, kvartal och år.
- Lönsamhet per flock.
- Tydligt nyckeltal: kostnad per ägg.
- Förslag på pris: "För att täcka dina kostnader behöver du ta X kr per ägg".

## Statistik

Utvecklingsförslag:

- Trendgrafer för äggproduktion, foder och ekonomi.
- Jämförelse mellan perioder.
- Bästa/sämsta produktionsveckan.
- Samband mellan foder, säsong och äggproduktion.
- Export av statistikbilder för sociala medier.
- Benchmark mot egna historiska data.

## Dashboard / Översikt

Utvecklingsförslag:

- Dagens viktigaste kort: ägg idag, påminnelser, foder kvar, netto denna månad.
- Snabbknappar för de vanligaste åtgärderna.
- Personlig hälsning och nästa bästa åtgärd.
- Varningskort: försenade påminnelser, låg äggproduktion, foder snart slut.
- Veckosummering direkt på startsidan.

## Påminnelser och hälsa

Utvecklingsförslag:

- Databaskopplade påminnelser.
- Återkommande intervall.
- Pushnotiser/e-postnotiser.
- Hälsodagbok per höna.
- Mallar för vanliga händelser: avmaskning, kvalsterkontroll, vaccination, veterinär, rengöring.
- Symptomlogg: aptit, beteende, vikt, fjäderdräkt, avföring.
- Historik som kan exporteras inför veterinärbesök.

## Kläckning

Utvecklingsförslag:

- Kläckningskalender dag för dag.
- Automatisk dagräkning från startdatum.
- Checklista: vändning, temperatur, luftfuktighet, lockdown, beräknad kläckning.
- Registrera antal ägg, befruktade, kläckta och överlevande.
- Statistik över kläckningsgrad.
- Koppling till föräldradjur/stamtavla.

## Dagliga uppgifter

Utvecklingsförslag:

- Återkommande rutiner: släppa ut, stänga in, byta vatten, fylla foder, samla ägg.
- Veckoschema.
- Familje-/teamdelning: vem gjorde vad?
- Streaks och enkel gamification.
- Koppling till påminnelser.

## Import

Utvecklingsförslag:

- Importmallar för CSV/Excel.
- Förhandsgranskning innan import.
- Felrapport: vilka rader gick inte att importera och varför?
- Import av historisk äggdata, hönslista och transaktioner.
- Deduplicering så samma rad inte importeras flera gånger.

## Community

Utvecklingsförslag:

- Frågor och svar mellan hönsägare.
- Möjlighet att dela erfarenheter och tips.
- Flockprofiler eller frivillig offentlig profil.
- Månadens tips, ras eller gård.
- Moderering och rapportering.

## Premium

Utvecklingsförslag:

- Avancerade rapporter.
- PDF-export med månads-/årsrapport.
- Pushnotiser.
- Fler flockar eller större historik.
- Kund- och försäljningsfunktioner.
- Hälsologg och veterinärexport.
- Kläckningsmodul med avancerad statistik.
- Familjedelning/teamfunktion.

## SEO och innehåll

Utvecklingsförslag:

- Bygg vidare på blogg/guider med tydliga kategorier.
- Skapa landningssidor för sökord som "äggloggare", "höns app", "foderkostnad höns" och "börja med höns".
- Lägg till FAQ-schema på guider.
- Internlänka från artiklar till relevanta verktyg, till exempel äggkalkylatorn.
- Skapa jämförelsesidor: "Hönsgården vs Excel" eller "Digital ägglogg jämfört med anteckningsbok".

## Teknisk kvalitet

Utvecklingsförslag:

- Striktare TypeScript stegvis.
- Fler tester för viktiga flöden.
- Felrapportering i produktion.
- Minska hårdkodade fallback-värden.
- Se över PWA-cache för inloggade sidor.
- Lägg till databasregler/tester för Row Level Security.
- Förbättra tillgänglighet med tangentbordsnavigering och aria-labels.
