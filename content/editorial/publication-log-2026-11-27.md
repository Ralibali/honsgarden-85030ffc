# Publiceringslogg 27 november 2026

Guiden om att planera en säker hönsgård källgranskades på nytt mot Jordbruksverkets aktuella smittläge och beslut. Artikelinventeringen visade att senaste nya artikel publicerades 25 november och att varken sökavsikten eller sluggen redan fanns. Därmed var varannandagsregeln uppfylld.

Create-only SQL genererades av `editorial-publisher.mjs` från den validerade artikelfilen och kördes exakt via Lovables autentiserade databasanslutning efter grön CI. Databasen svarade `inserted`. En separat SELECT verifierade titel, slug, `is_published = true`, publiceringstid och innehållets SHA-256.

| URL | Publicerad | Innehållets SHA-256 |
| --- | --- | --- |
| https://honsgarden.se/blogg/honsgard-guide | 2026-11-27 07:19:25 UTC | `df959921ec7b542db1c0666f17f0de074e13af370607bc81d65318db76079598` |

Databas-ID: `232565ff-5d86-4861-a94d-4757f2037e6c`.

## Kontroller före merge

- `npm run editorial:check`: godkänd med 17 artiklar och samtliga publisher-/update-tester.
- `npm run build`: godkänd, inklusive SEO- och route-verifiering.
- GitHub Actions CI körning 881 på commit `692e7694feb8996019da58144983c10a498ba712`: godkänd.
- Jordbruksverkets aktuella sida och beslutet från 17 november kontrollerades 27 november. Högriskområdet gällde fortfarande, medan sidan angav att Sverige saknade aktuella utbrott av fågelinfluensa och restriktionszoner för sjukdomen.

## Livekontroll

Den riktiga domänen verifieras av arbetsflödet **Editorial live verification** efter merge och driftsättning. Manifestet kräver rätt HTTP-svar, rå HTML-text, H1, canonical, robots, sitemap, bildsvar, interna länkar och Chromium på desktop och mobil. Arbetsflödets gröna körning är den slutliga kontrollen av att databaspublikationen också nått honsgarden.se.

Ingen outreach skickades och inga inköp gjordes.
