# Rotera CRON_SECRET

`CRON_SECRET` är den delade hemligheten mellan pg_cron och de edge functions som bara ska köras på schema. Den skickas i rubriken `x-cron-secret`.

Byt värdet när det kan ha hamnat utanför vault och funktionshemligheterna, till exempel i ett kommando, en logg eller en fil. Ett värde som en gång har checkats in går inte att ta tillbaka genom att ändra filen, eftersom det finns kvar i git-historiken. Det enda som hjälper är att byta det. När det är gjort är det gamla värdet ofarligt.

## Innan du byter

Ett jobb som har det gamla värdet inskrivet i sitt kommando slutar fungera i samma stund som du byter. Migrationen `20261110111000_cron_secret_from_vault.sql` skriver därför om sådana jobb så att de hämtar värdet ur vault vid varje körning. Den gör det bara när resultatet bevisligen blir samma anrop som förut, och lämnar allt annat orört.

Kontrollera läget:

```sql
select * from public.cron_auth_overview();
```

| `auth` | Betyder | Vid byte |
| --- | --- | --- |
| `vault (hjälpfunktion)` | Jobbet anropar `public.invoke_cron_function()` | Följer med automatiskt |
| `vault` | Jobbet läser `CRON_SECRET` ur vault i sitt eget kommando | Följer med automatiskt |
| `KLARTEXT` | Värdet står inskrivet i kommandot | **Slutar fungera.** Åtgärda först, se nedan |
| `annan (ingen cron-hemlighet)` | Jobbet skickar ingen cron-hemlighet | Påverkas inte |
| `anropar ingen funktion` | Ren SQL | Påverkas inte |

Byt inte förrän ingen rad visar `KLARTEXT`.

### Om en rad visar KLARTEXT

Migrationen lämnade jobbet orört av något av de här skälen: vault innehöll redan ett annat värde än jobbet, jobben hade olika värden sinsemellan, eller kommandot gick inte att tolka (flera anrop, annan adress). Skriv om jobbet för hand:

```sql
select cron.alter_job(
  (select jobid from cron.job where jobname = '<jobbets namn>'),
  command := $$select public.invoke_cron_function('<funktionens namn>');$$
);
```

`invoke_cron_function` tar även en body och en timeout i millisekunder: `invoke_cron_function('sync-affiliate-feed', '{}'::jsonb, 120000)`.

## Byt värdet

1. Skapa ett nytt slumpvärde, minst 32 tecken. Till exempel `openssl rand -hex 32`.
2. Uppdatera vault:

   ```sql
   select vault.update_secret(
     (select id from vault.secrets where name = 'CRON_SECRET'),
     '<nytt värde>'
   );
   ```

   Finns ingen rad med det namnet: `select vault.create_secret('<nytt värde>', 'CRON_SECRET');`
3. Sätt samma värde som funktionshemligheten `CRON_SECRET` (Lovable: Project Settings, Secrets).

Gör steg 2 och 3 direkt efter varandra. Under tiden däremellan får jobb som råkar köras ett 401.

## Kontrollera efteråt

Kör ett jobb som är ofarligt att köra en extra gång och läs svaret:

```sql
select public.invoke_cron_function('sync-soro-blog');
-- vänta några sekunder
select status_code, created from net._http_response order by created desc limit 1;
```

`200` betyder att vault och funktionshemligheten stämmer överens. `401` betyder att de skiljer sig åt.

## Vilka funktioner gäller det

Alla funktioner som pg_cron anropar godkänner `x-cron-secret`. `premium-expiry-cron` och `subscription-health-check` godkände tidigare även en osignerad JWT med rätt projekt-id. Det är borttaget: de godkänner nu bara `x-cron-secret` eller service role-nyckeln, se `supabase/functions/_shared/cronAuth.ts`.
