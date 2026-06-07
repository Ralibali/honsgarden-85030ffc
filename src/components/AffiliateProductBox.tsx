import { ExternalLink, ShoppingBag } from 'lucide-react';
import { matchProductsForArticle } from '@/data/affiliateProducts';

interface Props {
  slug: string;
  title: string;
  /** HTML eller text – används för keyword-matchning. */
  content: string;
  limit?: number;
}

/**
 * Visar 1–3 kontextuellt relevanta affiliate-produkter i botten av ett blogginlägg.
 * Renderar inget om inga produkter matchar (då undviker vi tomma "annonsboxar").
 */
export function AffiliateProductBox({ slug, title, content, limit = 3 }: Props) {
  const products = matchProductsForArticle(slug, title, content, limit);
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
        {products.map((p) => (
          <a
            key={p.id}
            href={p.trackingUrl}
            target="_blank"
            rel="sponsored noopener noreferrer"
            className="group flex sm:flex-col items-stretch gap-3 rounded-xl border border-border/60 bg-background overflow-hidden hover:border-primary/40 hover:shadow-md transition-all"
          >
            <div className="w-24 sm:w-full aspect-square sm:aspect-[4/3] bg-muted shrink-0 overflow-hidden">
              <img
                src={p.imageUrl}
                alt={p.name}
                loading="lazy"
                className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex-1 min-w-0 p-3 sm:pt-0 flex flex-col">
              <p className="text-xs font-medium text-foreground line-clamp-2 mb-1">{p.name}</p>
              <p className="text-sm font-semibold text-primary mb-2">{p.price}</p>
              <span className="mt-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                Visa hos {p.advertiser === 'p-lindberg' ? 'P. Lindberg' : 'Bonden.se'}
                <ExternalLink className="h-2.5 w-2.5 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </a>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-4 mb-0">
        Affiliatelänkar – vi kan få en liten ersättning vid köp, utan extra kostnad för dig.
      </p>
    </aside>
  );
}

export default AffiliateProductBox;
