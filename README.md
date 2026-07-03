Sync-test 2026-07-03

# Hönsgården

Hönsgården är en svensk webbapp för hobbyhönsägare. Appen hjälper användare att logga ägg, hålla koll på hönor, foder, ekonomi, påminnelser, kläckning, statistik och säsongsrelaterade uppgifter.

Projektet är byggt med Vite, React, TypeScript, Tailwind CSS, shadcn/ui och Supabase.

## Funktioner

- Äggloggning och statistik
- Hantering av hönor och individuella profiler
- Foder-, ekonomi- och översiktsvyer
- Påminnelser, dagliga uppgifter och kläckningsstöd
- Blogg/guider med prerendering för bättre SEO
- PWA-stöd med offlinevänlig installation
- Supabase-baserad autentisering och datalagring

## Kom igång lokalt

Krav:

- Node.js 20 eller senare
- npm
- Ett Supabase-projekt för full funktionalitet

```sh
git clone https://github.com/Ralibali/honsgarden-02faf39f.git
cd honsgarden-02faf39f
npm ci
cp .env.example .env.local
npm run dev
```

Öppna sedan den lokala adressen som Vite visar i terminalen, vanligtvis `http://localhost:8080`.

## Miljövariabler

Skapa en `.env.local` baserad på `.env.example`.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

Obs: Supabase publishable/anon key är avsedd att kunna användas i frontend. Lägg däremot aldrig service role keys eller andra hemligheter i frontendkod eller publika filer.

## Scripts

```sh
npm run dev          # Startar utvecklingsserver
npm run build        # Bygger appen och prerenderar blogg/SEO-sidor
npm run build:dev    # Bygger i development mode
npm run lint         # Kör ESLint
npm test             # Kör tester med Vitest
npm run preview      # Förhandsgranskar produktionsbuilden lokalt
```

## SEO och prerendering

Byggsteget kör först `vite build` och därefter `scripts/prerender-blog-posts.mjs`. Scriptet hämtar publicerade bloggartiklar från Supabase, genererar statiska bloggsidor, metadata, canonical-länkar och sitemap.

## CI

Repot innehåller en GitHub Actions-workflow som kör automatiska kontroller vid push och pull requests:

1. `npm ci`
2. `npm run lint`
3. `npm test -- --passWithNoTests`
4. `npm run build`

För bäst resultat i GitHub Actions bör följande secrets finnas i repot:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

## Rekommenderade nästa förbättringar

- Aktivera striktare TypeScript stegvis.
- Lägg till tester för auth, routing och viktiga formulär.
- Säkerställ att analytics bara körs efter relevant cookie-/integritetssamtycke.
- Flytta hårdkodade Supabase-fallbacks ur build-konfigurationen.
- Lägg till felrapportering i produktion, till exempel Sentry eller Supabase logging.
- Gå igenom PWA-cache så inloggade appvyer inte riskerar att cachelagras fel.

## Deployment

Projektet kan publiceras via Lovable eller annan statisk hosting som stödjer Vite-buildar. Kontrollera att miljövariablerna ovan finns i produktionsmiljön innan publicering.
