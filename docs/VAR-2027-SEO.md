# Vårsatsning 2027 – SEO, länkar och AI-synlighet

Sammanställt 2026-11-21 från Search Console (export 20 aug–19 nov 2026) och ChatSEO-analyser av honsgarden.se. Siffror från ChatSEO är tredjepartsdata; Search Console-siffrorna är de som går att lita på.

## Läget

- 3 månader: 1 436 klick, 60 194 visningar, snittposition 6,9. Visningarna ökade cirka 60 % från augusti till november.
- 81 % av de rapporterade visningarna kommer från hönsraser. Hönshus, köpa höns och kläckning står tillsammans för cirka 2 %.
- 94 av 162 URL:er i sitemapen var inte indexerade vid ChatSEO:s kontroll. Bland dem fanns `/blogg/kopa-hons`, `/blogg/klacka-agg`, `/verktyg/vad-kostar-hons`, `/borja-med-hons` och `/honsraser/brahma`, ingen av dem med hänvisande URL.
- Varumärkessök är nästan obefintligt (cirka 1,5 % av klicken). Trafiken blir inte användare av sig själv.

## Gjort i repot (gren `claude/laughing-bohr-sy53v5`)

| Ändring | Varför |
|---|---|
| Nya titlar och metabeskrivningar för brahma, araucana, sussex, hedemorahöna och skånsk blommehöna | Position 5–8 men CTR under 1,5 % (brahma: 771 visningar, 0 klick) |
| "Nästa steg"-länkar i rassidornas prerendrade HTML till köpguide, kostnadskalkylator, kläckningsguide och kläckningskalender | Ger de oindexerade vårsidorna crawlbara interna länkar från sidor med trafik |
| Titel och beskrivning för `/verktyg/vad-kostar-hons` riktade mot "vad kostar det att skaffa höns" | 120+ visningar på position 9–10 utan klick |
| Utkast `content/editorial/queue/honsgard-guide.json` | "hönsgård" cirka 1 600 sökningar/mån, sajten på position 65 |
| Utkast `content/editorial/queue/fagelinfluensa-sverige-2026.json` | Högriskområde från 17 nov 2026; sökresultaten saknar aktuell vägledning. **Tidskänsligt** |

Båda utkasten klarar `validateArticle` men har status `draft`. Källorna lästes via ChatSEO, eftersom jordbruksverket.se inte gick att nå från arbetsmiljön.

## Kvar att göra (kräver databas, Search Console eller beslut)

1. **Kör den väntande SQL:en för `klacka-agg`** (`content/editorial/updates/klacka-agg/`, 1 089 ord, väntat sedan 2026-10-14). Kläckning är vårens första kluster, och sidan har i dag 0 visningar i klustret.
2. **Publicera fågelinfluensa-utkastet snarast** efter att beslutet och lägesidan har lästs om. Värdet sjunker när läget ändras.
3. **Publicera hönsgårdsguiden** före februari. Fågelinfluensa-artikeln länkar till den.
4. **Begär indexering i Search Console** för `/blogg/kopa-hons`, `/blogg/klacka-agg` och `/verktyg/vad-kostar-hons` när länkarna ovan är driftsatta.
5. **Uppdatera databasartiklar** via `content/editorial/updates/` (förslag i ChatSEO:s åtgärdsplan):
   - `foder-till-hons-guide`: 5 523 visningar, CTR 0,81 %. Sidan visas för "kan höns äta banan/äpple/avokado". Rikta om mot "Vad får höns äta?" med en ja/nej-tabell.
   - `brahma-hons`: det är den sidan som rankar för "brahma" (inte `/honsraser/brahma`). Byt hype-titeln mot storlek, ägg och temperament.
   - `kopa-hons`: lägg till pris, var man köper och en checklista.
   - `honshus-guide` och `honshus-2026-kompletta-kopguiden` konkurrerar om "hönshus" (3 600/mån). Låt köpguiden äga "hönshus" och byggguiden "bygga hönshus".
