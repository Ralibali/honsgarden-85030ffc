# RLS-tester (manuellt SQL-script)

Detta script verifierar att RLS-policys på de 8 farm-delade tabellerna
korrekt särskiljer rollerna **owner / editor / viewer / icke-medlem**
efter migrationen `20260513212441_*.sql`.

## Varför manuellt och inte automatiserat?

Automatiserade RLS-tester kräver en lokal Supabase-instans
(`supabase start`) eller en separat test-databas med JWT-claim-styrning.
Den uppsättningen finns inte i projektet i nuläget. Tills den gör det
fungerar detta script som en kontrollerbar "smoke + integration"-runda
som körs manuellt mot en testinstans innan vi släpper RLS-ändringar.

> ⚠️ **Kör ALDRIG mot produktion.** Scriptet skapar testanvändare och
> testdata. Det kör `BEGIN ... ROLLBACK` för att städa upp, men en
> krasch mitt i körningen kan lämna kvar rader.

## Så här kör du

```bash
psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f tests/rls/manual-rls-test.sql
```

Resultatet skrivs ut som tabellrader. Tolka enligt nedan:

- `expected_min` med `actual >= expected_min` → OK.
- `expected = 0` med `actual = 0` → OK (icke-medlem ser inget).
- `förväntat: 0 rader` på UPDATE/DELETE → kontrollera att `UPDATE 0` /
  `DELETE 0` returneras (inga rader berörda pga RLS-filter).
- `förväntat: NEKAS` med `RAISE NOTICE 'OK: ...'` → OK.
- `RAISE NOTICE 'FEL: ...'` → RLS är trasig, undersök omedelbart.

## Täckning

| Tabell                      | Owner | Editor | Viewer | Icke-medlem |
|-----------------------------|-------|--------|--------|-------------|
| hens                        | full  | full   | smoke  | smoke       |
| egg_logs                    | full  | smoke  | –      | smoke       |
| health_events               | smoke | –      | –      | smoke       |
| breeding_pairs              | –     | –      | –      | smoke       |
| hatch_sessions              | –     | –      | –      | smoke       |
| hen_photos                  | –     | –      | –      | smoke       |
| inventory_items             | –     | –      | –      | smoke       |
| inventory_transactions      | –     | –      | –      | smoke       |

`hens` är primär referens (full täckning). De övriga får smoke-test
som verifierar att Eve (icke-medlem) inte ser något — vilket är den
viktigaste säkerhetsregeln.

## När detta automatiseras

Lägg upp `supabase start` i CI med en separat job (kallad `rls`) som:

1. Startar lokal Supabase
2. Applicerar alla migrationer
3. Kör `tsx tests/rls/run.ts` som anropar `signInWithPassword` per användare
4. Asserterar via `expect(...)`

Tills dess: kör manuellt vid varje migration som rör RLS.
