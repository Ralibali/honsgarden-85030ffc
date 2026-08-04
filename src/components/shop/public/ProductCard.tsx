import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="group flex flex-col">
      <Link
        to={`/butik/${product.slug}`}
        className="relative aspect-[4/3] overflow-hidden mb-6 bg-secondary block"
        aria-label={product.name}
      >
        {img ? (
          <img
            src={img}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:transform-none"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl" aria-hidden>
            {product.emoji}
          </div>
        )}
        {product.badge && (
          <div className="absolute top-6 left-0 bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] py-2 px-4 shadow-lg">
            {product.badge}
          </div>
        )}
      </Link>

      <div className="space-y-3 flex flex-col flex-1">
        <Link to={`/butik/${product.slug}`}>
          <h3 className="text-2xl font-playfair font-semibold leading-tight hover:text-primary transition-colors">
            {product.name}
          </h3>
        </Link>
        {product.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            {product.description}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-4">
          <span className="text-xl font-light text-primary">{formatSek(product.price_ore)}</span>
          {hasVariants ? (
            <Button
              asChild
              size="sm"
              className="rounded-sm bg-primary text-primary-foreground px-6 py-3 h-auto text-xs uppercase tracking-widest font-semibold hover:bg-foreground transition-all transform hover:-translate-y-0.5 shadow-md"
            >
              <Link to={`/butik/${product.slug}`}>Välj</Link>
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onAdd(product)}
              disabled={!inStock}
              aria-label={`Lägg ${product.name} i varukorgen`}
              className="rounded-sm bg-primary text-primary-foreground px-6 py-3 h-auto text-xs uppercase tracking-widest font-semibold hover:bg-foreground transition-all transform hover:-translate-y-0.5 shadow-md disabled:opacity-50 disabled:transform-none"
            >
              <ShoppingBag className="mr-1.5 h-4 w-4" aria-hidden />
              {inStock ? 'Lägg till' : 'Slutsåld'}
            </Button>
          )}
        </div>
        {!inStock && (
          <div className="text-xs text-destructive">Slut i lager</div>
        )}
        {inStock && product.stock !== null && product.stock <= 5 && (
          <div className="text-xs text-amber-700">Endast {product.stock} kvar</div>
        )}
      </div>
    </div>
  );
}
