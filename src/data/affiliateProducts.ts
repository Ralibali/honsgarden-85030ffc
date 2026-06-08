/**
 * Kuraterad affiliate-produktkatalog för blogginlägg.
 * Endast produkter som finns i lager hos annonsörerna (P. Lindberg via Adtraction, Bonden.se via Adtraction).
 * Tracking-URL:erna kommer direkt från respektive produktfeed.
 *
 * `keywords` används för automatisk matchning mot artikelinnehåll/slug.
 * `slugs` är explicita blogginlägg där produkten ska visas (om tomt = matcha på keywords).
 */

export type AffiliateAdvertiser = 'p-lindberg' | 'bonden';

export interface AffiliateProduct {
  id: string;
  advertiser: AffiliateAdvertiser;
  name: string;
  price: string;
  imageUrl: string;
  trackingUrl: string;
  keywords: string[]; // matcha mot tolower(slug + title + content)
  slugs?: string[]; // valfritt: tvinga visning på dessa slugs
  category: 'vatten' | 'foder' | 'vaerme' | 'hus' | 'klackning' | 'staengsel' | 'redskap' | 'tillskott' | 'startset';
  /** Live-fält (sätts av DB-katalogen). undefined = behandlas som i lager. */
  inStock?: boolean;
  /** Ordinarie pris (numeriskt) för rea-märke. */
  priceOriginal?: number;
  /** Direktlänk till produktsidan (utan affiliate-redirect). */
  productUrl?: string;
}

