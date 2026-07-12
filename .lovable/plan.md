# UX-polering: Hönsgården 10/10

Rent presentations- och interaktionsarbete. Ingen ny funktionalitet, inga databasmigrationer, inga ändringar i RLS, Edge Function-auth, Stripe-priser (39/299) eller cachefixar. Allt sker i `src/components/*`, `src/pages/*`, `src/index.css` och Tailwind-config.

## Mål

Att appen känns snabb, lugn och självklar på mobil – att en ny användare förstår vad hen ska göra på 3 sekunder, och att en återkommande användare loggar dagens ägg på under 5.

## Pass 1 – Visuell grundton (design tokens)

- Rensa `src/index.css`: säkerställ att alla ytor använder semantiska tokens (`--background`, `--foreground`, `--primary`, `--muted-foreground`). Ta bort ströade `text-gray-*` / `bg-white` i komponenter jag stöter på under passet.
- Höj kontrast på sekundär text (byt `text-muted-foreground/60` → `text-muted-foreground` där det bryter WCAG AA).
- Standardisera radius, skuggor och kortpadding via tokens – inga hårdkodade `rounded-[14px]` kvar i vanliga kort.
- Rulla ut befintlig typografi (Young Serif rubriker, Inter brödtext) konsekvent på Dashboard, Eggs, Hens, Marketplace, PublicEggSaleV3, SaljaAggOrt.

## Pass 2 – Mobil-först layout

- `DashboardV2`: minska vertikal brus. En tydlig H1, en primär CTA ("Logga ägg"), kalender + Dagens tips ovanför sekundära kort. FAB `size="icon"` bumpas till `min-h-11 min-w-11`.
- `Eggs`, `Hens`, `Marketplace`, `MarketplaceMap`: sticky filterrad blir kompaktare på mobil, listkort får enhetlig höjd och tydlig primärhandling.
- Byt kvarvarande `h-screen` → `h-dvh` i fullhöjdssidor så iOS Safari-adressfältet inte kapar innehåll.
- Säkerställ ett enda `<main>` per route i `AppLayout`; ta bort dubletter i undersidor.

## Pass 3 – Tillgänglighet & mikrointeraktion

- Icon-only knappar (kalender-navigering, stäng, favorit, dela) får `aria-label`.
- Focus-visible ring på alla interaktiva element via shadcn-varianten – inga custom outlines.
- Loading/empty states: byt spinnrar mot skeletons på Dashboard-kort, Hens-lista, Marketplace-lista, Egg-logg. Empty states får en mening + en knapp.
- Toasts kortas: en rad, en primär åtgärd. Inga dubbla success-toasts vid samma händelse.
- Respektera `prefers-reduced-motion` för konfetti och kort-transitions (kroken finns redan i `useReducedMotion`).

## Pass 4 – Copy & förenkling

- Kortare rubriker på Dashboard-kort ("Dagens tips", "Denna vecka", "Din flock"). Ta bort dubbla beskrivningar.
- Onboarding-checklistan: max 4 steg synliga, resten under "Visa fler". Behåll all logik.
- Premium-sidan: behåll priserna 39/299 exakt, men rensa punktlistorna till 5 rader per plan och en enda primär CTA.
- Publika säljsidor (`PublicEggSaleV3`, `SaljaAggOrt`, `MarketplaceMap`): ovanför-vecket = titel, pris, "Boka" – resten scrollas fram.

## Utanför scope

- Inga schemaändringar, inga nya tabeller, inga nya Edge Functions.
- Inga ändringar i `supabase/config.toml`, `supabase/functions/*`, `src/integrations/supabase/*`, `src/lib/api.ts` eller prissättningslogiken.
- Inga nya beroenden.
- Ingen refaktor av `useMarketplace`, auth, offline-kön eller PWA-service worker.

## Verifiering per pass

- Bygget körs automatiskt efter varje edit-batch; jag åtgärdar typfel direkt.
- Efter pass 2 och 3: Playwright-screenshot av Dashboard och Marketplace i 390×844 (iPhone 14) för visuell kontroll.
- Ingen ändring rörs som skulle kunna påverka senaste säkerhetsscanningens fynd; jag kör inte om scannern (den är oförändrad relevant).

## Leverans

Fyra sekventiella pass, ett i taget, med kort avstämning mellan varje så du kan justera riktning innan nästa startar. Säg **"kör pass 1"** så börjar jag.
