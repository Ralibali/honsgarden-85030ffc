# Egen redaktion och publicering

ChatGPT (eller Claude) skriver och källkontrollerar nya svenska artiklar; fältet author anger vem. Grundtakt: högst en ny artikel per sajt varannan dag. En enda återkommande redaktionell uppgift samordnar de tre befintliga sajterna. Ingen extra Grok-bot och ingen extern betald modellnyckel krävs för denna arbetsväg.

## Före varje artikel

Läs aktuellt main, denna instruktion, konfigurationen och hela artikelinventeringen i sajten. Jämför sökintentioner, inte bara rubriker. Prioritera frågor som hjälper rätt besökare att använda den befintliga produkten eller välja relevant utrustning. Skriv originaltext med en användbar mall, checklista eller tydligt arbetsflöde. Hitta inte på erfarenhet, tester, försäljning, ranking eller expertgranskning. Läs aktuella primärkällor och skriv ut källänkar i artikeln. Sätt verkliga datum för kontroller. Bevara gamla publiceringsdatum vid flytt.

## Ämnesval

Flockjournal, appen och digital uppföljning har redan drygt 20 artiklar och ett tiotal sammanslagna sidor (`src/data/blogConsolidation.mjs`). Ämnet är mättat: skriv en ny artikel där bara om den besvarar en tydligt ny fråga, och högst var fjärde ny artikel. Prioritera i stället, i den här ordningen:

1. Uppdatering av en befintlig tunn sida med trafik eller köpavsikt (se Innehållsuppdateringar nedan).
2. Köpguider för utrustning som de godkända programmen säljer: vad läsaren ska jämföra, mått, antal och vanliga misstag. Inga testvinnare, egna tester eller priser.
3. Kärnfrågor om höns med verklig sökefterfrågan: skötsel, hälsa, foder, raser, regler och årstider.

Idéer och ordning finns i `queue/README.md`. Artiklar utanför höns (vandring, svamp, eldstad) ska inte få fler syskon.

Kategorin ska vara en av `config.json`-kategorierna. Köpguider för utrustning har kategorin `utrustning`. Bloggens kategorisidor bygger på `src/data/blogCategories.mjs`; lägg bara till artikeln där om databasens kategori behöver överstyras.

## Affiliate

Använd enbart program godkända för den exakta webbplatskanalen. Hönsgårdens kanal får inte användas på Odlingsdagboken eller AgilityManager. Hämta länken i Adtraction och spara verifierat program, kanal, destination och kontrolldatum. Lägg artikelns slug i EPI 1. Välj så många relevanta köpvägar som hjälper läsaren; en provisionsnivå gör inte en irrelevant produkt lämplig. Skriv annonsinformation före den första annonslänken och använd rel=sponsored. Ange inga osäkrade aktuella priser eller lagersaldon. Kontrollera destinationssidan och ersätt utgångna erbjudanden. Kontrollera programstatus igen minst månadsvis före nya affiliatelänkar. Ändra aldrig kanal-ID på en befintlig länk genom gissning.

En köpguide kan sätta `"automatic_product_placements": true`. Då länkas första omnämnandet av en produkttyp (t.ex. lucköppnare eller foderautomat) till en matchande produkt i lager ur katalogen, och artikeln får den märkta produktsektionen, för besökare utan Plus. Använd det när artikeln faktiskt handlar om att välja utrustning; produkterna kommer ur flödena och behöver inte skrivas in i texten.

## Publiceringsväg

1. Hämta senaste main och aktuell publicerad artikelinventering. Skapa en avgränsad arbetsgren.
2. Spara originalartikeln i content/editorial/articles/<slug>.json. Använd befintlig egen bild. Inga externa Soro-bilder i nytt innehåll.
3. Kör npm run editorial:check och nödvändiga bygg-/CI-kontroller. Granska den faktiska artikeln och produktlänkarna.
4. Hönsgården och Odlingsdagboken: kör node scripts/editorial-publisher.mjs sql <artikel.json>. Exekvera den exakta SQL:en genom den autentiserade Lovable-databasanslutningen till projektet i config.json. Verktyget skapar enbart nya artiklar; samma innehåll kan köras igen utan en dubblett. Konflikter ska utredas och får inte kringgås med upsert eller radering. Bekräfta efteråt slug, titel, content-hash och is_published med en separat SELECT. Endast titel/slug räcker inte som verifiering.
5. AgilityManager: uppdatera src/content/editorial.generated.json från de granskade JSON-filerna, sorterade efter filnamn. Befintliga artiklar i articles.ts bevaras.
6. Publicera källorna genom GitHub-gren och PR. Respektera aktuell main, CI och merge-regler. Merge till main ingår i ägarens instruktion att publicera. Vänta tills Lovable-projektets latest_commit_sha motsvarar publicerad main innan lovable_deploy_project.
7. Kontrollera den riktiga domänen: HTTP 200, rätt H1 och artikeltext redan i HTML-svaret, unik canonical, rätt robots, sitemap, bilder och fungerande produkt-CTA. Kontrollera också browser-renderingen. En skapad fil eller PR är inte en publicerad artikel.
8. Rapportera verklig URL och resultat. Vid fel: sluta publicera fler artiklar på den berörda sajten och rapportera den konkreta spärren. Skapa aldrig en alternativ skrivväg som skriver över data.

