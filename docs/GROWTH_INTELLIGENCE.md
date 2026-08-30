# Growth Intelligence

Adminytan `/app/growth-intelligence` är Hönsgårdens deterministiska produktanalyslager. Den ersätter inte Plausible-funneln i `docs/ANALYTICS.md`; den kompletterar den med produktdata som redan finns i Supabase.

## Vad den svarar på

- Var tappar vi användare mellan signup → första höna → första ägg → aktiv 7 dagar?
- Hur ser D1-, D7- och D30-retention ut för **mogna cohorts**?
- Hur många är aktiva, i risk (8–30 dagar), dormant (30+ dagar) eller aldrig aktiverade?
- Har två avslutade veckor en materiell förändring i aktiva användare, signups, första-ägg-aktivering eller äggloggare?
- Vilka kodändringar på `main` ligger tidsmässigt nära ett skifte i aktivitet?
- Vilka 1–3 produktåtgärder bör prioriteras denna vecka?

## Datakällor

- `profiles` – signup och aktuell prenumerationsstatus
- `page_views` – autentiserad appaktivitet; adminvägar räknas inte
- `hens` – första hönan
- `egg_logs` – första ägget och återkommande produktaktivitet
- `chore_completions` – återkommande produktaktivitet
- publika GitHub-commits på `main` – change markers, inte deployment-bevis

Observationen är begränsad till 365 dagar för aktivitetsdata. Adminytan hämtar högst 5 000 rader per aktivitetstabell. När volymen växer förbi det ska server-side aggregering eller paginering byggas innan siffrorna används som beslutssanning.

## Retentiondefinitioner

För att inte straffa en cohort innan den hunnit mogna räknas ett konto först när hela fönstret har passerat:

- D1: återkomst dag 1–2, räknas först från kontoålder 3 dagar
- D7: återkomst dag 6–8, räknas först från kontoålder 9 dagar
- D30: återkomst dag 27–33, räknas först från kontoålder 34 dagar

En återkomst är appbesök eller produktaktivitet.

## Anomalier

Anomalidetektorn jämför **två avslutade ISO-kalenderveckor**. Pågående vecka används aldrig, eftersom en halv vecka annars skulle ge falska regressionslarm. En signal kräver minst två användares absolut skillnad och minst 25% relativ förändring. Små baser filtreras bort.

## Change → Result

Adminytan hämtar relevanta `feat`, `fix`, `perf`, `refactor`, `merge` och release-commits från GitHub. För mogna markörer jämförs unika aktiva användare sju dagar före och sju dagar efter.

Detta är **korrelation, aldrig bevisad kausalitet**. Markörer nära andra commits flaggas som confounded. En positiv korrelation är en kandidat att undersöka, inte bevis för att ändringen orsakade effekten.

## Churn

`Dormant 30d+` är beteendemässig churn/inaktivitet. Den ska inte blandas ihop med betald churn. För sann MRR/Plus-churn behövs historiska subscription-, cancel- och reactivation-events, inte bara aktuell `subscription_status`.

## Beslutsprincip

1. Deterministiska fakta och regler räknar siffrorna.
2. Growth Brief prioriterar största signalerna med sample-confidence.
3. AI får förklara eller föreslå test; AI får aldrig vara sanningskälla för mätdata.
4. Ändring → mätning → jämförelse → nästa test.
