import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatSek } from '@/lib/shopCart';
import { primaryImage, type ShopProduct } from '@/lib/shop/api';

interface Props {
  product: ShopProduct;
  onAdd: (product: ShopProduct) => void;
}

export function ProductCard({ product, onAdd }: Props) {
  const img = primaryImage(product);
  const inStock = product.stock === null || product.stock > 0;
  const hasVariants = product.variants.length > 0;
  return (
    <Card className="overflow-hidden rounded-3xl border-warm-cream/60 bg-white shadow-sm transition hover:shadow-md flex flex-col">
      <Link to={`/butik/${product.slug}`} className="block group" aria-label={product.name}>
        <div className="aspect-[4/3] bg-warm-cream/40 flex items-center justify-center overflow-hidden">
          {img ? (
            <img
              src={img}
              alt={product.name}
              loading="lazy"
              className="w-full h-full object-cover transition group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:transform-none"
            />
          ) : (
            <span className="text-6xl" aria-hidden>{product.emoji}</span>
          )}
        </div>
      </Link>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/butik/${product.slug}`} className="font-serif text-lg leading-tight hover:underline">
            {product.name}
          </Link>
          {product.badge && (
            <Badge variant="secondary" className="shrink-0">{product.badge}</Badge>
          )}
        </div>
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <div>
            <div className="font-semibold text-lg">{formatSek(product.price_ore)}</div>
            {!inStock && <div className="text-xs text-destructive">Slut i lager</div>}
            {inStock && product.stock !== null && product.stock <= 5 && (
              <div className="text-xs text-amber-700">Endast {product.stock} kvar</div>
            )}
          </div>
          {hasVariants ? (
            <Button asChild size="sm">
              <Link to={`/butik/${product.slug}`}>Välj</Link>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onAdd(product)}
              disabled={!inStock}
              aria-label={`Lägg ${product.name} i varukorgen`}
            >
              <ShoppingBag className="mr-1.5 h-4 w-4" aria-hidden />
              {inStock ? 'Lägg till' : 'Slutsåld'}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
