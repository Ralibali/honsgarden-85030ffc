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
]);

const GENERIC_KEYWORDS = new Set([
  'gård', 'höns', 'odling', 'redskap', 'trädgård', 'utrustning', 'vatten',
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

function containsPhrase(haystack: string, phrase: string): boolean {
  const normalized = normalizeAffiliateText(phrase);
  if (!normalized) return false;
  return ` ${haystack} `.includes(` ${normalized} `) || haystack.includes(normalized);
}

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

  const slug = normalizeAffiliateText(context.slug.replace(/-/g, ' '));
  const title = normalizeAffiliateText(context.title);
  const heading = normalizeAffiliateText(context.heading);
  const section = normalizeAffiliateText(context.text);
  const fullContext = `${slug} ${title} ${heading} ${section}`.trim();

  if (!hasCategorySignal(product.category, fullContext)) return Number.NEGATIVE_INFINITY;

  let score = 0;
  const productKeywords = product.keywords ?? [];

  for (const keyword of productKeywords) {
    const normalizedKeyword = normalizeAffiliateText(keyword);
    if (normalizedKeyword.length < 3) continue;
    const generic = GENERIC_KEYWORDS.has(keyword.toLowerCase());
    if (containsPhrase(heading, normalizedKeyword)) score += generic ? 4 : 18;
    if (containsPhrase(title, normalizedKeyword)) score += generic ? 3 : 10;
    if (containsPhrase(slug, normalizedKeyword)) score += generic ? 2 : 7;
    if (containsPhrase(section, normalizedKeyword)) score += generic ? 1 : 5;
  }

  const nameTokens = meaningfulTokens(product.name);
  for (const token of nameTokens) {
    if (containsPhrase(heading, token)) score += 9;
    else if (containsPhrase(title, token)) score += 6;
    else if (containsPhrase(section, token)) score += 3;
  }

  const categorySignals = CATEGORY_SIGNALS[product.category] ?? [];
  const categoryHits = categorySignals.filter((signal) => containsPhrase(fullContext, signal)).length;
  score += Math.min(16, categoryHits * 4);

  if (product.description) {
    const descriptionTokens = meaningfulTokens(product.description).slice(0, 20);
    const overlap = descriptionTokens.filter((token) => containsPhrase(`${heading} ${section}`, token)).length;
    score += Math.min(10, overlap * 2);
  }

  const legacySlugs = (product as SmartAffiliateProduct & { slugs?: string[] }).slugs;
  if (legacySlugs?.some((item) => context.slug.includes(item))) score += 100;

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
