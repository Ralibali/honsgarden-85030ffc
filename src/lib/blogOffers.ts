import { AVAILABLE_DIGITAL_PRODUCTS, DIGITAL_PRODUCT_CATALOG, type DigitalProductSlug } from './digitalProducts';

export type BlogOfferProduct = DigitalProductSlug;
export type BlogOfferVariant = `${DigitalProductSlug}:${'plan' | 'tools' | 'sample'}`;
export interface BlogOffer { id: BlogOfferVariant; product: BlogOfferProduct; title: string; body: string }
const SLUGS = AVAILABLE_DIGITAL_PRODUCTS.map(p => p.slug);
const FORMS = ['plan', 'tools', 'sample'] as const;
const COPY: Record<DigitalProductSlug, [string, string, string]> = {
  'fran-honsgard-till-aggbod': ['Från egna ägg till första kunden', 'Ge äggförsäljningen en genomtänkt början', 'Bläddra i handboken om äggförsäljning'],
  'mina-forsta-hons': ['Planera dina första höns', 'Från läsning till en egen plan', 'Bläddra i startpaketet'],
  'vinterklar-honsgard': ['Gör hönsgården vinterklar', 'En vinterplan att använda', 'Titta in i vinterboken'],
  'aggbodens-saljpaket': ['Gör äggboden tydlig för kunden', 'Skyltar med ditt eget namn', 'Prova en skylt före köp'],
  'klackdagboken': ['Ge nästa kläckning en egen dagbok', 'Samla observationerna på ett ställe', 'Bläddra i Kläckdagboken'],
};

/** All current and future articles qualify. Topic selects the product; copies rotate. */
export function selectBlogOffer(slug: string, category?: string | null, previous?: string | null): BlogOffer {
  const context = `${category ?? ''}:${slug}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const hash = Array.from(context).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  const relevant: DigitalProductSlug | null = /vinter|frost|kyla|varme/.test(context) ? 'vinterklar-honsgard'
    : /skylt|kundkort|prislista/.test(context) ? 'aggbodens-saljpaket'
    : /salja|aggbod|forsalj|aggpris|agg-ekonomi/.test(context) ? 'fran-honsgard-till-aggbod'
    : /klack|ruv|befrukt|kyckling/.test(context) ? 'klackdagboken'
    : /nyborjar|skaffa|borja-med|honsras|raser|orpington|sussex/.test(context) ? 'mina-forsta-hons' : null;
  const availableRelevant = relevant && DIGITAL_PRODUCT_CATALOG[relevant].saleStatus !== 'preparing' ? relevant
    : relevant === 'fran-honsgard-till-aggbod' ? 'aggbodens-saljpaket' : null;
  let productSlug = availableRelevant ?? SLUGS[hash % SLUGS.length];
  if (!availableRelevant && previous?.startsWith(`${productSlug}:`)) productSlug = SLUGS[(SLUGS.indexOf(productSlug) + 1) % SLUGS.length];
  let variant = Math.floor(hash / SLUGS.length) % FORMS.length;
  if (`${productSlug}:${FORMS[variant]}` === previous) variant = (variant + 1) % FORMS.length;
  const product = DIGITAL_PRODUCT_CATALOG[productSlug];
  return { id: `${productSlug}:${FORMS[variant]}`, product: productSlug, title: COPY[productSlug][variant],
    body: variant === 2 ? `Se ${product.samplePages} riktiga sidor ur ${product.title}. Läs och prova formulär innan du bestämmer dig.` : product.description };
}