6. **Klart 2026-11-25:** `/honsraser/brahma` 308:as till `/blogg/brahma-hons`. Rassidan prerenderas inte och ligger inte i sitemapen, och raslänkar pekar direkt på blogginlägget.
7. **Klart 2026-11-25:** nybörjarsidorna är sammanslagna. `/borja-med-hons`, `/blogg/hobbyhons-nyborjarguide` och `/blogg/skaffa-hons-nyborjarguide` 308:as till `/blogg/skaffa-hons-nyborjare`, och alla interna länkar och kampanjlänkar pekar direkt dit. Butiksplaceringarna på de borttagna sidorna är borttagna; målsidan har redan egna Adtraction-placeringar.
8. **Statistiksidan** "Antal höns i Sverige" finns som utkast i ChatSEO. Varje siffra måste kontrolleras mot Jordbruksverket och SCB före publicering. Sidan är för lång för redaktionens ordgräns och är därför inte inlagd i kön.

## Länkprofil

63 backlinks från 38 domäner (DR cirka 3). Ungefär 28 domäner kommer från ett automatiskt PBN-nätverk med spamscore 60–75. Google ignorerar dem, så de behöver ingen disavow. Bara två länkar kommer från riktiga svenska sajter, och alla pekar på startsidan. Målet är 5–8 relevanta länkar per kvartal, varav 70 % till undersidor.

### Myndighetskataloger

En svensk statlig katalog där en privat app kan listas finns i praktiken inte. Det enda som är värt arbetet är att publicera ett litet öppet dataset (till exempel aggregerade äggpriser per region) på [dataportal.se](https://www.dataportal.se/). Kommunala företagsregister kräver lokal adress och ger nofollow-länkar. Kontrollera i stället att uppgifterna hos Allabolag, Hitta och Eniro stämmer.

### Outreach – färdigt mejl (granskat)

Skicka ett mejl per mottagare, med en länk, ingen bilaga och högst två uppföljningar (dag 7 och 21). Öppningsmeningen ska skrivas om för varje mottagare utifrån något du faktiskt har läst på deras sajt samma dag.

**Ämnesrad:** `[namn] – tre gratisverktyg för hönsägare som ni får länka till`

> Hej [namn],
>
> Jag heter [ditt namn] och bygger Hönsgården, en svensk webbsida och app för oss som har höns hemma.
>
> [En mening om något konkret du läst hos dem.]
>
> Först vill jag tipsa om något ni får använda fritt: rasguider för ett 25-tal raser, en kläckningskalender dag för dag och en kalkylator för foderkostnad. Allt fungerar i mobilen och kräver inget konto. Länka gärna till dem i [kanal] eller i en artikel: [länk]
>
> Om det känns relevant får du gärna lägga en länk till Hönsgården på er sida med länkar och råd. Inget måste, och du behöver inte svara om det inte passar.
>
> Varma hälsningar
> [ditt namn], Hönsgården

**Uppföljning dag 7:** `[namn], foderguiden är också fri att använda`: "En till sak som är fri att använda: foderguiden, som samlar vad hönsen behöver i olika åldrar och över året. [länk] Inget svar behövs."

| Segment | Prospekt | Länk i mejlet |
|---|---|---|
| Föreningar | kackel.se, kulturhons.se, ras-fjaderfa.se | `https://honsgarden.se/honsraser-lista` |
| Foderbutiker | foderboden.se, pippifoder.se, tungelstaboden.se, timotejandersen.se | `https://honsgarden.se/blogg/berakna-foderkostnad-for-hons` |
| Bloggar | honshuset.se/blog, spanahossofie.wordpress.com | `https://honsgarden.se/klackningskalender` |

Ändrat jämfört med ChatSEO:s utkast: "30 raser" är ändrat till ett 25-tal (det finns 25 rasprofiler), och "bädda in" är borttaget eftersom verktygen saknar inbäddning. ChatSEO:s färdiga öppningsmeningar är också borttagna, eftersom de beskriver inlägg som inte är kontrollerade.

## AI-synlighet (ChatGPT, AI Overviews)

1. **Äggpris på `/salja-agg`:** AI-svaren om äggförsäljning citerar i dag bara myndigheter. Lägg till ett daterat avsnitt "Vad får man för ägg?" med kr per ägg och intäkt per flockstorlek, med källa och granskningsdatum.
2. **Jämförelsesida för hönsappar 2026:** ingen äger frågan på svenska. Gör den granskande och öppen med att Hönsgården är en av apparna, och lägg Hönsgården utanför listan.
3. **`/blogg/bast-honsras-sverige`** ligger tvåa bakom Granngården. Lägg till frågerubriker ("Vilken hönsras värper mest?" och liknande) och FAQPage-schema.
4. Delta i befintliga trådar på alternativ.nu och REKO-grupper i stället för att bara publicera på egen sajt. Google Play-sidan rankar redan på "ägglogg app höns".