export const AFFILIATE_PRODUCTS: AffiliateProduct[] = [
  // ====== VATTEN ======
  {
    id: 'pl-flottoervattenkopp',
    advertiser: 'p-lindberg',
    name: 'Flottörvattenkopp för höns',
    price: '175 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9063894_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9063894&url=https://www.p-lindberg.se/flottoervattenkopp-hoens-9063894/',
    keywords: ['vattenautomat', 'vattenkopp', 'dricka', 'vattenförsörjning', 'flottör'],
    category: 'vatten',
  },
  {
    id: 'pl-vaermehink',
    advertiser: 'p-lindberg',
    name: 'Värmehink 20 liter – frostskydd',
    price: '1 175 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9068365_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9068365&url=https://www.p-lindberg.se/vaermehink-20-liter-9068365/',
    keywords: ['vinter', 'frost', 'fryser', 'kall', 'värmehink', 'vattenautomat'],
    category: 'vatten',
  },
  {
    id: 'bonden-vaermeplatta-25',
    advertiser: 'bonden',
    name: 'Värmeplatta 25 cm – vattenautomat (20 W)',
    price: '349 kr',
    imageUrl: 'https://bonden.b-cdn.net/80695/varmeplatta-25-cm-for-vattenautomat-hons-och-fjaderfa-20-watt.jpg',
    trackingUrl: 'https://pin.bonden.se/t/t?a=1960530621&as=2056181186&t=2&tk=1&cupa_sku=DBV25&url=https://www.bonden.se/vaermeplatta/80695-varmeplatta-25-cm-for-vattenautomat-hons-och-fjaderfa-20-watt-8718426004558.html',
    keywords: ['värmeplatta', 'vinter', 'frost', 'vattenautomat'],
    category: 'vatten',
  },

  // ====== VÄRME ======
  {
    id: 'pl-vaermelampa-150',
    advertiser: 'p-lindberg',
    name: 'Värmelampa 150 W – för höns',
    price: '985 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9017432_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9017432&url=https://www.p-lindberg.se/vaermelampa-150w-9017432/',
    keywords: ['värmelampa', 'värme', 'kyckling', 'vinter', 'kläckning'],
    category: 'vaerme',
  },
  {
    id: 'pl-vaermelampa-roed',
    advertiser: 'p-lindberg',
    name: 'Värmelampa 100 W – röd',
    price: '1 060 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9044846_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9044846&url=https://www.p-lindberg.se/vaermelampa-100-w-roed-9044846/',
    keywords: ['värmelampa', 'röd', 'kyckling', 'kläckning'],
    category: 'vaerme',
  },

  // ====== HUS & LUCKA ======
  {
    id: 'pl-hoenshus-xl',
    advertiser: 'p-lindberg',
    name: 'Hönshus XL – med utegård',
    price: '13 745 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9061609_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9061609&url=https://www.p-lindberg.se/hoenshus-xl-9061609/',
    keywords: ['hönshus', 'bygga', 'nybörjare', 'skaffa höns'],
    category: 'hus',
  },
  {
    id: 'pl-hoenshus',
    advertiser: 'p-lindberg',
    name: 'Hönshus med utegård',
    price: '7 370 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9064905_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9064905&url=https://www.p-lindberg.se/hoenshus-9064905/',
    keywords: ['hönshus', 'bygga', 'nybörjare', 'skaffa höns'],
    category: 'hus',
  },
  {
    id: 'pl-auto-lucka',
    advertiser: 'p-lindberg',
    name: 'Automatisk lucköppnare till hönshuset',
    price: '2 120 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9059042_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9059042&url=https://www.p-lindberg.se/automatisk-luckoeppnare-9059042/',
    keywords: ['lucka', 'räv', 'rovdjur', 'hönshus', 'säkerhet', 'automatisk'],
    category: 'hus',
  },

  // ====== VÄRPREDE ======
  {
    id: 'pl-vaerprede-poppis',
    advertiser: 'p-lindberg',
    name: 'Värprede "Poppis" – 2 rum',
    price: '700 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9063893_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9063893&url=https://www.p-lindberg.se/vaerprede-poppis-9063893/',
    keywords: ['värprede', 'värpa', 'rede', 'fastsittande ägg'],
    category: 'hus',
  },
  {
    id: 'pl-redaegg',
    advertiser: 'p-lindberg',
    name: 'Redägg – 5 st (lockar till värpredet)',
    price: '135 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9061301_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9061301&url=https://www.p-lindberg.se/redaegg-5-st-9061301/',
    keywords: ['redägg', 'värprede', 'värper på golvet'],
    category: 'hus',
  },

  // ====== KLÄCKNING ======
  {
    id: 'pl-klackmaskin-eggtech',
    advertiser: 'p-lindberg',
    name: 'Äggkläckningsmaskin Eggtech – 12 ägg',
    price: '3 115 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9066845_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9066845&url=https://www.p-lindberg.se/aeggklaeckningsmaskin-12-aegg-eggtech-9066845/',
    keywords: ['kläckmaskin', 'kläcka', 'ruvning', 'kyckling', 'äggkläckning'],
    category: 'klackning',
  },
  {
    id: 'pl-klackmaskin-hhd',
    advertiser: 'p-lindberg',
    name: 'Äggkläckningsmaskin HHD Mini – 12 ägg',
    price: '1 120 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9066846_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9066846&url=https://www.p-lindberg.se/aeggklaeckningsmaskin-12-aegg-hhd-mini-9066846/',
    keywords: ['kläckmaskin', 'kläcka', 'ruvning', 'nybörjare'],
    category: 'klackning',
  },
  {
    id: 'pl-klackmaskin-willab',
    advertiser: 'p-lindberg',
    name: 'Willab äggkläckningsmaskin – 22 ägg',
    price: '2 495 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9071676_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9071676&url=https://www.p-lindberg.se/willab-aeggklaeckningsmaskin-22-aegg-9071676/',
    keywords: ['kläckmaskin', 'kläcka', 'ruvning'],
    category: 'klackning',
  },

  // ====== STÄNGSEL ======
  {
    id: 'pl-elstaengsel-50m',
    advertiser: 'p-lindberg',
    name: 'Elstängselnät för höns – 50 m',
    price: '1 720 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9067854_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9067854&url=https://www.p-lindberg.se/elstaengselnaet-hoens-50-meter-9067854/',
    keywords: ['stängsel', 'elstängsel', 'räv', 'rovdjur', 'inhägnad'],
    category: 'staengsel',
  },
  {
    id: 'pl-hoensnaet',
    advertiser: 'p-lindberg',
    name: 'Hönsnät galvaniserat',
    price: '825 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9040210_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9040210&url=https://www.p-lindberg.se/hoensnaet-galvaniserad-9040210/',
    keywords: ['hönsnät', 'stängsel', 'inhägnad', 'bygga'],
    category: 'staengsel',
  },

  // ====== FODER & TILLSKOTT ======
  {
    id: 'pl-snaeckskal',
    advertiser: 'p-lindberg',
    name: 'Snäckskal till höns – 15 kg (kalcium)',
    price: '120 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9067588_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9067588&url=https://www.p-lindberg.se/snaeckskal-till-hoens-15-kg-9067588/',
    keywords: ['kalcium', 'snäckskal', 'ostronskal', 'äggskal', 'kalkben', 'foder'],
    category: 'tillskott',
  },
  {
    id: 'pl-fodertraag',
    advertiser: 'p-lindberg',
    name: 'Fodertråg till höns',
    price: '110 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9035331-main_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9035331-main&url=https://www.p-lindberg.se/fodertraag-till-hoens-9035331-main/',
    keywords: ['foder', 'fodertråg', 'utfodring', 'vad äter'],
    category: 'foder',
  },
  {
    id: 'pl-fodertunna-46',
    advertiser: 'p-lindberg',
    name: 'Fodertunna med lock – 46 liter',
    price: '360 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9071278_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9071278&url=https://www.p-lindberg.se/fodertunna-med-lock-46-liter-9071278/',
    keywords: ['foder', 'förvaring', 'fodertunna', 'råttor'],
    category: 'foder',
  },

  // ====== STARTSET ======
  {
    id: 'pl-startset-bas',
    advertiser: 'p-lindberg',
    name: 'Startset Höns – Bas (komplett paket)',
    price: '14 745 kr',
    imageUrl: 'https://p-lindberg.b-cdn.net/media/1c/5d/1c/1704711326/9067617_zoom_1.jpg?width=600',
    trackingUrl: 'https://do.p-lindberg.se/t/t?a=1954027468&as=2056181186&t=2&tk=1&cupa_sku=9067617&url=https://www.p-lindberg.se/startset-hoens-bas-9067617/',
    keywords: ['nybörjare', 'skaffa höns', 'startpaket', 'komma igång', 'startset'],
    category: 'startset',
  },
];

