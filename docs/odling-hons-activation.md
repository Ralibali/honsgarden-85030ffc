# Aktivering: Odling + Höns

Detta är kod och migrationer, inte en bekräftelse på att produktionsdatabaserna är uppdaterade. Den anslutna Supabase-integrationen gav vid arbetet inte åtkomst till vare sig Odlingsdagbokens eller Hönsgårdens projekt. Inga produktionsmigrationer, DNS-poster, Stripe-priser eller Auth-inställningar ändrades.

## Vad som kan publiceras direkt

Fröförrådets såuppgifter/påminnelser, lokala regnråd, bladfoto till Gro med befintligt AI-samtycke, säsongsbild, tydlig onboarding utan demoposter och de svenska bekräftelsesidorna. Äggbodens befintliga bokningsväg begär inte längre den SELECT-rättighet som bara säljaren har, och kvittot behåller det inskickade antalet när formuläret töms.

Nya tabellberoende vyer skyddas av byggflaggor. Befintlig app behöver inte anropa tabeller som ännu saknas. Pris saknas för kombopaketet; inget nytt pris har hittats på eller skapats. Befintliga betalabonnemang ändras inte automatiskt.

## 1. E-post på egen domän

1. Publicera och verifiera `/auth/confirm` i båda apparna. Hönsgårdens route inventory och Vercel-rewrites innehåller sidan. Garden har motsvarande prerenderad sida.
2. Driftsätt uppdaterad `auth-email-hook` där den används. Den omvandlar endast betrodda signup-länkar för det egna Supabase-projektet till en länk med token-hash i fragmentet på appens domän.
3. Kör `node scripts/configure-signup-auth.mjs` med behörig `SUPABASE_ACCESS_TOKEN` i operatörens miljö. Standard är dry-run; `--apply` sätter Site URL, bevarar befintliga redirect-adresser och installerar `supabase/templates/confirmation.html`.
4. Kontrollera de verkliga signup-mejlen. Site URL ensam byter inte den genererade Supabase-verifieringslänkens domän; mallen/hooken måste också användas. Ingen Supabase custom-domain-prenumeration behövs för den här app-baserade verifieringen.

## 2. Trädgårdens karta, delning och fröbyte

I Garden-projektet `ysonnvbkrwajacvdkqut`, granska/kör migrationen `20261007165434_garden_planner_sharing_exchange.sql`. Den lägger till tabeller, ägar-/medlemskontroller och engångsinbjudningar; tidigare privata poster utan bädd förblir privata. Medlem kan ändra gemensamma loggar men inte byta författare eller flytta någon annans logg till en annan bädd.

Kör `gardenSharingDatabase.test.ts` och den gemensamma testlistan med separata testkonton. Sätt därefter `VITE_GARDEN_EXPANSION_ENABLED=true` vid Garden-bygget. Flaggans frånvaro betyder avstängt. En trädgårdsplan är en plan, aldrig en automatiskt skapad sådd.

## 3. Kopplade konton och separat kombopaket

Kontokoppling är en övergångslösning över de två befintliga Auth-projekten. Användaren bekräftar båda kontona en gång och kan sedan växla via en fem minuter lång engångslänk. Befintliga lösenord eller konton massmigreras inte; konton kopplas aldrig enbart på matchande e-post.

1. Kör Garden-migrationen `20261007171619_bundle_entitlements.sql` och Hönsgårdens `20261007170754_unified_accounts_and_egg_orders.sql` (den sistnämnda innehåller kontokoppling/Plus; orderändringarna är i en separat migration).
2. I Hönsgårdens projekt `sikbymtrbhrofysgkqsj`, driftsätt `unified-account` och `unified-stripe-webhook`. `verify_jwt=false` krävs för dessa två: broker-funktionen verifierar rätt issuers JWT själv; webhooken verifierar Stripe-signaturen.
3. Konfigurera `GARDEN_SERVICE_ROLE_KEY` **endast som Edge Function-hemlighet i Hönsgården**, aldrig som Vite-variabel eller klientkod. Befintliga Supabase-nycklar ligger kvar i respektive servermiljö.
4. Driftsätt uppdaterade `check-subscription`, `create-checkout` och `delete-account` i båda apparna. Driftsätt också Garden `gardening-coach` och Hönsgården `agda-chat`, `generate-report`, `generate-backup`, `weekly-insights`, `weekly-report-email`. De läser den separata serverstyrda Plus-rättigheten; vanliga provperioder och butiksköp skrivs inte över.
5. Sätt `UNIFIED_ACCOUNT_ENABLED=true` i båda projektens Edge-miljöer. Sätt `VITE_UNIFIED_ACCOUNT_ENABLED=true` i båda webbbyggena. Kontokoppling/kassa lanseras på webben; mobilappens befintliga butiksköp fortsätter via respektive butik.
6. Välj först ett beslutat paketpris. Konfigurera dess återkommande SEK-pris i Hönsgårdens Stripe-konto som `STRIPE_BUNDLE_PRICE_ID`; priset ska ha fast positivt belopp och moms inkluderad (`tax_behavior=inclusive`). Klienten visar belopp och intervall från Stripe.
7. Skapa en separat webhookdestination till `unified-stripe-webhook`, med minst `customer.subscription.created/updated/deleted` och `checkout.session.completed/async_payment_succeeded`. Sätt `STRIPE_BUNDLE_WEBHOOK_SECRET`. Befintliga webhookdestinationer ersätts inte.
8. Verifiera Stripe-testläge och båda projekten enligt checklistan. Sätt **först därefter** `BUNDLE_CHECKOUT_ENABLED=true` i Hönsgårdens servermiljö. Före det visas ingen köpknapp. Köp av kombopaket blockerar dubbla pågående appabonnemang; ingen automatisk migrering/uppsägning görs.

