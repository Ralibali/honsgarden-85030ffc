
# Plan: honsgarden.app — full internationalisering

## Verklighet och omfattning

Kodbasen har **318 TypeScript-filer**, **60+ sidor** och **140+ komponenter**, plus 40+ edge functions och e-postmallar — i princip allt med svenska strängar inbäddade direkt i JSX. En komplett, naturlig amerikansk översättning av varje knapp, dialog, toast, felmeddelande, tom-läge, formulärfält, e-postmall, metabeskrivning och OG-tagg är **inte en enskild leverans** — det är 8–12 fokuserade arbetspass. Försöker jag göra allt i ett svep blir kvaliteten dålig, jag missar strängar, och risken att förstöra `.se` ökar.

Förslag: jag bygger leveranserna nedan i ordning, en per turn (eller flera om du säger till). Allt domängatas så `honsgarden.se` är **exakt oförändrad** hela vägen. Inget mergas till main av mig — du publicerar när du vill.

## Förutsättningar redan på plats (från tidigare turn)

- `src/lib/brand.ts` — `detectBrandRegion()`, `isInternationalDomain()` (.se = locked SV, allt annat = intl)
- `src/i18n/index.ts` — i18next + react-i18next, domängatat (på .se: tvingad sv, ingen detector, ingen cache)
- `profiles`-tabellen har `country_code`, `language_code`, `locale`, `timezone`, `currency_code`, `measurement_system`, `temperature_unit`, `postal_code` (defaults = svenska — befintliga .se-användare oförändrade)
- `src/lib/datetime.ts` (timezone-säker `todayInTz`, `localCalendarDate`), `src/lib/format.ts`, `src/lib/countries.ts`, `src/lib/postalCode.ts`
- `CountrySelect`, `RegionLanguageSettings`, Login med villkorad landväljare på intl
- Bundles `sv`/`en` för: `common`, `auth`, `nav`, `settings`, `errors`, `premium`
- 22 vitest-tester (DST, postnummer, defaults) — gröna

## Leverans 1 — USA som standard på honsgarden.app + tidszondetektering (denna turn om du godkänner)

1. **Browser-tidszon vid registrering**: läs `Intl.DateTimeFormat().resolvedOptions().timeZone` i `Login.tsx`, spara i `auth.signUp` metadata → `handle_new_user` skriver `profiles.timezone`. Faller tillbaka till landets standardzon endast om läsningen misslyckas.
2. **Default-land = United States på .app**: `defaultCountryForRegion()` → SE på .se, US på .app/preview. Plockas upp av `CountrySelect`.
3. **Migrering**: backfill `profiles.timezone` där `NULL` → `Europe/Stockholm` (säker för befintliga svenska användare); inga andra ändringar.
4. **Imperial/Fahrenheit/USD som default när country = US** — redan stött i `format.ts`, jag verifierar formatters i `Eggs`, `Health`, `Weather`, `Finance`.
5. **Ersätt UTC-baserad "dagens datum"-användning** (`new Date().toISOString().split('T')[0]`) med `todayInTz(profile.timezone)` i alla dagsberoende vyer: Dashboard, Eggs, DailyTasks, Reminders, Health, Statistics, WeeklyReport, Streaks, hatch dates. ~15–20 filer.
6. SEO: `hreflang` (sv-SE ↔ en-US) + per-route canonical via `react-helmet-async` på publika sidor (landning, blogg, guider, SaljaAgg).
7. `robots.txt` + `sitemap.xml` får båda domänernas URLer; PWA `manifest.webmanifest` per domän (namn/short_name skiljer sig).

## Leverans 2 — Översättning av publika ytor på .app

