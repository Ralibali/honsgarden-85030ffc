/**
 * Bloggens kategorier – single source of truth för appen och prerender.
 *
 * Kategorin i blog_posts är fritext och har med åren fått flera stavningar för
 * samma ämne ("halsa"/"hälsa", "Raser", "Hönshus & utrustning" …). Sådana
 * artiklar hamnade inte på någon kategorisida och brödsmulan pekade på en
 * kategori som inte finns. Här mappas varje artikel till en kanonisk slug:
 * först en uttrycklig placering per artikel, sedan stavningsvarianter.
 * Databasen rörs inte.
 */

/** @typedef {{ label: string, title: string, description: string, ogImage: string }} BlogCategoryMeta */

/** @type {Record<string, BlogCategoryMeta>} */
export const BLOG_CATEGORY_META = {
  utrustning: {
    label: 'Hönshus & utrustning',
    title: 'Hönshus och utrustning – köpguider och mått | Hönsgården',
    description: 'Köpguider och mått för hönshus, värpreden, sittpinnar, vattenautomater, foderautomater, värme och kläckning – så väljer du rätt utrustning till flocken.',
    ogImage: '/blog-images/chicken-coop.jpg',
  },
  raser: {
    label: 'Raser',
    title: 'Hönsraser i Sverige – Jämförelser & guider | Hönsgården',
    description: 'Jämför hönsraser för svenskt klimat: värpning, temperament, vinterhärdighet och pris för hobbyhönsägare.',
    ogImage: '/blog-images/chicken-breeds.jpg',
  },
  halsa: {
    label: 'Hälsa',
    title: 'Hönshälsa – Sjukdomar, behandling & förebyggande | Hönsgården',
    description: 'Allt om hönshälsa: vanliga sjukdomar, symptom, behandling och förebyggande åtgärder. Håll din flock frisk och glad.',
    ogImage: '/blog-images/hen-health-check.jpg',
  },
  nyborjare: {
    label: 'Nybörjare',
    title: 'Börja med höns – Komplett nybörjarguide | Hönsgården',
    description: 'Ska du skaffa höns? Här hittar du allt en nybörjare behöver veta – från val av ras och regler till hönshus och daglig skötsel.',
    ogImage: '/blog-images/baby-chicks.jpg',
  },
  foder: {
    label: 'Foder & ekonomi',
    title: 'Foder till höns – vad de äter och vad det kostar | Hönsgården',
    description: 'Vad höns ska äta, hur mycket foder flocken går åt och hur du räknar och sänker foderkostnaden för hobbyhöns.',
    ogImage: '/blog-images/feed-varieties.jpg',
  },
  tips: {
    label: 'Tips & tricks',
    title: 'Tips & tricks för hönsägare – Smarta knep för hönsgården | Hönsgården',
    description: 'Praktiska tips och smarta knep för att sköta dina höns bättre. Spara tid, pengar och håll flocken frisk.',
    ogImage: '/blog-images/hens-feeding.jpg',
  },
  guide: {
    label: 'Planering & flockjournal',
    title: 'Planering och flockjournal för hobbyhöns | Hönsgården',
    description: 'Så planerar du skötseln och för anteckningar om flocken: ägg, hälsa, kostnader och rutiner som går att följa över tid.',
    ogImage: '/blog-images/hens-garden.jpg',
  },
  recension: {
    label: 'Recensioner',
    title: 'Genomgångar av utrustning för hönsägare | Hönsgården',
    description: 'Genomgångar av utrustning för hönsägare: vad du ska jämföra innan du köper hönshus, foderautomat, värme eller kläckmaskin.',
    ogImage: '/blog-images/feed-varieties.jpg',
  },
  tradgard: {
    label: 'Trädgård & odling',
    title: 'Trädgård & odling – Tips för självhushåll | Hönsgården',
    description: 'Odla grönsaker, kompostera med höns och skapa en produktiv trädgård. Guider för dig som kombinerar höns med odling.',
    ogImage: '/blog-images/spring-garden.jpg',
  },
  hem: {
    label: 'Hem & hållbarhet',
    title: 'Hem & hållbarhet – Hållbart boende med höns | Hönsgården',
    description: 'Tips för ett hållbart hem med höns. Kompostering, självhushåll och smarta lösningar för den miljömedvetna hönsägaren.',
    ogImage: '/blog-images/farm-kitchen.jpg',
  },
  friluftsliv: {
    label: 'Friluftsliv & natur',
    title: 'Friluftsliv & natur – Utomhuslivet med höns | Hönsgården',
    description: 'Friluftsliv, naturupplevelser och livet utomhus. Guider för dig som älskar naturen och lantlivet.',
    ogImage: '/blog-images/sunset-farm.jpg',
  },
};

