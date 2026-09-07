# Betalningsdriftsättning

Hönsgårdens app är registrerad med Apple ID **6809292574** och bundle **se.honsgarden.app**.

## Serverändringar

Apple-transaktioner och servernotifikationer verifieras med Apples officiella App Store Server Library 3.1.0 och offentliga Apple Root CA G2/G3. Hela certifikatkedjan, återkallande, app, miljö och produkttyp kontrolleras. Ett köp måste ha appAccountToken för den inloggade användaren. Tillfälliga verifierings- eller databasfel ger 503 för nya försök. JWT krävs för köpverifiering; Apple-webhooken autentiseras genom Apples signatur.

Migrationen `20260907000954_secure_apple_iap_entitlements.sql` gör preferences.apple_iap och preferences.stripe_plus skrivbara endast från servern och lägger till atomiska funktioner för båda betalsätten. Den bevarar andra inställningar, hanterar gamla återställningar och återbetalningar och skyddar en senare förnyelse från återbetalning av en äldre period. Stripe använder aktuellt abonnemang från API:t vid webhook och läser faktureringsperioden från abonnemangsartikeln. Stripe-avslut rensar även tidigare Stripe-åtkomst som sparats i Apple-statusen; äldre statusavläsningar får inte skriva över nyare.

## Driftsätt i denna ordning

1. Kör den granskade migrationen i projektets Lovable Cloud-databas.
2. Driftsätt `verify-apple-subscription`, `apple-subscription-webhook`, `check-subscription`, `create-checkout` och `stripe-webhook`, inklusive deras `_shared`-beroenden.
3. Appens Apple-ID är fast i koden. `APPLE_APP_ID` kan anges för ett annat avsett app-ID. För TestFlight krävs den explicita backendinställningen `APPLE_ALLOW_SANDBOX=true`; detta aktiverar aldrig Xcodes lokala, självsignerade testkvitton. Behåll produktionsverifieringen aktiverad.
4. Konfigurera App Store Server Notifications V2 för produktion och sandbox till `https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/apple-subscription-webhook`.
5. Kontrollera befintliga `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`, `STRIPE_SECRET_KEY` och `STRIPE_WEBHOOK_SECRET` i projektets säkra inställningar. Kopiera inga hemligheter till repot. Nya köp ska ha samma priser som kundinformationen.
6. Prova TestFlight-köp, återställning, kontobyte, förnyelse, utgång och återbetalning. Prova även webbens checkout och webhook med ett avsett testkonto. Att en endpoint svarar eller att enhetstester passerar bevisar inte ett genomfört betalflöde.

Familjedelning och köp utanför appen får inte aktiveras innan kontokopplingen stöder dessa flöden. Ingen separat Apple API-nyckel krävs för verifiering av signerade transaktioner.

## Lokala regressionstester

- `npm test`: inklusive Apple-kontobindning, återbetalningar, felaktiga transaktioner, fristående provåtkomst och Stripe-produktfiltrering.
- `deno run --node-modules-dir=none --no-config --allow-env supabase/tests/apple-jws.mjs`: avslår osignerade köp, främmande certifikat och osignerade servernotifikationer.
- `deno run --node-modules-dir=none --no-config --allow-read --allow-env supabase/tests/apple-billing.mjs`: PostgreSQL-regler i en helt separat databas i minnet. Använder inga kunduppgifter.

## Källor

- [Apples verifieringsbibliotek](https://github.com/apple/app-store-server-library-node)
- [Apples offentliga certifikat](https://www.apple.com/certificateauthority/)
- [Stripe: faktureringsperioder](https://docs.stripe.com/changelog/basil/2025-03-31/deprecate-subscription-current-period-start-and-end)
- [Stripe: webhooks och nya försök](https://docs.stripe.com/webhooks)