// ====== BANNERS (Bonden.se via Adtraction) ======
export interface AffiliateBanner {
  id: string;
  href: string;
  imgSrc: string;
  width: number;
  height: number;
  alt: string;
  /** Layout: 'sky' = vertikal skyskrapa, 'wide' = bred horisontell. */
  layout: 'sky' | 'wide';
}

export const AFFILIATE_BANNERS: AffiliateBanner[] = [
  {
    id: 'bonden-sky-160',
    href: 'https://pin.bonden.se/t/t?a=1960530789&as=2056181186&t=2&tk=1',
    imgSrc: 'https://track.adtraction.com/t/t?a=1960530789&as=2056181186&t=1&tk=1&i=1',
    width: 160,
    height: 600,
    alt: 'Bonden.se – allt för gården',
    layout: 'sky',
  },
  {
    id: 'bonden-wide-600',
    href: 'https://pin.bonden.se/t/t?a=1960530731&as=2056181186&t=2&tk=1',
    imgSrc: 'https://track.adtraction.com/t/t?a=1960530731&as=2056181186&t=1&tk=1&i=1',
    width: 600,
    height: 120,
    alt: 'Bonden.se – utrustning för dig som har djur',
    layout: 'wide',
  },
  {
    id: 'bonden-wide-670',
    href: 'https://pin.bonden.se/t/t?a=1960530630&as=2056181186&t=2&tk=1',
    imgSrc: 'https://track.adtraction.com/t/t?a=1960530630&as=2056181186&t=1&tk=1&i=1',
    width: 670,
    height: 99,
    alt: 'Bonden.se – din lanthandel på nätet',
    layout: 'wide',
  },
];

/** Deterministisk hash av en sträng (djb2). Används för stabil rotation per slug. */
function hashSlug(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Väljer 0 eller 1 banner deterministiskt per slug.
 * Distribution: 25% ingen banner, 25% var av de tre bannrarna.
 * Garanterar att samma artikel alltid visar samma banner men att fördelningen blir jämn.
 */
export function pickBannerForSlug(slug: string): AffiliateBanner | null {
  const bucket = hashSlug(slug) % 4;
  if (bucket === 0) return null; // 25% utan banner – minskar "fullsmetad"-känsla
  return AFFILIATE_BANNERS[bucket - 1] ?? null;
}

/**
 * Matchar produkter mot artikelns slug + titel + brödtext.
 * Returnerar max 3 produkter, gärna från olika kategorier.
 */
export function matchProductsForArticle(
  slug: string,
  title: string,
  content: string,
  limit = 3,
  products: AffiliateProduct[] = AFFILIATE_PRODUCTS,
): AffiliateProduct[] {
  const haystack = `${slug} ${title} ${content}`.toLowerCase();
  const scored = products
    .filter((p) => p.inStock !== false)
    .map((p) => {
      let score = 0;
      if (p.slugs?.some((s) => slug.includes(s))) score += 100;
      for (const kw of p.keywords) {
        if (haystack.includes(kw.toLowerCase())) score += 1;
      }
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Sprid över kategorier
  const seenCat = new Set<string>();
  const picks: AffiliateProduct[] = [];
  for (const { p } of scored) {
    if (picks.length >= limit) break;
    if (seenCat.has(p.category)) continue;
    seenCat.add(p.category);
    picks.push(p);
  }
  // Om vi inte fyllde upp – tillåt samma kategori
  if (picks.length < limit) {
    for (const { p } of scored) {
      if (picks.length >= limit) break;
      if (!picks.includes(p)) picks.push(p);
    }
  }
  return picks;
}
