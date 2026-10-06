import { matchSmartProducts, normalizeAffiliateText, type SmartAffiliateProduct } from '@/lib/smartAffiliate';

/**
 * Turns the first mention of a concrete product type in article text
 * ("vattenautomat", "värmelampa" …) into a tracked link to the best matching
 * product in the catalog. Only product nouns are linked, never generic words,
 * and never inside headings, existing links, captions or code.
 */

/** Product nouns worth linking. Longer, more specific terms first. */
export const IN_TEXT_PRODUCT_TERMS = [
  'automatisk hönslucka', 'automatisk lucköppnare', 'lucköppnare',
  'uppvärmd vattenautomat', 'vattenautomat', 'vattenkopp', 'vattennippel', 'värmeplatta', 'värmelampa',
  'foderautomat', 'fodertråg', 'fodertunna', 'fodersilo',
  'snäckskal', 'ostronskal',
  'äggkläckningsmaskin', 'kläckmaskin', 'äggkläckare', 'ruvmaskin', 'ägglampa',
  'värprede', 'hönsnät', 'elstängselnät', 'elstängsel', 'rastgård', 'startset',
] as const;

// Same inflections as the matching engine ("vattenautomaten", "värmelamporna").
const SUFFIX = '(?:en|et|er|ar|or|na|n|t|a|s|erna|arna|orna|ens|ets)?';
const LETTER = '[\\p{L}\\p{N}]';
const SKIP_TAGS = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'figcaption', 'code', 'pre', 'button', 'summary', 'script', 'style']);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stem(term: string): string {
  // "värmelampa" → "värmelamp" so "värmelampor" also matches.
  return term.endsWith('a') ? term.slice(0, -1) : term;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/** Products that show this term in their name or keywords. */
function candidatesFor(term: string, catalog: SmartAffiliateProduct[]): SmartAffiliateProduct[] {
  const normalized = normalizeAffiliateText(term);
  return catalog.filter((product) => normalizeAffiliateText(product.name).includes(normalized)
    || (product.keywords ?? []).some((keyword) => normalizeAffiliateText(keyword) === normalized));
}

export function maxInTextProductLinks(html: string): number {
  const words = html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
  return Math.min(3, Math.max(1, Math.floor(words / 350)));
}

export function linkProductMentions(
  html: string,
  catalog: SmartAffiliateProduct[],
  { slug, title, max = maxInTextProductLinks(html) }: { slug: string; title: string; max?: number },
): string {
  if (!html || catalog.length === 0 || max <= 0) return html;

  const used = new Set<string>();
  const linkedTerms = new Set<string>();
  let linked = 0;
  const skipStack: string[] = [];

  return html.replace(/(<[^>]+>)|([^<]+)/g, (segment, tag: string | undefined, text: string | undefined) => {
    if (tag) {
      const match = tag.match(/^<\s*(\/)?\s*([a-z0-9]+)/i);
      if (match) {
        const name = match[2].toLowerCase();
        if (SKIP_TAGS.has(name) && !/\/>$/.test(tag)) {
          if (match[1]) {
            const index = skipStack.lastIndexOf(name);
            if (index >= 0) skipStack.splice(index, 1);
          } else {
            skipStack.push(name);
          }
        }
      }
      return segment;
    }
    if (!text || skipStack.length > 0 || linked >= max) return segment;

    let out = text;
    for (const term of IN_TEXT_PRODUCT_TERMS) {
      if (linked >= max) break;
      if (linkedTerms.has(term)) continue;
      const pattern = new RegExp(`(?<!${LETTER})(${escapeRegExp(stem(term))}${term.endsWith('a') ? `(?:a|or|orna|an|ans)?` : SUFFIX})(?!${LETTER})`, 'iu');
      const found = out.match(pattern);
      if (!found || found.index == null) continue;
      const [product] = matchSmartProducts(
        candidatesFor(term, catalog),
        { slug, title, heading: term, text: out },
        1,
        used,
      );
      if (!product) continue;

      const word = found[1];
      const anchor = `<a href="${escapeAttribute(product.trackingUrl)}" target="_blank" rel="sponsored noopener" data-intext-product="${escapeAttribute(product.id)}" title="${escapeAttribute(`${product.name} – annonslänk`)}">${word}</a>`;
      out = `${out.slice(0, found.index)}${anchor}${out.slice(found.index + word.length)}`;
      used.add(product.id);
      linkedTerms.add(term);
      linked += 1;
      // The rest of this text node now contains an anchor; continue with the next node.
      break;
    }
    return out;
  });
}
