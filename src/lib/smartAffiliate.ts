export interface SmartAffiliateProduct {
  id: string;
  externalId?: string;
  advertiser: string;
  advertiserName?: string;
  name: string;
  price: string;
  priceOriginal?: number | null;
  imageUrl: string;
  trackingUrl: string;
  productUrl?: string;
  description?: string;
  keywords: string[];
  category: string;
  inStock?: boolean;
  source?: 'static' | 'database' | 'addrevenue';
}

export interface ArticleContext {
  slug: string;
  title: string;
  heading: string;
  text: string;
}

const STOP_WORDS = new Set([
  'alla', 'andra', 'artikel', 'att', 'bara', 'blir', 'den', 'det', 'din', 'dina',
  'eller', 'ett', 'finns', 'från', 'för', 'guide', 'har', 'hur', 'kan', 'med',
  'och', 'också', 'på', 'som', 'till', 'tips', 'under', 'utan', 'vad', 'vid',
  'våra', 'över', 'garden', 'gardena', 'deluxe', 'basic', 'premium', 'set',
  'helt', 'stor', 'stora', 'liten', 'lilla', 'sätt', 'vart', 'with',
]);

const GENERIC_KEYWORDS = new Set([
  'gård', 'höns', 'odling', 'redskap', 'trädgård', 'utrustning', 'vatten',
  'hönshus', 'hönsgård', 'fjäderfä',
]);

const CATEGORY_SIGNALS: Record<string, string[]> = {
  vatten: ['vatten', 'dricka', 'vattenautomat', 'frost', 'vinter', 'törst'],
  foder: ['foder', 'utfodra', 'mat', 'fodring', 'spannmål'],
  vaerme: ['värme', 'kyla', 'vinter', 'värmelampa', 'kyckling'],
  hus: ['hönshus', 'rede', 'värprede', 'lucka', 'inredning', 'rovdjur'],
  klackning: ['kläck', 'ruva', 'ruvning', 'kyckling', 'äggkläckning'],
  staengsel: ['stängsel', 'inhägnad', 'nät', 'räv', 'rovdjur', 'hage'],
  redskap: ['redskap', 'hönshus', 'gård', 'rengöra', 'städa'],
  tillskott: ['tillskott', 'kalcium', 'snäckskal', 'mineral', 'äggskal'],
  startset: ['nybörjare', 'skaffa höns', 'komma igång', 'starta'],
  bevattning: ['bevattning', 'vattna', 'vattenslang', 'slang', 'spridare', 'torka', 'vattenfördelare'],
  beskarning: ['beskär', 'sekatör', 'häck', 'gren', 'buske', 'fruktträd', 'trädvård'],
  odling: ['odla', 'odling', 'plantera', 'jord', 'rabatt', 'köksträdgård', 'ogräs', 'skörd'],
  stadning: ['städa', 'rengöra', 'borste', 'sopskyffel', 'hönshus', 'gårdsplan'],
  tradgardsklader: ['trädgårdshandskar', 'handskar', 'arbetskläder', 'skydd', 'trädgårdsarbete'],
  forvaring: ['korg', 'förvaring', 'kruka', 'olivträd', 'skörd', 'plantering'],
  grasmatta: ['gräsmatta', 'gräsfrö', 'så gräs', 'gräsvård'],
  tradgardsredskap: ['trädgårdsredskap', 'trädgårdsarbete', 'odla', 'plantera', 'rabatt', 'köksträdgård'],
};