## Fortlöpande SEO-arbete

Varje körning: kontrollera föregående publicering, indexerbar HTML, sitemap, canonical, bildägande och relevanta interna länkar. Före ny artikel: jämför avsikten med befintligt innehåll och välj en obesvarad fråga. Sammanslagna artiklar finns i `src/data/blogConsolidation.mjs`: skriv aldrig en ny artikel för en sökavsikt som redan har en målsida där, och återanvänd aldrig en sammanslagen slug. Förbättra målsidan i stället. Länka till minst en relevant befintlig guide samt en verklig produktfunktion.

Varje vecka: använd Search Console om en autentiserad anslutning faktiskt finns; jämför senaste 28 dagar med föregående 28 för sidors visningar, klick och sökfrågor. Saknas åtkomst ska det uttryckligen stå att organisk effekt inte kan mätas. Prioritera uppdatering av en befintlig relevant sida framför ännu en liknande artikel. Gör innehållsuppdateringar i separat PR med den gamla texten tillgänglig för jämförelse, enligt Innehållsuppdateringar nedan. Publikationsverktyget får inte användas för att kringgå create-only-skyddet.

Följ affiliate-klick per artikel från befintlig spårning och faktisk godkänd provision från Adtraction per EPI när kontot är tillgängligt. Håll klick, väntande provision och godkänd provision åtskilda. Beräkna intäkt per klick bara med korrekt period och faktisk data. Föreslå nästa insats utifrån relevans, faktisk efterfrågan och intäkt per arbetstimme; ge inga löften om ranking eller intäkt.

## Innehållsuppdateringar

En publicerad artikel uppdateras i `content/editorial/updates/<slug>/`:

1. Exportera den publicerade texten: kör arbetsflödet *Affiliate coverage report* med `export_slugs` = slug. Spara `content` exakt som `previous.html` och dess sha256 som `previous_sha256` i `update.json`.
2. Skriv den nya texten i `next.html` och fyll i `update.json` (skäl, källor, nya metafält). Behåll titel och slug om inte sökavsikten ändras.
3. `npm run editorial:check` validerar alla uppdateringar: 900–2 400 ord, källor citerade i texten, inga påhittade tester eller erfarenheter, inga okontrollerade externa länkar.
4. `node scripts/editorial-update.mjs sql <slug>` ger SQL som körs via den autentiserade Lovable-databasanslutningen. Den ändrar raden bara om texten fortfarande är `previous.html`; har artikeln ändrats sedan exporten avbryts den med ett konfliktfel, och en andra körning gör ingenting. Kontrollera att sista raden visar `applied = t`.
5. Kontrollera den riktiga domänen som vid publicering. Mappen ligger kvar som historik.

Följande uppdateringar väntar på att SQL:en körs (2026-10-14): `vattenautomat-hons`, `varmelampa-hons`, `varprede-hons`, `sittpinnar-hons`, `klacka-agg`.

## Soro-flytt

De gamla texterna finns i tidigare sparat flyttarkiv. content/editorial/migration innehåller endast de saknade native-posterna som ska bevaras, inte nya ChatGPT-artiklar. soro-media-map.json kopplar varje källa till dess egna bildfil. Gamla ?post-länkar går via klientomdirigering till den native-artikeln; detta är inte en verifierad HTTP 301. Soro-jobben pausas vid bytet, inte andra jobb. Abonnemang kan avslutas först efter kontroll av alla gamla texter/bilder, riktiga URL:er och aktiv ersättande publicering. Återaktivera inte gamla Soro-upsert-jobb som en automatisk retry.

## Publiceringskö

Nästa originalartikel finns i `queue/`. Filer där är utkast och räknas inte som publicerade. Följ `queue/README.md`, kontrollera senaste publicering före varje körning och publicera högst en ny artikel per sajt varannan kalenderdag i Europe/Stockholm.
