import { useMemo } from 'react';
import { ExternalLink, Award, PiggyBank, Crown } from 'lucide-react';
import { AffiliateLink } from '@/components/AffiliateLink';
import { useSmartAffiliateCatalog } from '@/hooks/useSmartAffiliateCatalog';
import { matchSmartProducts, affiliateAdvertiserName, affiliateReason, type SmartAffiliateProduct } from '@/lib/smartAffiliate';
import { computeBuyIntent, shouldShowRecommendedProducts } from '@/lib/buyIntent';

interface Props {
  slug: string;
  title: string;
  content: string;
  category?: string | null;
  tags?: string[] | null;
  excerpt?: string | null;
}

interface Labeled {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  product: SmartAffiliateProduct;
  reason: string;
}

function parsePrice(p: SmartAffiliateProduct): number {
  if (!p.price) return Number.POSITIVE_INFINITY;
  const m = String(p.price).replace(/\s/g, '').match(/(\d+[.,]?\d*)/);
  return m ? Number(m[1].replace(',', '.')) : Number.POSITIVE_INFINITY;
}

function labelProducts(products: SmartAffiliateProduct[]): Labeled[] {
  if (products.length === 0) return [];
  const sortedByPrice = [...products].sort((a, b) => parsePrice(a) - parsePrice(b));
  const cheapest = sortedByPrice[0];
  const premium = sortedByPrice[sortedByPrice.length - 1];
  const best = products[0];
  const labeled: Labeled[] = [];
  const used = new Set<string>();
  labeled.push({ label: 'Bäst totalt', icon: Award, product: best, reason: affiliateReason(best) });
  used.add(best.id);
  if (!used.has(cheapest.id)) {
    labeled.push({ label: 'Mest prisvärd', icon: PiggyBank, product: cheapest, reason: affiliateReason(cheapest) });
    used.add(cheapest.id);
  }
  if (!used.has(premium.id) && parsePrice(premium) > parsePrice(cheapest) * 1.4) {
    labeled.push({ label: 'Premiumval', icon: Crown, product: premium, reason: affiliateReason(premium) });
  }
  return labeled.slice(0, 3);
}

export function RecommendedProducts({ slug, title, content, category, tags, excerpt }: Props) {
  const catalog = useSmartAffiliateCatalog();
  const intent = useMemo(
    () => computeBuyIntent({ title, slug, category, tags, excerpt }),
    [title, slug, category, tags, excerpt],
  );

  const products = useMemo(() => {
    if (intent.suppress) return [];
    return matchSmartProducts(catalog, { slug, title, heading: title, text: content }, 5);
  }, [catalog, slug, title, content, intent.suppress]);

  const labeled = useMemo(() => labelProducts(products), [products]);
  const show = useMemo(
    () => shouldShowRecommendedProducts({ title, slug, category, tags, excerpt }, labeled.length),
    [title, slug, category, tags, excerpt, labeled.length],
  );

  if (!show || labeled.length < 2) return null;

  return (
    <section className="my-10 rounded-2xl border border-primary/20 bg-gradient-to-br from-secondary/30 to-card p-5" aria-label="Rekommenderade produkter">
      <div className="flex items-baseline justify-between gap-2 mb-4">
        <h2 className="font-serif text-xl text-foreground m-0">Rekommenderade produkter</h2>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Annonslänkar</span>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Urval baserat på artikelns innehåll. Vi kan få ersättning om du handlar via länken – utan extra kostnad för dig.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {labeled.map(({ label, icon: Icon, product, reason }) => (
          <article key={product.id} className="flex flex-col rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary text-xs font-medium">
              <Icon className="h-3.5 w-3.5" /> {label}
            </div>
            <div className="aspect-square bg-muted/40 flex items-center justify-center p-4">
              <img src={product.imageUrl} alt={product.name} loading="lazy" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="p-3 flex flex-col gap-2 flex-1">
              <p className="text-sm font-medium text-foreground line-clamp-2 m-0">{product.name}</p>
              <p className="text-xs text-muted-foreground m-0 line-clamp-3">{reason}</p>
              <div className="mt-auto flex items-baseline justify-between gap-2 pt-2">
                <span className="text-base font-bold text-primary">{product.price || 'Se pris'}</span>
                <span className="text-[10px] text-muted-foreground">{affiliateAdvertiserName(product)}</span>
              </div>
              <AffiliateLink
                href={product.trackingUrl}
                productId={product.id}
                advertiser={product.advertiser}
                source="product_box"
                slug={slug}
                sectionTitle={label}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 hover:opacity-90"
              >
                Se hos {affiliateAdvertiserName(product)} <ExternalLink className="h-3 w-3" />
              </AffiliateLink>
            </div>
          </article>
        ))}
      </div>

      {labeled.length >= 3 && (
        <div className="mt-6 overflow-x-auto -mx-1 px-1">
          <table className="w-full text-xs border-collapse min-w-[520px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Produkt</th>
                <th className="py-2 pr-3 font-medium">Passar bäst för</th>
                <th className="py-2 pr-3 font-medium">Pris</th>
                <th className="py-2 pr-3 font-medium">Butik</th>
                <th className="py-2 pr-3 font-medium sr-only">Handla</th>
              </tr>
            </thead>
            <tbody>
              {labeled.map(({ label, product }) => (
                <tr key={product.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 font-medium text-foreground">{product.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{label}</td>
                  <td className="py-2 pr-3 stat-number text-primary">{product.price || '—'}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{affiliateAdvertiserName(product)}</td>
                  <td className="py-2 pr-3">
                    <AffiliateLink
                      href={product.trackingUrl}
                      productId={product.id}
                      advertiser={product.advertiser}
                      source="comparison"
                      slug={slug}
                      sectionTitle={label}
                      className="text-primary underline underline-offset-2"
                    >
                      Se pris
                    </AffiliateLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default RecommendedProducts;
