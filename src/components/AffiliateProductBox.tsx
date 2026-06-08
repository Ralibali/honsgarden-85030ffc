import { useMemo } from 'react';
import { ExternalLink, ShoppingBag } from 'lucide-react';
import { matchProductsForArticle } from '@/data/affiliateProducts';
import { AffiliateLink } from '@/components/AffiliateLink';
import { useLiveBySku, skuFromTrackingUrl, priceToNumber } from '@/hooks/useAffiliateProducts';

interface Props {
  slug: string;
  title: string;
  /** HTML eller text – används för keyword-matchning. */
  content: string;
  limit?: number;
}

/**
 * Visar 1–3 kontextuellt relevanta affiliate-produkter i botten av ett blogginlägg.
 * Matchningen sker på den kurerade statiska katalogen (keywords), men pris och
 * lagerstatus overlay:as från DB-katalogen (feed-synken) när produkten finns där.
 * Slutsålda produkter döljs. Renderar inget om inga produkter matchar.
 */
export function AffiliateProductBox({ slug, title, content, limit = 3 }: Props) {
  const liveBySku = useLiveBySku();

  const products = useMemo(() => {
    const matched = matchProductsForArticle(slug, title, content, limit + 3);
    const merged = matched.map((p) => {
      const live = liveBySku.get(skuFromTrackingUrl(p.trackingUrl) ?? '');
      if (!live) return p;
      return {
        ...p,
        price: live.price || p.price,
        priceOriginal: live.priceOriginal,
        inStock: live.inStock,
        trackingUrl: live.trackingUrl || p.trackingUrl,
        imageUrl: live.imageUrl || p.imageUrl,
      };
    });
    return merged.filter((p) => p.inStock !== false).slice(0, limit);
  }, [slug, title, content, limit, liveBySku]);

  if (products.length === 0) return null;

  return (
    <aside
      className="my-10 rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/30 p-5 sm:p-6"
      aria-label="Rekommenderade produkter"
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <h3 className="font-serif text-base sm:text-lg text-foreground m-0">
            Utvalt för dig som har höns
          </h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
          Annons
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {products.map((p) => {
          const orig = p.priceOriginal && p.priceOriginal > (priceToNumber(p.price) ?? 0) ? p.priceOriginal : null;
          return (
            <AffiliateLink
              key={p.id}
              href={p.trackingUrl}
              productId={p.id}
              advertiser={p.advertiser}
              source="product_box"
              slug={slug}
              className="group flex sm:flex-col items-stretch gap-3 rounded-xl border border-border/60 bg-background overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
            >
              <div className="relative w-24 sm:w-full aspect-square sm:aspect-[4/3] bg-muted shrink-0 overflow-hidden">
                {orig && (
                  <span className="absolute top-1 left-1 z-10 rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold px-1.5 py-0.5">
                    Rea
                  </span>
                )}
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="flex-1 min-w-0 p-3 sm:pt-0 flex flex-col">
                <p className="text-xs font-medium text-foreground line-clamp-2 mb-1">{p.name}</p>
                <p className="text-sm font-semibold text-primary mb-2">
                  {p.price}
                  {orig && (
                    <span className="ml-1.5 text-[11px] font-normal line-through text-muted-foreground">
                      {orig.toLocaleString('sv-SE')} kr
                    </span>
                  )}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                  Visa hos {p.advertiser === 'p-lindberg' ? 'P. Lindberg' : 'Bonden.se'}
                  <ExternalLink className="h-2.5 w-2.5 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </AffiliateLink>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-4 mb-0">
        Affiliatelänkar – vi kan få en liten ersättning vid köp, utan extra kostnad för dig.
      </p>
    </aside>
  );
}

export default AffiliateProductBox;
