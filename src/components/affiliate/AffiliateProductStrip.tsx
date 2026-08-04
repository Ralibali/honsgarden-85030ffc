import React from 'react';
import { useAffiliateProducts } from '@/hooks/useAffiliateProducts';
import type { AffiliateProduct } from '@/data/affiliateProducts';
import { AFFILIATE_ENABLED } from '@/lib/featureFlags';
import { trackAffiliateClick } from '@/lib/affiliateTracking';
import { trackClick } from '@/hooks/useTracking';

type Category = AffiliateProduct['category'];

interface Props {
  category: Category;
  title: string;
  limit?: number;
}

const ADVERTISER_LABEL: Record<string, string> = {
  'p-lindberg': 'P. Lindberg',
  bonden: 'Bonden.se',
};

export default function AffiliateProductStrip({ category, title, limit = 3 }: Props) {
  const { data, isLoading } = useAffiliateProducts(AFFILIATE_ENABLED);

  if (!AFFILIATE_ENABLED || isLoading) return null;

  const products = (data ?? [])
    .filter((p) => p.category === category)
    .sort((a, b) => Number(b.inStock !== false) - Number(a.inStock !== false))
    .slice(0, limit);

  if (products.length === 0) return null;

  const pageName = typeof window !== 'undefined' ? window.location.pathname : '';

  const handleClick = (p: AffiliateProduct) => {
    try {
      trackAffiliateClick({
        product_id: p.id,
        advertiser: p.advertiser,
        source: 'app_widget',
        href: p.trackingUrl,
      });
      trackClick('affiliate_click', {
        elementId: p.id,
        elementText: p.name,
        metadata: { external_id: p.id, page: pageName, category },
      });
    } catch {
      /* no-op */
    }
  };

  return (
    <section className="mt-8" aria-label={title}>
      <div className="flex items-baseline justify-between gap-2 mb-3 px-1">
        <h2 className="font-serif text-base sm:text-lg text-foreground">{title}</h2>
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Annonslänkar
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {products.map((p) => {
          const onSale =
            typeof p.priceOriginal === 'number' &&
            !Number.isNaN(p.priceOriginal) &&
            p.priceOriginal > 0;
          return (
            <a
              key={p.id}
              href={p.trackingUrl}
              target="_blank"
              rel="sponsored noopener"
              onClick={() => handleClick(p)}
              className="snap-start shrink-0 w-40 sm:w-48 bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
            >
              <div className="aspect-square bg-muted/40 flex items-center justify-center overflow-hidden">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  loading="lazy"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="p-2.5 flex flex-col gap-1 flex-1">
                <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                  {p.name}
                </p>
                <div className="mt-auto flex items-baseline gap-1.5">
                  <span className="stat-number text-sm text-primary">{p.price}</span>
                  {onSale && (
                    <span className="text-[10px] line-through text-muted-foreground">
                      {p.priceOriginal} kr
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {ADVERTISER_LABEL[p.advertiser] ?? p.advertiser}
                </p>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}
