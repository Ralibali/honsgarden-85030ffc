# Första SEO- och innehållspiloten

Datum: 2026-09-06. Bas: `106868fd7b1dc49e382f01901d1d783726bb19cf`.

## Projektbrief

Hönsgården hjälper svenska hobbyhönsägare att samla flock, ägglogg och vardagssysslor. Publik webb: https://honsgarden.se. Kodverifierade ingångar: `/demo` (exempeldata, inget konto krävs), `/verktyg/aggkalkylator` och `/verktyg/klackningskalkylator`.

Primärt produktmål är första loggade ägget och fortsatt användning. Befintliga events beskrivs i `docs/ANALYTICS.md`; aktivering och retention i `docs/GROWTH_INTELLIGENCE.md`.

GSC, privat Plausible-statistik, konverteringsnivå och intäkter: **okända i denna pilot**. Sidorna valdes efter innehåll och produktrelevans, inte uppmätt sökvolym. Inga nya köp, kampanjer eller automatiska körningar ingår.

## Fem granskade sidor

Alla gav HTTP 200 vid offentlig kontroll 2026-09-06. Titlar och artikeltext lästes. Befintlig titel, H1, canonical och ursprunglig artikeltext ändras inte i denna pilot.

| Sida | Observation före | Genomförd ändring |
|---|---|---|
| `/blogg/hur-manga-agg-lagger-en-hona` | Avsnittet om äggregister saknar en tydlig väg till att prova loggningen i första HTML. | Ett nästa-steg-avsnitt länkar till demon och foderguiden. |
| `/blogg/foder-till-hons-guide` | Artikeln diskuterar kostnad per ägg men leder inte till befintlig kalkylator. | Länk till äggkalkylatorn med förklaring att resultatet beror på inmatade antaganden, samt äggproduktionsguiden. |
| `/blogg/hons-pa-vintern` | Rutiner beskrivs utan en tydlig väg att utforska produktens översikt. | Avsnitt som leder till demon och foderguiden. |
| `/blogg/skaffa-hons-nyborjare` | Checklistan har ingen tydlig övergång till att prova appen med exempeldata. | Länk till konto-fri demo och guiden om att bygga hönshus. |
| `/blogg/klacka-agg` | Guiden saknar länk till projektets kläckningskalkylator. | Planeringsavsnitt med kalkylatorlänk, osäkerhetsformulering och länk till nybörjarguiden. |

Implementationen ligger i `src/lib/guideNextSteps.mjs`. Den används både i prerender och klienten och lägger till ett avsnitt per utvald artikel. Andra artiklar behåller sitt innehåll. Originalartiklarna ligger i befintligt CMS; inga databasskrivningar görs.

## Kvarstående redaktionella frågor

Vid granskningen noterades förstapersonsberättelser vars upphov inte har verifierats, kategoriska råd om ljus/foder samt uppskattningar av kostnader och värpning. De är inte faktagranskade eller godkända genom denna förändring. Gör separat granskning mot relevanta primärkällor innan dessa påståenden återanvänds i annonser eller nya texter. Videomanuset i denna pilot demonstrerar därför endast verktyget med uttryckliga exempelvärden.

## Mätplan

- Spara faktiskt produktionsdatum när ändringen går live. En commit är inte bevis på driftsättning.
- Hämta senaste 90 dagarnas GSC-data per sökfråga + sida och jämför med relevant period. Beakta säsong och databegränsningar.
- Följ de fem landningssidornas besök och övergångar till demo/verktyg där den befintliga analytics-tjänsten stödjer detta. Konfigurera och verifiera en sådan funnel innan den rapporteras som mätbar; inga nya events har lagts till här.
- Befintliga `Demo Opened`, `Demo To Signup` och `First Egg Logged` kan användas som produktindikatorer. Koden ensam bevisar inte att de kan tillskrivas en viss artikel eller att användaridentitet kan kopplas mellan sessioner.
- Första jämförelse efter cirka 28 dagar med tillräcklig data. Detta är ett granskningsfönster, inte ett resultatlöfte. Ange otillräckligt underlag vid små urval.

## Återställning

Ta bort anrop/import av `injectGuideNextSteps` i klient och prerender, eller reversera pilotens commit. Inga URL:er, CMS-poster eller databasstrukturer behöver återställas.

## Verifiering av leveransen

- Typkontroll: `tsc -b --pretty false` passerar.
- Tester efter färdigt bygge: 78 filer, 723 tester passerar (inklusive sex nya tester för avgränsning, idempotens och HTML-sanering).
- `npm run build`: passerar, inklusive prerender, SEO-kontroll och routingkontroll. SEO-kontrollen omfattar 123 artiklar.
- Lint: 0 fel, 711 varningar i projektet.
- Fem byggda artikel-HTML-filer: exakt ett nytt avsnitt, rätt sluttext och två relevanta länkar i varje fil.
- Webbläsare: de fem avsnitten visas; foderguidens länk öppnar kalkylatorn; ändring från 5 till 4 ägg per höna/vecka ger 3,70 → 4,62 kr per ägg med verktygets övriga exempelvärden. Kläckningsguidens länk öppnar rätt verktyg och en tidplan kan beräknas. Nybörjarguidens länk öppnar konto-fri demo med märkta exempeldata. Avsnittets desktop-layout har granskats visuellt.
- Kvarstående runtime-observation: React #418/#423 vid hydration av produktionsbyggets artiklar. Samma fel reproduceras på oförändrade `/blogg/bygga-honshus`, där pilotens renderer lämnar innehållet orört. Detta är inte en felfri konsolkontroll; en separat granskning av prerender/React-övergången behövs.
- Det befintliga scriptet för kontextuella produktkort kan även lägga produktkort vid de nya rubrikerna. Ingen affiliatekonfiguration eller produktprissättning har ändrats.

Första testkörningen överlappade bygget och ett befintligt test hittade därför bara en av tre byggda ras-/bloggsidor. Det passerade efter bygget; den avslutande fulla testkörningen ovan kördes sekventiellt efter ett färdigt produktionsbygge.
