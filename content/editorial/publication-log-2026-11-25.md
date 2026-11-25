# Publiceringslogg 25 november 2026

Fem tidigare förberedda uppdateringar källgranskades, rättades och publicerades genom `editorial-update.mjs`. Den nya fågelinfluensaartikeln skapades genom `editorial-publisher.mjs`. SQL genererades i CI på commit `8a6151e6ede2675285d41add542a1386a36da856` och kördes exakt via Lovables autentiserade databasanslutning. Databasresultaten verifierades med separat SELECT. De äldre artiklarnas publiceringsdatum bevarades.

| URL | Innehållets SHA-256 |
| --- | --- |
| https://honsgarden.se/blogg/fagelinfluensa-sverige-2026 | `c7a87b8f1fcbd7de30c5130e2fb6562a2b91c2da0acb011f8da182ccdee983b3` |
| https://honsgarden.se/blogg/klacka-agg | `b78d172ebf4a73359d0fc23589f8e17ab9d5ea13a68aa45c1d218483e73c7101` |
| https://honsgarden.se/blogg/sittpinnar-hons | `d284d0630d5e8818fd26d78355c2641774db1ef89ffae38681448a91e5591176` |
| https://honsgarden.se/blogg/varmelampa-hons | `ad428c1955b76975ac09b154e57d43044ffc02e884711bab3c831e42f17bf12c` |
| https://honsgarden.se/blogg/varprede-hons | `d12406aa857ae594a8ab974e99f9f91695ce228d68bcdd9749da588d7f5068df` |
| https://honsgarden.se/blogg/vattenautomat-hons | `fda43062bfaba2422acc372f9ea8453014da5b04fe66d20f4627f6610c78340c` |

Databasskrivningar: 2026-11-25 16:46:12–16:46:24 UTC. Originalartikelns publiceringsdatum är förberedelsens tid 16:41:53 UTC samma dag. Nästa nya artikel får publiceras tidigast 27 november enligt varannandagsregeln.

## Kontroller

CI på ovanstående commit godkändes: lint, typecheck, 1 337 tester i 166 testfiler, bygg, URL/indexhygien, prestandabudget och redaktionella validatorer. Billing-/databasbehörighetstester godkändes; separat RLS-jobb hoppades över enligt arbetsflödets villkor.

Kontrollen av den riktiga domänen görs separat efter merge och driftsättning av arbetsflödet **Editorial live verification**. Resultatet och webbläsarbilder finns i dess körning och artefakt, inte i databasbekräftelsen. Körningen kontrollerar rå HTML, H1, canonical, robots, sitemap, bildsvar, interna länkar och permanent omdirigering samt Chromium på desktop och mobil. Ett grönt databasresultat bevisar inte driftsättning.

## Återstående

- `honsgard-guide` ligger källgranskad i kön för nästa tillåtna publiceringsdag. Smittläget ska kontrolleras på nytt då.
- Search Console-anslutning saknas i denna session: ingen indexeringsbegäran skickades och organisk effekt har inte mätts.
- Ingen outreach skickades.
