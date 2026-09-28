# Säkerhets- och kvalitetsomgång 2026-09-23

Bas: `ecb0d3c`, separat gren `security/quality-seven-phases`. PR #72 är fortfarande separat och draft. Inga produktionsmigrationer har körts i denna omgång.

## Fas 1 – databasbehörigheter

Migration: `20260923054415_phase1_database_permissions.sql`.

- Återkallar PUBLIC-, anon- och authenticated-grants för samtliga 14 serverfunktioner och befintliga overloads. Service role behålls.
- Admin-anrop använder två admin-kontrollerade omslagsfunktioner. API:t hanterar även fel när livstidsflaggan återställs.
- Värvningskod skickas i signup-metadata och behandlas av registreringstriggern.
- Alla public-policies som använder gårdshjälparna ändras till authenticated före återkallelsen. Hjälparna kräver egen användaridentitet eller service role.
- Premiumtriggern kräver frånvaro av både uid och JWT-roll för interna ändringar. En transaktionslokal flagga möjliggör belöningar, och dess föregående värde återställs efter tilldelningen.
- Annonskolumner motsvarar exakt anon-listan från 20260718232511. Privat RPC kräver ägare/admin. Fem wildcard-frågor ersatta med kolumnlistor.

Anropargranskning före återkallelse: samtliga RPC-anrop i `src` och `supabase/functions`, SQL-funktionskroppar i migrationshistoriken och aktuell databas samt `pg_policies` för public och storage. Edge-anroparna använder service role; `generate-report` skickar den verifierade användarens id. `getDiaryLogs`/`FamilyMembers` använder sessionens id. SQL-anroparna är SECURITY DEFINER: achievement, första-ägg-värvning, `get_hen_ancestors`, mejltriggers och digitala kvitton. Samtliga berörda policyuttryck skickar `auth.uid()`; de två Storage-policies är redan authenticated.

Avvikelser: de fem angivna annonsvyerna använder inte owner_email/contact_phone/manage_token och behöver därför inte extra privata RPC-anrop. INSERT…SELECT i CreateEggSaleListingDialog är redan explicit (`id, slug`); inga wildcard-returer efter INSERT/UPDATE på tabellen hittades. RLS-testet körs i isolerad PGlite med verkliga SQL-funktioner för berörda flöden; externa kö-/orderfunktioner är stubbar. Det ersätter inte verklig Supabase Auth/Storage-verifiering.

Verifiering: `tests/rls/phase1-database.mjs` inkluderar den verkliga premiumbuggen före migrering, återkörning av migreringen, privilegier för alla 14 funktioner, nekad anonym tilldelning, adminspärr, gårdsidentitet, annonssekretess, signup utan JWT och achievement-/referralbelöning med användar-JWT. Lint godkänd med 685 befintliga varningar, `npx tsc -b` godkänd och 902 tester i 103 filer godkända. Databastestet godkänt.

## Fas 2 – cron och edge-auth

Migration: `20260923055127_phase2_cron_auth.sql`.

Alla 21 funktioner som läste CRON_SECRET använder nu `isCronAuthorized`: endast exakt x-cron-secret eller service-role-bearer, med timingSafeEqual över SHA-256-digester. Tom konfiguration, anon-nyckel, förfalskad JWT och cron-hemlighet i Bearer nekas. Osignerad JWT-avkodning borttagen. Health-check svarar med ok/totalIssues/counts; detaljer går till adminmejl, felmeddelanden exponeras inte i HTTP-svaret. De fyra angivna jobben schemaläggs med Vault-läst CRON_SECRET och befintliga tider.

Verifiering: 22 autentiseringstester inklusive de verkliga HTTP-handlernas avvisning före databasanrop; isolerad SQL verifierar fyra jobb även efter andra körningen och frånvaro av inbäddade autentiseringsvärden i jobben. Övriga äldre cron-definitioner ändras inte. `send-payment-reminder` behåller sitt separat verifierade manuella ägarflöde.

Fasens kontroller: lint godkänd (686 varningar), TypeScript godkänd, 924 tester i 104 filer godkända. Backend-tester ligger i `tests/edge` och ingår i npm test; klientens befintliga kontroll mot service-role-referenser behålls oförändrad.

## Fas 3 – mejl och bokningar

Migration: `20260923055747_phase3_safe_email_and_bookings.sql`.

