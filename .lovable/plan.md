
Det här är ett stort paket (4 delar, ny edge function, ny tabell + RLS, admin-UI, refactor av `sync-soro-blog` och `GuideArticle`, ny "Rekommenderade produkter"-komponent, jämförelsetabell, utökad affiliate-analys). Jag vill dubbelkolla scope och prioritering innan jag börjar skriva kod, för att inte överkonsumera credits eller köra över nyare GitHub-ändringar.

## Vad jag bygger

### DEL A — Firecrawl Lead Research (admin)
- **DB:** ny tabell `public.sales_leads` (fält enligt spec) + RLS så bara `has_role(auth.uid(),'admin')` kan läsa/skriva. Unik constraint på `(lower(website_domain), lower(public_email))` för dedupe. Grants för `authenticated` + `service_role`.
- **Edge Function:** `supabase/functions/firecrawl-lead-search/index.ts`
  - `verify_jwt = false` i config.toml, validerar JWT + admin-roll i kod
  - Läser `FIRECRAWL_API_KEY` från env, 500 med tydligt "FIRECRAWL_API_KEY saknas" om ej satt
  - POST `https://api.firecrawl.dev/v2/search` med `sources:["web"]`, `country:"SE"`, limit ≤ 20
  - Bygger sökfraser från `{type, city}` (5 mallar enligt spec)
  - Extraherar publik e-post/telefon via regex enbart från title/description/scrape-content som Firecrawl returnerar (ingen gissning)
  - Normaliserar domän, dedupe mot befintliga leads
  - Returnerar preview-array; sparar INTE automatiskt — admin väljer och sparar
- **UI:** ny flik "Leads" i `src/pages/Admin.tsx` (`AdminLeadsPanel.tsx`) med sökformulär, resultatlista, checkbox-spara, statusflöde, CSV-export, do-not-contact-toggle, integritetsnotis.

### DEL B — Affiliate Pass 1 (Soro + GuideArticle)
- `sync-soro-blog`: efter upsert, hämta `link_glossary` (aktiva), matcha term/regex mot `title+excerpt+content`, välj 3–6 med prioritet för längre fraser, mergea med ev. befintliga manuella `glossary_ids`.
- `GuideArticle.tsx` + `AffiliateProductBox`: skicka hela `content` för matchning, tracking på klick i intro + resten, disclosure-rad nära metadata, säkerställ `rel="sponsored noopener noreferrer"`.

### DEL C — Affiliate Pass 2 (Rekommenderade produkter)
- Ny `RecommendedProducts.tsx` (upp till 3 kort med labels "Bäst totalt / Mest prisvärd / Premiumval")
- Ny `ProductComparisonTable.tsx` (mobilvänlig)
- Ny `src/lib/buyIntent.ts` — score på titel/slug/kategori/tags/nyckelord
- Rendera bara när `buyIntentScore ≥ threshold` OCH ≥ 2 matchande produkter; aldrig på hälso-/medicinsk kategori
- Max en större rekommendationssektion per artikel

### DEL D — Affiliate Pass 3 (Analytics)
- Migration: lägg till `'comparison'` som tillåtet värde för `affiliate_clicks.source` (om CHECK finns) + `affiliate_impressions.source`
- Ny edge function eller utöka `admin-revenue`-liknande: `admin-affiliate-analytics` som joinar `page_views` + `affiliate_impressions` + `affiliate_clicks` per `slug`, filter 7/30/90d
- UI-panel i Admin: tabell per artikel (views/impressions/clicks/CTR/top produkt/top advertiser), lista "hög trafik låg CTR", filterknappar 7/30/90

### Verifiering
- Vitest för buyIntent + soro glossary-matching + lead-normalisering/dedupe
- `npm test && npm run build`
- Deploy: `firecrawl-lead-search`, `sync-soro-blog`, `admin-affiliate-analytics`
- Uppdatera `.env.example` + README med `FIRECRAWL_API_KEY` (dokumentation, inte värde)
- Publicera frontend efter grön build

## Frågor innan jag drar igång

Det här är ~3–5h agentarbete och ett tydligt "big bang"-release. Innan jag börjar:

1. **Prioritering om jag bara hinner delar** — vill du att jag kör i ordning A → B → C → D och stannar om något går fel, eller att jag levererar allt eller inget?
2. **FIRECRAWL_API_KEY** — är den redan satt som secret? Jag kan inte se secret-värden, men om den saknas behöver du lägga in den i Project Settings → Secrets innan Del A fungerar. Ska jag bygga Del A ändå (med tydligt konfigurationsfel i UI:t när nyckeln saknas)?
3. **Firecrawl-kostnad** — v2 search + scrape drar credits per sökning (upp till 20 resultat × ev. scrape för kontaktextraktion). OK att jag defaultar till `sources:["web"]` UTAN att scrape-hämta varje träff (extraherar bara från search-metadata)? Det gör kontaktdata glesare men billigare. Alternativ: scrape top-N (dyrare, bättre data).
4. **Comparison-table som ny tracking source** — `affiliate_clicks.source` är enum/text i din DB. Jag kollar och migrerar bara om det behövs — OK?
5. **"Publicera senaste frontend"** — ska jag köra `publish` automatiskt efter grön build, eller vill du review:a först?

Bekräfta så kör jag. Om du vill ändra scope (t.ex. hoppa Del C eller D nu) — säg till, så minskar jag omfattning och kostnad.