- Landningssida (`IndexUpdated.tsx`), `About`, `Guides`, `GuideArticle`, `News`, `Login`, `ResetPassword`, `Premium`, `Terms`, `NotFound`, `Footer`, `AppSidebar`, navigation, sidtitlar, meta, OG.
- Allt via `useTranslation()` med nya namespaces (`landing`, `marketing`, `legal`).
- Dev-warning: ingen sv-fallback på .app — saknad nyckel loggas + visar nyckeln (utvecklarläge) eller neutral engelsk default (produktion).

## Leverans 3 — Översättning av inloggad core-app

- Dashboard (V2), Eggs, Hens, HenProfile, DailyTasks, Reminders, Health, Feed, Inventory, Settings.
- Egna namespaces per domän (`dashboard`, `eggs`, `hens`, `health`, `feed`, `inventory`, `tasks`).

## Leverans 4 — Översättning av sekundära ytor

- Finance, Statistics, Reports, WeeklyReport, SmartFarmReport, Hatching, Breeding, SeasonalCalendar, Weather, Import, Backup, Feedback.

## Leverans 5 — Community, marknadsplats, äggförsäljning, Agda

- Community, Marketplace*, EggSales*, PublicEggSale, OrderPortal, Agda.
- Dessa har mest hårdkodad text. Många tomma lägen och toasts.

## Leverans 6 — Stripe USD + checkout-mapping

- Skapa Stripe-produkter: `$2.99/mo`, `$24.99/yr` (7-day trial) — `stripe--create_stripe_product_and_price`.
- Tabell `stripe_price_map (country_code, plan, currency, price_id)` — backend väljer Price ID utifrån användarens `country_code`. Klienten skickar **plan + period**, aldrig price_id.
- `create-checkout` edge function uppdateras: läs profilens land/valuta, slå upp price_id, validera vitlista.
- `Premium.tsx` visar pris/valuta efter region; "Best value" + "7-day free trial" på .app.
- Success/cancel URLs sätts utifrån `window.location.origin` (fungerar för båda domänerna).

## Leverans 7 — E-post & auth-mallar

- Lokalisera `auth-email-hook` mallar (signup/recovery/magic-link/invite) — välj språk utifrån `user.user_metadata.language_code`.
- Lokalisera transactional templates (`welcome`, `weekly-report`, `feedback-reply`, digests) på samma sätt.
- Supabase **Site URL + Redirect URLs** måste uppdateras manuellt i dashboarden (jag listar exakt vilka), eftersom Lovable Cloud inte exponerar det via verktyg.

## Leverans 8 — QA, lint, build, tester

- Vitest-svit utökad med renderingstester per språk.
- Playwright-smoke: `.se` → svenska, `.app` (simulerad) → engelska, samma konto fungerar.
- Saknade nycklar listas.
- Slutrapport med exakt vad som översatts, vad som återstår, manuella steg.

## Manuella steg (inte automatiserbara av mig)

- Lägg till `honsgarden.app` som custom domain i Lovable.
- Supabase: Site URL = `https://honsgarden.app`, Additional Redirect URLs = båda domänernas `/auth/callback`, `/reset-password`.
- Stripe: bekräfta att de nya USD-priserna ser rätt ut, koppla webhooks (samma endpoint).
- DNS för honsgarden.app (A 185.158.133.1 + www + _lovable TXT).

## Frågor innan jag startar Leverans 1

1. **OK att jag kör en migration som backfillar `profiles.timezone = 'Europe/Stockholm'` för rader där den är NULL?** (Säkert för alla befintliga .se-användare; nya .app-användare får browserns IANA-zon.)
2. **Vill du att jag fortsätter rakt igenom Leverans 1 → 8 i följande turns**, eller vill du godkänna varje leverans innan nästa startar? (Jag rekommenderar godkännande per leverans, så du kan testa `.se` är oförändrat mellan varje.)
3. **Stripe USD-priser ($2.99/mo, $24.99/yr, 7d trial)** — ska jag skapa produkterna i Stripe åt dig i Leverans 6, eller skapar du dem manuellt och ger mig Price IDs?