SQL-HTML escape täcker samtliga nio aktiva mejltriggers, inklusive länkattribut och kontaktfragment. Gemensam edge-escape används för oskyddade användarfält (även namn, ort, bevakningstext, hälsoanteckningstitlar, AI-text och Swish). Befintliga korrekta escape-funktioner som redan skyddade övriga mallar behålls. Alla hårdkodade lovable.app-länkar i edge-funktionerna ersätts med PUBLIC_APP_URL (fallback honsgarden.se); de tre tillåtna origin-listorna behålls.

Bokningsgränser: rullande timme, högst tre per normaliserad e-postadress och tio per annons. Transaktionslås skyddar kontrollen; inkommande created_at kan inte användas för att kringgå gränsen. Bokningssidan visar redan databasens svenska feltext. seller_notified_at sätts atomiskt efter lyckad köläggning; fel lämnar raden omarkerad och möjlig att försöka igen.

Avvikelser: produktionen har två mejltriggers vars definitioner saknas i repots tidigare migrationer (`notify_post_owner_on_comment`, `notify_seller_on_booking`). Deras aktuella definitioner ingår därför i denna migration med escape. Säljarmejl skickades både av SQL-trigger och edge-funktion; båda använder nu samma låsta köoperation. Befintlig transport är en mejlkö: tidsstämpeln betyder framgångsrikt kölagt, inte bekräftad leverans till inkorgen. `pack_size` i notify-seller-booking motsvarar inte tabellens `eggs_per_pack`; den orelaterade befintliga frågan har lämnats oförändrad enligt regeln om avvikelser.

Verifiering: isolerad SQL kör migrationen två gånger, provar nio faktiska mejl med HTML-angreppssträngar, båda bokningsgränserna, manipulerad tidsstämpel, nytt tidsfönster, dubbelnotis och köfel. Edge-tester provar faktiska HTML-resultat och kölagda hämt-/recensionsmejl, URL-konfiguration och redan aviserad bokning.

Fasens kontroller: lint godkänd (694 varningar), TypeScript godkänd och 932 tester i 105 filer godkända. SQL- och edge-testerna är gröna. Databastyper uppdaterade för tidsstämpeln och nya RPC:er.

## Fas 4 – betalningar

Ingen ny databasmigration: endast edge-kod.

invoice.payment_succeeded använder parent.subscription_details.subscription med äldre subscription-fält som fallback; både id och expanderat objekt stöds. Premiumkontrollen prioriterar lagrat Stripe-kund-id, faller tillbaka vid saknat/raderat kund-id och går igenom alla e-postmatchningar och alla prenumerationssidor. active, trialing och past_due bevarar premium. Apple-profiler får 48 timmar efter lokal utgång. Stripe-fel lämnar premium orört.

Verifiering: HTTP-test för alla tre betalande statusar på en senare kundmatchning, primärt kund-id, saknad kund, Stripe-fel och Apples 47-/49-timmarsgräns; fakturatest för nytt, äldre och expanderat prenumerationsfält.

Fasens kontroller: lint godkänd (698 varningar), TypeScript godkänd och 940 tester i 106 filer godkända.

## Fas 5 – dashboard och startsida

Ingen databasmigration. DashboardV3 får StreakFlame i den befintliga streak-positionen, achievements/nudge, äggmål, CountUp, dagsmodal och entitlement-styrda Plus-insikter. Gratisanvändare får årskortet i december/januari, annars SmartUpsell; aldrig båda. Installation visas bara i vanlig webbläsare. Demo behåller lokala demo-API:er för mål/framsteg men visar inga nya modal-/installations-/uppsäljningsuppmaningar. Dagsmodalens StrictMode-bugg åtgärdad och visning reserveras per användare/dag före hämtningen. V3:s övriga struktur och alla CSS-filer bevarade.

Persona-tester läser V3. V2 saknade anropare och raderades efter gröna riktade tester. Startsidan och dess prerender är annonsfria; guidernas befintliga länkar behålls och rasöversiktens befintliga annonsblock får Outl1-länken.

Avvikelser: annonsblocket låg före avslutande registrerings-CTA, inte i hero. Guider hade redan båda handlarna. CountUp fanns redan i QuickEggLogCard; även dagens ägg i journalraden använder det nu. V3:s tidigare streak-visning var StreakRescueCard.