const CATEGORY_REASONS: Record<string, string> = {
  vatten: 'Ett relevant alternativ för enklare vattenrutiner i hönsgården.',
  foder: 'Ett relevant val för enklare och mer hygienisk utfodring.',
  vaerme: 'Ett praktiskt hjälpmedel när kycklingar eller vinterkyla kräver extra värme.',
  hus: 'Ett alternativ som kan göra hönshuset tryggare och mer lättskött.',
  klackning: 'Ett relevant hjälpmedel för en jämnare och tryggare kläckning.',
  staengsel: 'Ett praktiskt alternativ för inhängnad och skydd mot rovdjur.',
  redskap: 'Ett redskap som kan förenkla det praktiska arbetet i hönsgården.',
  tillskott: 'Ett relevant komplement när flockens mineral- eller kalciumbehov behöver stöttas.',
  startset: 'Ett smidigt alternativ för dig som vill komma igång med rätt grundutrustning.',
  bevattning: 'Ett relevant alternativ för bevattning och smartare vattenhantering.',
  beskarning: 'Ett passande redskap för beskärning och skötsel av träd och buskar.',
  odling: 'Ett praktiskt redskap för plantering, ogräsrensning och odling.',
  stadning: 'Ett enkelt hjälpmedel för rengöring av gård, gångar eller hönshus.',
  tradgardsklader: 'Ett praktiskt skydd för händer och kläder under arbetet utomhus.',
  forvaring: 'Ett dekorativt och praktiskt alternativ för plantering, skörd eller förvaring.',
  grasmatta: 'Ett relevant val för etablering och skötsel av gräsmattan.',
  tradgardsredskap: 'Ett användbart redskap för det löpande arbetet i trädgården.',
};

