# Hönsgården: SEO och innehåll

Dessa riktlinjer kompletterar projektets befintliga utvecklings- och analysdokument.

- Utgå från aktuell kod, publicerad sida och daterad projektbrief i `docs/SEO_PILOT.md`. Skilj observationer från hypoteser och okända data.
- Förbättra relevanta befintliga sidor före nyproduktion. Använd sökfråga + sida från Search Console när åtkomst finns. Gissa inte trafik, sökvolym eller kundresultat.
- Granska sökintention, innehåll, titel, internlänkar och nästa användarhandling tillsammans. Lova inte ranking eller viss tid till effekt.
- Publik blogg renderas både i `src/pages/GuideArticle.tsx` och `scripts/prerender-blog-posts.mjs`. Innehållstillägg och länkar ska vara konsekventa i båda. Använd delad data/rendering där möjligt.
- Nya råd om djurhälsa, utfodring och regler behöver relevant källgranskning. Fabricera inte egna erfarenheter, omdömen eller produktfunktioner. Märk demo som exempeldata.
- Vid kortvideo: använd en granskad idé, tre öppningar, verklig produktdemo och en relevant målsida. Använd egna eller licensierade tillgångar; inga kopierade personer eller syntetiska kundomdömen.
- Följ befintligt analytics-kontrakt i `docs/ANALYTICS.md`. Händelser och produktresultat är inte tillgängliga bara för att instrumenteringen finns i kod.
- Dokumentera före/efter, berörda URL:er, tester och återställning. Kontrollera HTML före JavaScript och klientvy när publikt innehåll ändras. Kör typkontroll, relevanta tester, lint och produktionsbygge.
- Behåll pris-, auth- och betalningslogik utanför rena innehållsuppgifter. Samordna med öppna ändringar innan samma filer redigeras.