Verifiering: renderade komponenttester för gratis/Plus, säsongsval, native, standalone och demo samt faktisk dagsmodal genom StrictMode/återmontering/nästa dag. Lint godkänd (694 varningar), TypeScript godkänd och 948 tester i 108 filer godkända.

## Fas 6 – AI-spärrar

Migration: `20260923061441_phase6_ai_limits.sql`.

De fem angivna funktionerna använder gemensam serverkontroll: verifierat user-id, service-role-klient, check_rate_limit med 10 anrop/60 minuter per funktion, och 100 anrop per användare/UTC-kalendermånad gemensamt för de fem funktionerna. Kvotreserveringen sker atomiskt före AI-anropet. Databas-/kvotfel stoppar AI-anrop med 503; överskridna gränser ger 429 med svensk text. analyze-import stoppar vid 200 000 faktiska UTF-8-byte med 413, oberoende av Content-Length.

Avvikelser: agda-chat har 10/minut och 100/200 frågor per månad beroende på livstidspremium. Det mönstret återanvänds för autentisering/rate-RPC men gränserna följer uttryckligen denna beställning. En separat atomisk månadskvot införs för de fem hjälpfunktionerna; chatthistoriken förblir ren och Agdas befintliga kvot ändras inte. Reserverade AI-anrop räknas även om AI-leverantören sedan misslyckas.

Verifiering: 22 HTTP-tester täcker alla fem handlers, service-klient/verifierat id, båda spärrarna, fail-closed och bytegränsens båda sidor. SQL-test: 110 kvotförsök ger exakt 100 tillåtna, separata användare/månader och inga klientgrants; migrationen går att återköra. Lint godkänd (696 varningar), TypeScript godkänd och 970 tester i 109 filer godkända.

## Fas 7 – hygien, iOS och nyhetsbrev

Migration: `20260923062127_phase7_newsletter_double_opt_in.sql`.

- strict=true, noImplicitAny=false. De 32 rapporterade typfelen rättade med typvakter, optional chaining och korrekta formatterarsignaturer. Saknad väderdata ger ingen fabricerad temperatur. Feed-API:t saknar total_eggs/days_remaining; dess befintliga nollfallback behålls med typvakter.
- SheetJS 0.20.3 installerad från den angivna officiella tarball-URL:en. React Router uppdaterad till senaste 6.x som npm-registret returnerade: 6.30.6. Låsfilen uppdaterad. Miljöns replace-registry-host=always skrev initialt om CDN-adressen felaktigt; installationen lyckades med kommandoflaggan --replace-registry-host=never. Ingen global konfiguration ändrad.
- Settings och Login lazy-laddas med lazyWithRetry. De sex namngivna komponenterna saknade referenser i src/scripts/tests och är raderade.
- NSLocationWhenInUseUsageDescription har exakt den beställda svenska texten.
- Dubbel opt-in: confirmed_at, confirm_token och confirmation_sent_at; låst SECURITY DEFINER-trigger normaliserar adress, skickar högst en bekräftelse per 24 timmar och möjliggör återanmälan av gamla obekräftade adresser. Köfel rullar tillbaka tidsstämpeln. Engångstoken förbrukas av confirm_newsletter och exponeras inte via tabellgrants. Klienten får bara skriva email. Befintliga adresser blir inte automatiskt bekräftade.
- Bekräftelse sker via det befintliga formuläret på /blogg. Token ligger i URL-fragment och tas bort direkt. Ingen ny route eller CSS. Anmälan säger att mejlet måste bekräftas.
- Brevo-synken tar enbart bekräftade adresser, även prenumeranter utan appkonto, med paginering. Aktiverings-/provtidsmarknadsföring kräver samma samtycke. Mejlkön kontrollerar även redan kölagd marknadsföring före leverans. Auth, bokning, köp, beställda gårdsrapporter/påminnelser och själva bekräftelsemejlet är separata transaktionsflöden.

Anropargranskning före nyhetsbrevsgrants: NewsletterSignup är enda klientskrivaren och skickar endast email; tidigare synk använde profiles. Inga SQL-funktions- eller Storage/RLS-anropare till tabellen hittades i produktion eller migrationshistorik. Admin-RLS behåller SELECT på metadata utan token. Inga separata nyhetsbrevsproducenter fanns i SQL; Brevo är den externa distributionsvägen.

