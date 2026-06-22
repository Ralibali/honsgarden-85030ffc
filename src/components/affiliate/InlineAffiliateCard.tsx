import { useEffect, useRef, useState } from 'react';
import { ExternalLink, ImageOff, ShoppingBag, Sparkles } from 'lucide-react';
import { AffiliateLink } from '@/components/AffiliateLink';
import { trackAffiliateImpression } from '@/lib/affiliateTracking';
import {
  affiliateAdvertiserName,
  affiliateReason,
  type SmartAffiliateProduct,
} from '@/lib/smartAffiliate';

function ProductImage({ product }: { product: SmartAffiliateProduct }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.imageUrl]);

  if (failed || !product.imageUrl) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
        <ImageOff className="h-8 w-8" aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      src={product.imageUrl}
      alt={product.name}
      loading="lazy"
      referrerPolicy="no-referrer"
      className="h-full w-full object-contain p-3 transition-transform duration-300 group-hover:scale-105"
      onError={() => setFailed(true)}
    />
  );
}

export function InlineAffiliateCard({
  product,
  slug,
  sectionTitle,
}: {
  product: SmartAffiliateProduct;
  slug: string;
  sectionTitle?: string;
}) {
  const hasDiscount = Boolean(
    product.priceOriginal
      && Number.isFinite(product.priceOriginal)
      && product.priceOriginal > 0,
  );

  const containerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      trackAffiliateImpression({
        product_id: product.id,
        advertiser: product.advertiser,
        source: 'product_box',
        slug,
        section_title: sectionTitle ?? null,
      });
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            trackAffiliateImpression({
              product_id: product.id,
              advertiser: product.advertiser,
              source: 'product_box',
              slug,
              section_title: sectionTitle ?? null,
            });
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [product.id, product.advertiser, slug, sectionTitle]);

  return (
    <aside
      ref={containerRef as React.RefObject<HTMLElement>}
      className="my-8 overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-card via-card to-secondary/25 shadow-sm"
      aria-label={`Produktförslag: ${product.name}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="m-0 font-serif text-base font-medium text-foreground">Agdas produktips</p>
            <p className="m-0 mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {sectionTitle
                ? `Valt utifrån avsnittet “${sectionTitle}”.`
                : 'Automatiskt valt utifrån innehållet i guiden.'}
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Affiliatelänk
        </span>
      </div>

      <AffiliateLink
        href={product.trackingUrl}
        productId={product.id}
        advertiser={product.advertiser}
        source="product_box"
        slug={slug}
        sectionTitle={sectionTitle ?? null}
        className="group grid overflow-hidden bg-background/70 transition-colors hover:bg-background sm:grid-cols-[190px_1fr]"
      >
        <span className="relative block min-h-48 bg-white/80 sm:min-h-full">
          {hasDiscount && (
            <span className="absolute left-2 top-2 z-10 rounded-full bg-destructive px-2 py-1 text-[10px] font-semibold text-destructive-foreground">
              Rea
            </span>
          )}
          <ProductImage product={product} />
        </span>

        <span className="flex min-w-0 flex-col p-4 sm:p-5">
          <span className="mb-1 text-base font-semibold leading-snug text-foreground sm:text-lg">
            {product.name}
          </span>
          <span className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {affiliateReason(product)}
          </span>

          <span className="mt-auto flex flex-wrap items-end justify-between gap-3">
            <span>
              <span className="block text-lg font-bold text-primary">{product.price || 'Se aktuellt pris'}</span>
              {hasDiscount && (
                <span className="text-xs text-muted-foreground line-through">
                  {product.priceOriginal?.toLocaleString('sv-SE')} kr
                </span>
              )}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity group-hover:opacity-90">
              Se hos {affiliateAdvertiserName(product)}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </span>
        </span>
      </AffiliateLink>

      <div className="flex items-start gap-2 border-t border-border/60 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground sm:px-5">
        <ShoppingBag className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>
          Vi kan få ersättning om du handlar via länken, utan extra kostnad för dig.
          Pris och lagerstatus kan ändras hos butiken.
        </span>
      </div>
    </aside>
  );
}

export default InlineAffiliateCard;
