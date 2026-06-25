## Mål

Göra Hönsgården internationell utan att förstöra befintlig funktion. Samma kodbas, samma backend, två domäner: `honsgarden.se` (Hönsgården, sv-fallback) och `honsgarden.app` (Honsgarden, en-fallback). Befintliga svenska användare ska inte påverkas.

Eftersom detta är ett mycket stort uppdrag (i18n, region, datum/tid, Stripe-priser, postnummer, domäner, marknadsplats-flags, tester) föreslår jag att vi kör i **6 leveranser** i samma branch. Då blir varje migration/PR-bit granskbar och ingenting bryts på en gång.

---

### Leverans 1 – Datalager för region (grund)

**Migration (idempotent):**
- Lägg till kolumner på `profiles`: `country_code text`, `language_code text`, `locale text`, `timezone text`, `currency_code text`, `measurement_system text` (`metric|imperial`), `temperature_unit text` (`C|F`), `postal_code text`.
- Backfill: alla rader utan `country_code` → `SE / sv / sv-SE / Europe/Stockholm / SEK / metric / C`.
- Uppdatera `handle_new_user` så defaults sätts vid registrering om metadata saknas.
- Regenerera Supabase-typer.

Inga befintliga värden skrivs över. RLS oförändrad.

---

### Leverans 2 – i18n-infrastruktur + språkväxlare

- Installera `i18next`, `react-i18next`, `i18next-browser-languagedetector`.
- `src/i18n/index.ts` initierar med `sv` och `en`, fallback per domän (`honsgarden.se` → sv, övriga → en).
- Filstruktur: `src/i18n/locales/{sv,en}/{common,auth,onboarding,nav,dashboard,eggs,hens,health,feed,hatching,stats,premium,settings,errors,empty,toast}.json`.
- Inkrementell migrering: vi flyttar hårdkodade strängar i kärnflödena (lista i punkt 3 i din brief) – inget annat rörs i denna leverans.
- Språkväxlare i Inställningar. Aktivt språk = `profiles.language_code` om satt, annars detektion, annars domän-fallback. Ett språk får bara väljas om bundle är komplett (vakt på listan över "stödda aktiverade språk").

---

### Leverans 3 – Tidszon, datum & formatering

- `src/lib/datetime.ts`: `todayInTz(tz)`, `localCalendarDate(date, tz)`, `formatDate/Time(date, locale, tz)`.
- `src/lib/format.ts`: `formatCurrency`, `formatTemperature`, `formatWeight`, `formatVolume`, `formatDistance`. Grunddata lagras alltid i SI (gram, ml, km, °C, minor currency unit). Konvertering endast vid visning.
- Ersätt alla `new Date().toISOString().split('T')[0]` i användarflöden (ägg, hälsa, dagliga uppgifter, streaks, kläckning) med `todayInTz(userTz)`.
- Webbläsarens `Intl.DateTimeFormat().resolvedOptions().timeZone` används i första hand; landets default endast som fallback.
- Vitest-tester för: Stockholm, London, New York, Los Angeles, Sydney, Auckland – inkl. DST runt midnatt.

---

### Leverans 4 – Registrering, land & postnummer

- Landsväljare i sign-up: sökbar Combobox (shadcn), flagga + namn, mobilvänlig. Default sätts via lättviktig IP-geo (Edge function `geo-country` som läser `cf-ipcountry`/`x-vercel-ip-country`/`x-forwarded-for` + faller tillbaka till `Intl.Locale`).
- Land = endast förslag på defaults; alla regionala fält kan ändras separat.
- Aktiverade länder: SE, NO, DK, FI, GB, US, CA, AU, NZ, DE, NL.
- `src/lib/postalCode.ts`: per-lands regex, postnummer är **valfritt**. Tar bort tidigare 4–5-siffrors svensk hårdkodning.
- Inställningssida får sektion **Region och språk** med fälten: Land, Språk, Tidszon, Valuta, Temperatur, Måttenheter, Postnummer + förklarande hjälptext och bekräftelse-dialog innan landbyte skriver över manuellt ändrade fält.

---

### Leverans 5 – Stripe regionala priser & domäner

- Ny tabell `stripe_price_map(plan text, region text, stripe_price_id text, currency text, amount_minor int, interval text)` med GRANT + RLS (read = authenticated, write = service_role).
- Edge function `create-checkout` ändras: klient skickar **endast** `{ plan: 'monthly'|'yearly', region: country_code }`. Servern slår upp tillåtet Stripe Price ID. Inga price-id:n från klienten.
- Visa priser i lokal valuta på `/premium` (årsalt först + "bäst värde"). Sverige oförändrat: 19/149 SEK + 7 dagars trial.
- Rekommenderade priser per land enligt din brief – dessa måste skapas manuellt i Stripe Dashboard; jag levererar SQL för att fylla `stripe_price_map` när du gett mig Price IDs.
- Domänkonfig: dokumentera och uppdatera `redirect_to` i auth-mejl, reset-password, Stripe success/cancel URL till `window.location.origin` (fungerar för båda domäner). hreflang + canonical i `index.html`/SEO-komponenten. Sitemap genereras per domän.

---

### Leverans 6 – Marknadsplats-flag, tester, lint/build

- Feature flag `marketplaceEnabledFor(countryCode)` → just nu `['SE']`. Agdas Bod, Swish-UI och säljflöden döljs utanför SE.
- Vitest:
  - Sverige förvalt vid sign-up.
  - Defaults per land (US → en/USD/F/imperial, GB → en/GBP/C/metric, AU → en/AUD/C/metric, SE → sv/SEK/C/metric).
  - Datum kring midnatt hamnar på rätt lokal kalenderdag i alla testade tz.
  - Postnummer accepterar SE/UK/US/CA/NL/DE-format.
  - `create-checkout` mappar plan+region → korrekt Stripe Price ID server-side.
  - Äldre profil utan land → SE; profil med land skrivs aldrig över.
- Fixa `package-lock.json`-driften: regenerera lockfilen, säkerställ `npm ci` grönt.
- Kör `tsgo`, `eslint`, `vitest`, `vite build`.

---

### Tekniska detaljer

- Behåller befintlig arkitektur (React/Vite + Supabase + Tailwind + shadcn). Ingen ny stack.
- Inga V2/V3-kopior – jag editerar befintliga `Login`, `Premium`, `Settings`, `AuthForm`, `create-checkout`, `Dashboard` etc.
- Varumärke: en konstant `BRAND_NAME` per domän (`Hönsgården` på `.se`, `Honsgarden` annars) – exponeras via i18n + `<title>`/OG.
- Säkerhet: inga hemliga nycklar i frontend; servern validerar plan/region → price id; RLS bibehålls; inga ändringar i `auth`/`storage`/`realtime`-scheman.
- Befintlig branch `product/swedish-leader-global-plan` – jag återanvänder det som finns där där det är korrekt, ersätter inte fungerande kod.

---

### Det här gör jag inte i denna omgång (om du inte säger till)

- Översättningar till no/da/fi/de/nl (infrastrukturen är klar; bundles aktiveras när texter finns).
- Marknadsplats för andra länder (flaggad av).
- Automatisk merge till `main`.

---

### Frågor jag behöver svar på innan Leverans 5

1. Har du redan skapat regionala Stripe Price IDs, eller ska jag bara förbereda mappningstabellen och du fyller i ID:n efteråt?
2. Vill du att jag aktiverar IP-geo via en egen Edge function nu, eller räcker det med `Intl.Locale` + manuellt val i v1?

Säg till om du vill att jag kör hela planen, eller bara startar med Leverans 1–3 först.