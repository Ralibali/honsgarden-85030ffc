/**
 * Sammanslagna bloggartiklar (2026-10-05).
 *
 * Soro-flytten 2026-09-06 lämnade ~85 artiklar om appen, flockjournal och
 * digital uppföljning där många besvarar samma sökfråga med nästan samma
 * text. De konkurrerade med varandra (och med produktsidorna /app-for-honsagare
 * och /agglogg) i stället för att samla styrkan på en sida.
 *
 * Varje källa nedan får en permanent 308 till den sida som bäst besvarar samma
 * sökavsikt. Källorna försvinner ur sitemap, bloggens listor, relaterade
 * artiklar och automatiska interna länkar. Innehållet i databasen rörs inte.
 *
 * Regler: en källa pekar aldrig på en annan källa (inga kedjor), granskade
 * redaktionella artiklar och sidor som koden refererar till slås aldrig ihop.
 * Single source of truth för routeInventory (vercel.json), prerender och appen.
 */

/** @type {Record<string, string>} källslug → målsökväg */
export const CONSOLIDATED_BLOG_POSTS = {
  // App, Excel eller papper för flockens anteckningar.
  'mobilapp-jamfort-med-kalkylblad-for-hons': '/blogg/mobilapp-vs-excel-for-hons',
  'honsapp-eller-kalkylblad': '/blogg/mobilapp-vs-excel-for-hons',
  'app-eller-parm-for-hons': '/blogg/mobilapp-vs-excel-for-hons',
  'app-eller-pappersjournal-for-hons-vad-passar': '/blogg/mobilapp-vs-excel-for-hons',
  'digital-flockjournal-vs-papper': '/blogg/mobilapp-vs-excel-for-hons',
  'fran-anteckningsbok-till-honsapp': '/blogg/mobilapp-vs-excel-for-hons',

  // "Bästa/gratis app för hönsägare", appens egna "recensioner" → produktsidan.
  'app-for-honsagare': '/app-for-honsagare',
  'basta-appen-for-honshallning': '/app-for-honsagare',
  'appar-for-hobbyuppfodare-av-hons': '/app-for-honsagare',
  'gratis-honsapp-jamforelse': '/app-for-honsagare',
  'recension-av-app-for-honsagare': '/app-for-honsagare',
  'recension-flockadministrationsapp-hons': '/app-for-honsagare',
  'flockadministration-hobbyhons-app': '/app-for-honsagare',
  'organisera-flocken-med-app': '/app-for-honsagare',

  // Komma igång med appen som nybörjare.
  'kom-igang-med-honsapp': '/blogg/honsapp-for-nyborjare',

  // Ägglogg i appen → produktsidan för äggloggen.
  'agglogg-app-battre-koll-honsgarden': '/agglogg',
  'basta-appen-for-aggloggning': '/agglogg',
  'logga-aggproduktion-i-app': '/agglogg',
  'aggproduktion-hons-app': '/agglogg',
  'verktyg-for-smaskalig-aggproduktion': '/agglogg',

  // Hur man loggar ägg (oberoende av verktyg).
  'registrera-agg-per-dag': '/blogg/hur-loggar-man-aggproduktion',
  'exempel-pa-digital-aggjournal': '/blogg/hur-loggar-man-aggproduktion',

  // Värpning och historik per höna.
  'hur-haller-man-koll-pa-varpning': '/blogg/spara-varpning-per-hona',
  'spara-historik-for-varje-hona': '/blogg/spara-varpning-per-hona',

  // Värpningen sjunker eller avviker.
  'varfor-sjunker-aggproduktionen-plotsligt': '/blogg/hons-varper-inte',
  'upptacka-avvikande-varpmonster-tidigt': '/blogg/hons-varper-inte',

  // Registrera utan internet.
  'offline-flockhantering-hons': '/blogg/kan-man-registrera-utan-internet',
  'test-av-offline-honsapp': '/blogg/kan-man-registrera-utan-internet',
  'spara-honsdata-offline-enkelt': '/blogg/kan-man-registrera-utan-internet',
  'anvanda-honsapp-utan-internet': '/blogg/kan-man-registrera-utan-internet',
  'offline-app-for-stall': '/blogg/kan-man-registrera-utan-internet',

  // Starta och föra flockjournal/register.
  'starta-flockjournal-pa-mobilen': '/blogg/hur-startar-man-flockjournal',
  'fordelar-med-mobil-flockjournal': '/blogg/hur-startar-man-flockjournal',
  'komma-igang-med-flockregister': '/blogg/hur-startar-man-flockjournal',
  'digitalt-honsregister': '/blogg/hur-startar-man-flockjournal',
  'basta-sattet-att-dokumentera-flocken': '/blogg/hur-startar-man-flockjournal',

  // Verktyg och system för flockadministration.
  'verktyg-for-flockadministration': '/blogg/5-verktyg-for-hobbyhonsagare',
  'hobbyhonsagarens-verktyg-flockkontroll': '/blogg/5-verktyg-for-hobbyhonsagare',
  'verktyg-for-smaskalig-honshallning': '/blogg/5-verktyg-for-hobbyhonsagare',
  'enkelt-system-for-hobbyuppfodare': '/blogg/5-verktyg-for-hobbyhonsagare',
  'guide-till-flockadministration-for-hobbyhons': '/blogg/5-verktyg-for-hobbyhonsagare',

  // Daglig kontroll och överblick.
  'guide-till-daglig-honsoversikt': '/blogg/daglig-kontroll-av-hons',
  'guide-till-daglig-flockuppfoljning': '/blogg/daglig-kontroll-av-hons',
  'fa-overblick-over-honsflock': '/blogg/daglig-kontroll-av-hons',
  'sa-forbattras-overblick-i-flocken-enkelt': '/blogg/daglig-kontroll-av-hons',
  'guide-for-daglig-honsskotsel-hemma': '/blogg/daglig-kontroll-av-hons',

  // Planera skötsel och rutiner.
  'basta-sattet-att-planera-honsskotsel': '/blogg/planera-skotsel-av-hobbyhons-med-battre-koll',
  'guide-till-enklare-flockplanering': '/blogg/planera-skotsel-av-hobbyhons-med-battre-koll',
  'skapa-rutiner-for-honsskottsel-som-haller': '/blogg/planera-skotsel-av-hobbyhons-med-battre-koll',
  'hobbyhons-skotsel-schema': '/blogg/planera-skotsel-av-hobbyhons-med-battre-koll',

  // Logga och följa hälsan över tid.
  'honshalsa-digital-uppfoljning': '/blogg/guide-till-halsologgning-honsflock',
  'folja-honsens-halsa-digitalt': '/blogg/guide-till-halsologgning-honsflock',
  'honshalsa-app-battre-koll-flocken': '/blogg/guide-till-halsologgning-honsflock',
  'journal-for-honsens-halsa': '/blogg/guide-till-halsologgning-honsflock',
  'hur-foljer-man-honshalsa': '/blogg/guide-till-halsologgning-honsflock',
  'folja-flockens-halsomonster-over-tid': '/blogg/guide-till-halsologgning-honsflock',

  // Dokumentera sjuka höns.
  'hur-dokumenterar-man-sjuka-hons': '/blogg/dokumentera-sjukdom-hos-hons',

  // Ekonomi och lönsamhet.
  'guide-till-honsens-kostnadsoversikt': '/blogg/guide-till-smaskalig-honsekonomi',
  'guide-for-kostnadskontroll-i-honsgard': '/blogg/guide-till-smaskalig-honsekonomi',
  'mata-lonsamhet-i-hobbyhons': '/blogg/guide-till-smaskalig-honsekonomi',

  // Foderkostnad och förbrukning.
  'vad-kostar-fodret-per-agg': '/blogg/berakna-foderkostnad-for-hons',
  'mata-flockens-foderforbrukning': '/blogg/vad-paverkar-honsens-foderforbrukning',
  'halla-koll-pa-foderatgang': '/blogg/vad-paverkar-honsens-foderforbrukning',
};