export function normalizeAffiliateText(value: string): string {
  return value
    .toLowerCase()
    .replace(/&(?:amp|quot|apos|nbsp);/g, ' ')
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Swedish inflections a short word may take ("jorden", "korgar", "näten").
const SHORT_WORD_SUFFIX = '(?:a|e|r|n|t|s|en|et|ar|er|or|na|arna|erna|orna)?';

function containsPhrase(haystack: string, phrase: string): boolean {
  const normalized = normalizeAffiliateText(phrase);
  if (!normalized) return false;
  if (` ${haystack} `.includes(` ${normalized} `)) return true;
  // Short words must be a whole word, so "jord" never matches "jordbruksverket"
  // and "mat" never matches "information". Longer words may sit inside compounds
  // ("foder" in "hönsfoder").
  if (normalized.length <= 4) return new RegExp(`(?:^| )${normalized}${SHORT_WORD_SUFFIX}(?: |$)`).test(haystack);
  return haystack.includes(normalized);
}

/** Words every poultry product shares; they say nothing about which product fits. */
const NAME_NOISE = new Set(['hons', 'hona', 'honor', 'honan', 'kyckling', 'kycklingar', 'fjaderfa', 'flock', 'liter', 'litet', 'liten', 'stor', 'stort']);

const POULTRY_CATEGORIES = new Set(['vatten', 'foder', 'vaerme', 'hus', 'klackning', 'staengsel', 'tillskott', 'startset']);
const POULTRY_CONTEXT = /\b(?:hons\w*|hona|honor|honan|tupp\w*|kyckling\w*|fjaderfa\w*|flock\w*|agg\w*|varp\w*)\b/;

const GARDEN_CATEGORIES = new Set(['bevattning', 'beskarning', 'odling', 'stadning', 'tradgardsklader', 'forvaring', 'grasmatta', 'tradgardsredskap']);
const GARDEN_CONTEXT = /\b(?:tradgard\w*|odla\w*|odling\w*|plantera\w*|rabatt\w*|grasmatta\w*|kompost\w*|bevattn\w*|vattna\w*|beskar\w*|frukttrad\w*|kokstradgard\w*|ogras\w*|skord\w*)\b/;

/** Products that must never be suggested automatically next to care advice (slaughter/euthanasia). */
const NEVER_AUTO_PLACE = /\b(?:bultpistol|avlivning\w*|slakt\w*)\b/;

const NORMALIZED_STOP_WORDS = new Set([...STOP_WORDS].map(normalizeAffiliateText));

function meaningfulTokens(value: string): string[] {
  const seen = new Set<string>();
  return normalizeAffiliateText(value)
    .split(' ')
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token))
    .filter((token) => {
      if (seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

function hasCategorySignal(category: string, normalizedContext: string): boolean {
  const signals = CATEGORY_SIGNALS[category];
  if (!signals || signals.length === 0) return true;
  return signals.some((signal) => containsPhrase(normalizedContext, signal));
}

export function scoreAffiliateProduct(
  product: SmartAffiliateProduct,
  context: ArticleContext,
): number {
  if (product.inStock === false || !product.imageUrl || !product.trackingUrl) return Number.NEGATIVE_INFINITY;
  if (NEVER_AUTO_PLACE.test(normalizeAffiliateText(product.name))) return Number.NEGATIVE_INFINITY;

  const slug = normalizeAffiliateText(context.slug.replace(/-/g, ' '));
  const title = normalizeAffiliateText(context.title);
  const heading = normalizeAffiliateText(context.heading);
  const section = normalizeAffiliateText(context.text);
  const fullContext = `${slug} ${title} ${heading} ${section}`.trim();

  if (!hasCategorySignal(product.category, fullContext)) return Number.NEGATIVE_INFINITY;
  // Poultry gear only where the text is about hens; garden tools only where
  // the article or section is about the garden.
  if (POULTRY_CATEGORIES.has(product.category) && !POULTRY_CONTEXT.test(fullContext)) return Number.NEGATIVE_INFINITY;
  if (GARDEN_CATEGORIES.has(product.category) && !GARDEN_CONTEXT.test(`${slug} ${title} ${heading}`)) return Number.NEGATIVE_INFINITY;

  // Evidence about this product. The category bonus below only ranks
  // products that already have some; it never qualifies one on its own.
  let score = 0;
  // Specific (non-generic) hits; headline = heading, title or slug.
  let evidence = 0;
  let headlineEvidence = 0;
  const productKeywords = product.keywords ?? [];

  for (const keyword of productKeywords) {
    const normalizedKeyword = normalizeAffiliateText(keyword);
    if (normalizedKeyword.length < 3 || NORMALIZED_STOP_WORDS.has(normalizedKeyword)) continue;
    const generic = GENERIC_KEYWORDS.has(keyword.toLowerCase());
    const inHeadline = containsPhrase(heading, normalizedKeyword) || containsPhrase(title, normalizedKeyword) || containsPhrase(slug, normalizedKeyword);
    if (containsPhrase(heading, normalizedKeyword)) score += generic ? 4 : 18;
    if (containsPhrase(title, normalizedKeyword)) score += generic ? 3 : 10;
    if (containsPhrase(slug, normalizedKeyword)) score += generic ? 2 : 7;
    if (containsPhrase(section, normalizedKeyword)) score += generic ? 1 : 5;
    if (!generic && (inHeadline || containsPhrase(section, normalizedKeyword))) evidence += 1;
    if (!generic && inHeadline) headlineEvidence += 1;
  }

  const nameTokens = meaningfulTokens(product.name).filter((token) => !NAME_NOISE.has(token));
  for (const token of nameTokens) {
    if (containsPhrase(heading, token)) { score += 9; evidence += 1; headlineEvidence += 1; }
    else if (containsPhrase(title, token)) { score += 6; evidence += 1; headlineEvidence += 1; }
    else if (containsPhrase(section, token)) { score += 3; evidence += 1; }
  }

  const legacySlugs = (product as SmartAffiliateProduct & { slugs?: string[] }).slugs;
  if (legacySlugs?.some((item) => context.slug.includes(item))) { score += 100; evidence += 1; headlineEvidence += 1; }

  if (evidence === 0) return Number.NEGATIVE_INFINITY;
  // Generic hardware (drills, fittings, thermostats) only where the heading or
  // title is about it, never because the body text mentions it in passing.
  if (product.category === 'redskap' && headlineEvidence === 0) return Number.NEGATIVE_INFINITY;

  // Description overlap only ranks products that already matched: generic
  // description words ("vatten", "enkel") are not evidence on their own.
  if (product.description) {
    const descriptionTokens = meaningfulTokens(product.description).filter((token) => !NAME_NOISE.has(token)).slice(0, 20);
    const overlap = descriptionTokens.filter((token) => containsPhrase(`${heading} ${section}`, token)).length;
    score += Math.min(10, overlap * 2);
  }

  const categorySignals = CATEGORY_SIGNALS[product.category] ?? [];
  const categoryHits = categorySignals.filter((signal) => containsPhrase(fullContext, signal)).length;
  score += Math.min(16, categoryHits * 4);

  return score;
}

export function matchSmartProducts(
  products: SmartAffiliateProduct[],
  context: ArticleContext,
  limit = 3,
  excludedIds: Set<string> = new Set(),
): SmartAffiliateProduct[] {
  const scored = products
    .filter((product) => !excludedIds.has(product.id))
    .map((product) => ({ product, score: scoreAffiliateProduct(product, context) }))
    .filter(({ score }) => Number.isFinite(score) && score >= 8)
    .sort((a, b) => b.score - a.score || a.product.name.localeCompare(b.product.name, 'sv'));

  const selected: SmartAffiliateProduct[] = [];
  const advertisers = new Set<string>();
  const categories = new Set<string>();

  for (const { product } of scored) {
    if (selected.length >= limit) break;
    const addsDiversity = !advertisers.has(product.advertiser) || !categories.has(product.category);
    if (!addsDiversity && scored.length > limit) continue;
    selected.push(product);
    advertisers.add(product.advertiser);
    categories.add(product.category);
  }

  if (selected.length < limit) {
    for (const { product } of scored) {
      if (selected.length >= limit) break;
      if (!selected.some((item) => item.id === product.id)) selected.push(product);
    }
  }

  return selected;
}

export function affiliateReason(product: SmartAffiliateProduct): string {
  return CATEGORY_REASONS[product.category] ?? 'Ett produktförslag som matchar innehållet i det här avsnittet.';
}

const ADVERTISER_NAMES: Record<string, string> = {
  'p-lindberg': 'P. Lindberg',
  plindberg: 'P. Lindberg',
  bonden: 'Bonden.se',
  'by-benson': 'By Benson',
  bybenson: 'By Benson',
  dintradgard: 'DinTrädgård',
  'din-tradgard': 'DinTrädgård',
  granngarden: 'Granngården',
  jula: 'Jula',
  biltema: 'Biltema',
  clasohlson: 'Clas Ohlson',
  hornbach: 'Hornbach',
  bauhaus: 'Bauhaus',
  byggmax: 'Byggmax',
  k_rauta: 'K-Rauta',
  blomsterlandet: 'Blomsterlandet',
  amazon: 'Amazon',
};

function prettifyAdvertiserSlug(slug: string): string {
  return slug
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function advertiserFromUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const root = host.split('.').slice(-2, -1)[0] ?? host;
    const key = root.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (ADVERTISER_NAMES[key]) return ADVERTISER_NAMES[key];
    return prettifyAdvertiserSlug(root);
  } catch {
    return null;
  }
}

export function affiliateAdvertiserName(product: SmartAffiliateProduct): string {
  if (product.advertiserName && product.advertiserName.toLowerCase() !== 'unknown') {
    return product.advertiserName;
  }
  const slugKey = (product.advertiser || '').toLowerCase();
  if (slugKey && slugKey !== 'unknown' && ADVERTISER_NAMES[slugKey]) {
    return ADVERTISER_NAMES[slugKey];
  }
  const fromUrl = advertiserFromUrl(product.trackingUrl) ?? advertiserFromUrl(product.productUrl);
  if (fromUrl) return fromUrl;
  if (slugKey && slugKey !== 'unknown') return prettifyAdvertiserSlug(slugKey);
  return 'butiken';
}
