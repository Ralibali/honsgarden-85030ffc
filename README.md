# Hönsgården

Hönsgården är en svensk webbapp för hobbyhönsägare. Appen hjälper användare att logga ägg, hålla koll på hönor, foder, ekonomi, påminnelser, kläckning, statistik och lokal äggförsäljning.

Projektet är byggt med Vite, React, TypeScript, Tailwind CSS, shadcn/ui, Capacitor och Supabase.

## Funktioner

- Äggloggning och statistik
- Hantering av hönor, flockar och individuella profiler
- Foder, ekonomi, hälsa, avel och lager
- Påminnelser, dagliga uppgifter och kläckningsstöd
- Agda AI och personliga rapporter för Plus-användare
- Agdas äggbod med säljsidor, bokningar, kunder och QR-skyltar
- Marknadsplats, blogg och SEO-prerendring
- PWA samt iOS- och Android-stöd via Capacitor
- Supabase-baserad autentisering, datalagring och Edge Functions
- Stripe-prenumerationer

## Kom igång lokalt

Krav:

- Node.js 20 eller senare
- npm
- Ett Supabase-projekt för full funktionalitet

```sh
git clone https://github.com/Ralibali/honsgarden-85030ffc.git
cd honsgarden-85030ffc
npm ci
cp .env.example .env.local
npm run dev
```

Öppna sedan adressen som Vite visar, normalt `http://localhost:8080`.

## Miljövariabler

Skapa `.env.local` baserat på `.env.example`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

Supabase publishable/anon key är avsedd att kunna användas i frontend. Lägg aldrig service role-nycklar, Stripe-hemligheter eller andra privata nycklar i frontendkod.

Viktiga serverhemligheter för Supabase Edge Functions:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_PRICE_MONTHLY=
STRIPE_PRICE_YEARLY=
STRIPE_WEBHOOK_SECRET=
LOVABLE_API_KEY=
CRON_SECRET=
APP_ALLOWED_ORIGINS=https://honsgarden.se,https://www.honsgarden.se
```

Checkout avbryts med konfigurationsfel om de aktuella Stripe-priserna saknas. Gamla priser används aldrig som fallback för nya köp.

## Scripts

```sh
npm run dev          # Startar utvecklingsserver
npm run build        # Bygger appen och prerenderar blogg/SEO-sidor
npm run build:dev    # Bygger i development mode
npm run lint         # Kör ESLint
npm test             # Kör tester med Vitest
npx tsc -b           # TypeScript-kontroll
npm run preview      # Förhandsgranskar produktionsbuilden
```

## Säkerhetsprinciper

- Autentiserade Supabase REST-svar cachelagras aldrig i service workern.
- Privat klientcache rensas vid utloggning och kontobyte.
- Plus-funktioner måste verifiera prenumerationen i backend, inte bara i React.
- AI-funktioner har både rate limits, inputgränser och månadskvoter.
- RLS är den primära dataseparationen och ska verifieras med riktiga assertions mot en isolerad testdatabas.
- Marknadsföringssamtycke är separat och frivilligt.

## SEO och prerendering

Byggsteget kör `vite build` och därefter `scripts/prerender-blog-posts.mjs`. Scriptet hämtar publicerade bloggartiklar från Supabase och genererar statiska sidor, metadata, canonical-länkar och sitemap.

## CI

GitHub Actions kör vid push till `main` och pull requests:

1. `npm ci`
2. `npm run lint`
3. `npx tsc -b --pretty false`
4. `npm test`
5. `npm run build`

RLS-testet kan köras via `workflow_dispatch` med `run_rls=true`. Det kräver `TEST_DB_URL` till en isolerad testdatabas och misslyckas uttryckligen om hemligheten saknas.

## Deployment

Projektet kan publiceras via Lovable eller annan statisk hosting som stödjer Vite-buildar. Kontrollera alltid att frontendvariabler, Stripe-priser, webhookhemlighet och serverhemligheter finns i produktionsmiljön före publicering.