/** Målsökväg för en sammanslagen artikel, annars null. */
export function consolidatedBlogTarget(slug) {
  if (!slug) return null;
  return Object.prototype.hasOwnProperty.call(CONSOLIDATED_BLOG_POSTS, slug)
    ? CONSOLIDATED_BLOG_POSTS[slug]
    : null;
}

/** Artiklar som fortfarande ska listas, länkas och indexeras. */
export function withoutConsolidatedPosts(posts = []) {
  return posts.filter((post) => !consolidatedBlogTarget(post?.slug));
}

/** Permanenta redirects för routeInventory/vercel.json. */
export const CONSOLIDATED_BLOG_REDIRECTS = Object.entries(CONSOLIDATED_BLOG_POSTS)
  .map(([slug, destination]) => ({ source: `/blogg/${slug}`, destination, statusCode: 308 }));

const INTERNAL_BLOG_HREF_RE = /(\shref=)(["'])(?:https:\/\/(?:www\.)?honsgarden\.se)?\/blogg\/([^"'#?\/]+)([#?][^"']*)?\2/gi;

/**
 * Pekar interna länkar i artikeltext direkt på målsidan, så att läsare och
 * crawlers slipper en redirect. Fragment/query följer inte med till målet.
 */
export function rewriteConsolidatedBlogLinks(html = '') {
  return String(html).replace(INTERNAL_BLOG_HREF_RE, (full, attr, quote, slug) => {
    let decoded = slug;
    try {
      decoded = decodeURIComponent(slug);
    } catch {
      /* behåll rå slug */
    }
    const target = consolidatedBlogTarget(decoded);
    return target ? `${attr}${quote}${target}${quote}` : full;
  });
}