/** Stavningar i databasen → kanonisk slug (gemener, trimmat). */
const CATEGORY_ALIASES = {
  'hälsa': 'halsa',
  'nybörjare': 'nyborjare',
  'hönshus & utrustning': 'utrustning',
  'problem & lösningar': 'tips',
  'regler & lagar': 'nyborjare',
  'höns': 'guide',
};

/** Artiklar som hör hemma i en mer träffande kategori än den i databasen. */
export const BLOG_POST_CATEGORY = {
  // Köpguider och mått för utrustning.
  'honshus-guide': 'utrustning',
  'bygga-honshus': 'utrustning',
  'honshus-2026-kompletta-kopguiden': 'utrustning',
  'varprede-hons': 'utrustning',
  'sittpinnar-hons': 'utrustning',
  'vattenautomat-hons': 'utrustning',
  'varmelampa-hons': 'utrustning',
  'klacka-agg': 'utrustning',
  'automatisk-honslucka-jamforelse': 'utrustning',
  'foderautomat-hons-valj-ratt': 'utrustning',
  // Raser.
  'bast-honsras-sverige': 'raser',
  'honsraser-for-agglaggeri-sverige': 'raser',
  'brahma-hons': 'raser',
  'paduan-hons': 'raser',
  // Hälsa.
  'honshalsa-symptom': 'halsa',
  '5-tecken-pa-frisk-flock': 'halsa',
  'daglig-kontroll-av-hons': 'halsa',
  'guide-till-halsokontroll-i-flock': 'halsa',
  // Nybörjare och regler.
  'skaffa-hons-nyborjarguide': 'nyborjare',
  'registrera-hons-jordbruksverket': 'nyborjare',
  'regler-hons-sverige': 'nyborjare',
  // Foder och ekonomi.
  'foder-till-hons-guide': 'foder',
  'vad-ater-hons': 'foder',
  'basta-rutiner-for-foderplanering': 'foder',
  'berakna-foderkostnad-for-hons': 'foder',
  'satt-att-minska-foderkostnader': 'foder',
  'vad-paverkar-honsens-foderforbrukning': 'foder',
  'guide-till-smaskalig-honsekonomi': 'foder',
  // Värpning.
  'nar-minskar-varpningen-hos-hons': 'tips',
  'hons-varper-inte': 'tips',
};

/**
 * Kanonisk kategori-slug för en kategori ur databasen eller en URL, eller null
 * om den inte motsvarar någon kategori.
 * @param {string | null | undefined} value
 * @returns {string | null}
 */
export function canonicalBlogCategory(value) {
  if (typeof value !== 'string') return null;
  const key = value.trim().toLowerCase();
  if (!key) return null;
  if (BLOG_CATEGORY_META[key]) return key;
  return CATEGORY_ALIASES[key] ?? null;
}

/**
 * @param {{ slug?: string | null, category?: string | null } | null | undefined} post
 * @returns {string | null}
 */
export function blogCategoryOf(post) {
  if (!post) return null;
  return (post.slug && BLOG_POST_CATEGORY[post.slug]) || canonicalBlogCategory(post.category);
}

/**
 * Samma artikel med kanonisk kategori (null om den saknas).
 * @template {{ slug?: string | null, category?: string | null }} T
 * @param {T} post
 * @returns {T}
 */
export function withBlogCategory(post) {
  const category = blogCategoryOf(post);
  return category === post.category ? post : { ...post, category };
}

/**
 * @param {string | null | undefined} category
 * @returns {string | undefined}
 */
export function blogCategoryLabel(category) {
  return category ? BLOG_CATEGORY_META[category]?.label : undefined;
}