Verifiering: SQL testar dolda token/fältgrants, en engångsbekräftelse, dygnsspärr med olika skiftlägen, gamla adresser/ny token och körollback. Renderat formulär testar anmälan, StrictMode/dubbla formulär och ogiltig länk. Edge-tester verifierar paginering, synk utan obekräftade profiler, marknadsföringsspärr och kökontroll.

## Slutkontroller

| Fas | lint (fel / varningar) | tsc -b | npm test |
|---|---:|---|---:|
| 1 | 0 / 685 | godkänd | 902 |
| 2 | 0 / 686 | godkänd | 924 |
| 3 | 0 / 694 | godkänd | 932 |
| 4 | 0 / 698 | godkänd | 940 |
| 5 | 0 / 694 | godkänd | 948 |
| 6 | 0 / 696 | godkänd | 970 |
| 7 | 0 / 687 | godkänd | 978 |

Slutlig npm run build godkänd, inklusive editorial-, prerender-, SEO- och routekontroller. Alla fem isolerade SQL-sviter körda igen efter sista fasen och godkända. Inga CSS-filer ändrade. Genererade tsbuildinfo-filer och sitemap-omskrivningen från build ingår inte i ändringen.

SQL-sviterna finns i tests/rls: phase1-database.mjs, phase2-cron.mjs, phase3-email-bookings.mjs, phase6-ai-quota.mjs och phase7-newsletter.mjs. De kan köras med Deno enligt kommandot i varje fil, eller Node med PGLITE_MODULE pekande på installerad PGlite.

## Återstår vid driftsättning

- De fem nya migrationerna och ändrade edge-funktionerna är implementerade och testade isolerat, men inte applicerade i produktion. Driftsätt tillsammans med klientändringarna och verifiera med riktiga anon-/användar-/admin-sessioner samt Supabase Auth/Storage. Inga externa mejl har skickats under arbetet.
- Kontrollera att Vault CRON_SECRET och edge-miljöns CRON_SECRET överensstämmer och att PUBLIC_APP_URL har önskat värde. Äldre migrationshistorik skrivs inte om; rotera tidigare hårdkodat cron-värde om det fortfarande används.
- Befintliga kontakter/kampanjer som redan importerats till Brevo kan inte rensas genom en lokal kodändring. Stäm av dessa mot confirmed_at före nästa externt schemalagda nyhetsbrev. Befintliga prenumeranter måste bekräfta; ingen obeställd massbekräftelse skickas av migrationen.
- sync-brevo har en äldre separat x-cron-autentiseringsgren som inte läste CRON_SECRET och därför låg utanför listan i 2.1. Den befintliga grenen är oförändrad. Detsamma gäller andra identifierade avvikelser ovan (bl.a. pack_size i notify-seller-booking).
- iOS-behörighetstexten är uppdaterad; native-byggnad och verklig platsdialog har inte körts i denna Linux-miljö. De kvarvarande 687 lintvarningarna ingår inte i beställningen att göra lint felfri.

Publicering av granskningsgrenen blockerades av automatisk godkännandegranskning: git push till origin (Ralibali/honsgarden-85030ffc) bedömdes innebära överföring av privat kod/säkerhetsändringar till en mottagare som inte verifierats som organisationsägd. Ingen alternativ uppladdningsväg har använts. Sju lokala fascommits och rapporten är klara; uttryckligt godkännande för push till detta repo behövs innan draft-PR kan skapas.


## Återställning 2026-09-28

Filerna från den bevarade arbetskopian har återställts mot den dokumenterade basen `ecb0d3c`. Den ursprungliga Git-katalogen och dess sju separata fascommits finns inte längre lokalt; återställningen bevarar slutresultatet i en ny samlad commit och påstår inte att den ursprungliga commit-historiken har återställts. Nyare main och PR #72/#78 skrivs inte över.

Ägaren har nu uttryckligen begärt push av nyare arbete till sina projekt. Repot är verifierat som `Ralibali/honsgarden-85030ffc` med administratörs- och skrivrättighet för det anslutna kontot. Säkerhetsgrenen sparas för fortsatt samordnad release. Main-publicering av klientdelarna kräver fortfarande de dokumenterade databas-/backendändringarna: bland annat admin-RPC:er och nyhetsbrevets bekräftelsefunktion.
