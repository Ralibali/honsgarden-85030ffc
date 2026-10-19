# Aurora Activate v1 – Hönsgården

## Syfte

Minska bortfallet mellan registrering och första användbara resultat, utan att skapa en ny onboarding-produkt eller tvinga fram ett betalsteg.

## Implementering

Återanvänder `OnboardingChecklistCard` i dagens startsida (DashboardV3). Checklistan är alltid åtkomlig, även efter att användaren registrerat en höna och sitt första ägg, och kan döljas/öppnas av användaren. Dold status sparas lokalt per användarkonto; ingen databas- eller behörighetsändring.

Stegstatus beräknas från befintliga data via `computeAuroraActivateState`:

1. Minst en verklig flock
2. Minst en höna
3. Minst en äggregistrering
4. Minst ett foderköp/foderregistrering
5. Minst sju äggregistreringar, så att det finns underlag för mönster/insikter (inte samma sak som sju separata dagar)

Foder och insikter är naturliga nästa steg, inte ett krav för att få använda appen. Inga premiumfunktioner låses upp automatiskt.

## Händelser

Använder befintliga Plausible-event via `trackEvent` i `src/lib/analytics.ts`:

- `Onboarding Viewed` – första gången guiden syns för en användare efter datahämtning
- `Onboarding Step Completed` med `step` = `flock_created`, `first_hen`, `first_egg`, `feed_recorded` eller `insights_ready`
- `Onboarding Completed` – samtliga steg uppnådda

Händelserna dedupliceras lokalt per konto. Inga e-postadresser, namn, flock-ID eller annan PII skickas som event-properties. Deduplicering via localStorage är **inte** en server-side sanningskälla; historiska användare räknas när de besöker dashboarden och har motsvarande data. Analys bör därför begränsas till nya konton efter lansering.

## Mätning

Följ kohorter av nya konton veckovis:
- andel som slutför flock + första höna + första ägg
- mediantid mellan registrering och första äggloggen (kräver serverdata för exakt tid)
- 7- och 30-dagars återkomst, samt andel Plus-konverteringar, utan att markera betalning som onboardingsteg

## Tester

`src/lib/__tests__/auroraActivate.test.ts` verifierar framsteg, återöppning och per-användare-deduplicering. Kör `npm run typecheck`, `npm run test` och `npm run build` i CI före produktionspublicering.