Webhooks läser Stripes aktuella abonnemang och skriver lokala åtkomsträttigheter i båda projekten. Ofullständig skrivning returnerar fel så Stripe kan försöka igen. Tidsstämplar förhindrar att äldre verifieringar återställer en återkallad rättighet. Kontostatus kan reparera de lokala rättigheterna vid nästa kontroll. Det går att ta bort en inaktiv kontokoppling; kontoradering stoppar kombodebitering innan data tas bort.

Vid driftstörning: stäng i första hand **köpflaggan**. Stäng inte entitlement-kontrollen för redan betalande användare. Övervaka misslyckade webhooks, kontrollera båda lokala rättigheter och rätta via Stripe-återleverans innan aktivering igen. Vid administrativ kontoradering utanför appens raderingsflöde måste även kopplad Stripe-prenumeration hanteras.

## 4. Äggbodens säkra orderflöde

1. Granska/kör Hönsgårdens `20261007171618_atomic_egg_orders.sql`. Lager och hämtningstid låses i samma transaktion; servern beräknar pris/rabatt och sparar det accepterade beloppet. Gamla order får inget påhittat historiskt pris.
2. Migrationen tar bort direkt INSERT/UPDATE för anon/authenticated på ordertabellen. Samordna därför migrationen med webbbygget `VITE_ATOMIC_EGG_ORDERS_ENABLED=true`. Flaggans standardläge använder den tidigare policyn; det läget ska inte lämnas aktivt efter migrationen.
3. Driftsätt uppdaterade `notify-seller-booking`, `send-payment-reminder` och `pickup-reminder` efter migrationen. Kvitto och påminnelser använder sparat orderpris. Inga mejl skickades under utvecklingstesterna.
4. Verifiera två samtidiga verkliga testanslutningar för sista kartan/hämtningstiden. PGlite-proverna kör den faktiska migrations-SQL:en och testar behörighet, lagerslut, prisändring, engångsförsök och atomiska statusgrupper, men ersätter inte ett samtidighetstest mot driftsatt Postgres.

## Kontroll och gemensam kod

`packages/app-foundation` har samma versionsnummer och SHA-256-manifest i båda repos. `scripts/check-app-foundation.mjs` stoppar oavsiktlig drift vid bygge. Gemensam manuell testlista: `packages/app-foundation/TEST_CHECKLIST.md`.

Automatiska kontroller: Vitest, TypeScript med `tsconfig.app.json`, ESLint och produktionsbygge/routekontroller. Extra databasprover körs i PGlite med separata roller och den verkliga migrations-SQL:en. Inga produktionskonton eller användarloggar ändrades.

### Resultat från utvecklingskontrollen

- Garden: 511 Vitest-tester godkända.
- Hönsgården: 1 144 av 1 146 godkända i den sista fulla parallella körningen. De två återstående stora-flock-proverna nådde tidsgränsen; hela den testfilen kördes om separat och alla tre prover klarade sig utan kodändring.
- Båda apparnas TypeScript-kontroll (`tsconfig.app.json`) och ESLint klarade sig utan fel. Befintliga lint- och bundlevarningar kvarstår.
- Produktionsbygge och befintliga SEO/route/hostkontroller godkända i standardläge och med alla nya byggflaggor aktiva.
- De nya kontokopplings-/Stripe-funktionerna samt Plus-hjälparna och veckomejlsändringen typkontrollerade med Deno och installerade, versionslåsta npm-beroenden.
- Levande Stripe-betalning, produktionsmejl, driftsatta RLS-regler och samtidiga anslutningar till produktions-Postgres är inte verifierade. Kör aktiveringslistan före lansering.
