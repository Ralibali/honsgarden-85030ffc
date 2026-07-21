import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSeo } from '@/hooks/useSeo';
import { primaryImage, priceForVariant, stockForVariant, useShopProduct, useShopProducts, useShopSettings, DEFAULT_SETTINGS } from '@/lib/shop/api';
import { addToCart, cartCount, formatSek, loadCart, saveCart, type CartItem } from '@/lib/shopCart';
import { CartDrawer } from '@/components/shop/public/CartDrawer';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function ShopProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { data: product, isLoading } = useShopProduct(slug);
  const { data: allProducts } = useShopProducts();
  const { data: settings } = useShopSettings();

  const [cart, setCart] = useState<CartItem[]>(() => loadCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (alive) setIsAdmin(!!data);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => { saveCart(cart); }, [cart]);
  useEffect(() => {
    if (product && product.variants.length > 0 && !variantId) {
      const first = product.variants.find((v) => v.stock === null || v.stock > 0) ?? product.variants[0];
      setVariantId(first.id);
    }
  }, [product, variantId]);

  const images = useMemo(() => {
    if (!product) return [] as string[];
    return product.images.length > 0 ? product.images : product.image_url ? [product.image_url] : [];
  }, [product]);

  const unit = product ? priceForVariant(product, variantId) : 0;
  const stock = product ? stockForVariant(product, variantId) : null;
  const inStock = stock === null || stock > 0;
  const maxQty = stock ?? 99;

  const jsonLd = useMemo(() => {
    if (!product) return undefined;
    return {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      name: product.name,
      description: product.description || product.long_description || undefined,
      image: images,
      brand: { '@type': 'Brand', name: 'Hönsgården' },
      sku: product.slug,
      offers: {
        '@type': 'Offer',
        priceCurrency: 'SEK',
        price: (unit / 100).toFixed(2),
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: `https://honsgarden.se/butik/${product.slug}`,
      },
    };
  }, [product, images, unit, inStock]);

  useSeo({
    title: product ? `${product.name} – Hönsgården Butiken` : 'Produkt – Hönsgården Butiken',
    description: product?.description || 'Produkter för svenska hönsägare från Hönsgården.',
    path: product ? `/butik/${product.slug}` : '/butik',
    ogImage: images[0],
    jsonLd,
  });

  const related = useMemo(() => {
    if (!allProducts || !product) return [];
    return allProducts
      .filter((p) => p.id !== product.id && (product.category ? p.category === product.category : true))
      .slice(0, 3);
  }, [allProducts, product]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Skeleton className="h-8 w-40 mb-4" />
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-3xl" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <h1 className="font-serif text-3xl">Produkten hittades inte</h1>
        <Button asChild className="mt-4"><Link to="/butik">Tillbaka till butiken</Link></Button>
      </div>
    );
  }

  const handleAdd = () => {
    setCart((prev) => {
      let next = prev;
      for (let i = 0; i < qty; i++) next = addToCart(next, product.id, stock, variantId);
      return next;
    });
    setCartOpen(true);
    toast({ title: 'Tillagd i varukorgen', description: product.name });
  };

  return (
    <div className="min-h-dvh bg-warm-cream/30">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)} className="mb-2">
          <ChevronLeft className="h-4 w-4 mr-1" aria-hidden /> Tillbaka
        </Button>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-12 grid md:grid-cols-2 gap-8">
        {/* Gallery */}
        <div>
          <div className="aspect-square rounded-3xl bg-white border overflow-hidden flex items-center justify-center">
            {images.length > 0 ? (
              <img src={images[imgIdx]} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-8xl" aria-hidden>{product.emoji}</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => setImgIdx(i)}
                  aria-label={`Bild ${i + 1}`}
                  aria-pressed={i === imgIdx}
                  className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 ${i === imgIdx ? 'border-primary' : 'border-transparent'}`}
                >
                  <img src={src} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.badge && <Badge className="mb-2">{product.badge}</Badge>}
          <h1 className="font-serif text-3xl md:text-4xl">{product.name}</h1>
          <div className="mt-2 text-2xl font-semibold">{formatSek(unit)}</div>
          {!inStock && <div className="mt-1 text-destructive text-sm">Slut i lager</div>}
          {inStock && stock !== null && stock <= 5 && (
            <div className="mt-1 text-amber-700 text-sm">Endast {stock} kvar</div>
          )}

          <p className="mt-4 text-muted-foreground">{product.description}</p>
          {product.long_description && (
            <p className="mt-3 whitespace-pre-line">{product.long_description}</p>
          )}

          {product.variants.length > 0 && (
            <div className="mt-6">
              <div className="text-sm font-medium mb-2">Välj variant</div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const oos = v.stock !== null && v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      disabled={oos}
                      onClick={() => setVariantId(v.id)}
                      aria-pressed={variantId === v.id}
                      className={`px-3 py-1.5 rounded-full border text-sm transition ${
                        variantId === v.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-white hover:bg-warm-cream/50'
                      } ${oos ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {v.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Minska antal"><Minus className="h-3 w-3" /></Button>
              <span className="min-w-[3ch] text-center">{qty}</span>
              <Button size="icon" variant="outline" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Öka antal" disabled={qty >= maxQty}><Plus className="h-3 w-3" /></Button>
            </div>
            <Button size="lg" onClick={handleAdd} disabled={!inStock} className="flex-1">
              <ShoppingBag className="h-4 w-4 mr-2" aria-hidden />
              {inStock ? 'Lägg i varukorg' : 'Slutsåld'}
            </Button>
          </div>

          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><Truck className="h-4 w-4" aria-hidden />{settings?.deliveryText ?? 'Fri frakt från 499 kr.'}</div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" aria-hidden />Säker betalning via Stripe.</div>
            {product.shipping_days_min && product.shipping_days_max && (
              <div>Beräknad leverans {product.shipping_days_min}–{product.shipping_days_max} arbetsdagar.</div>
            )}
          </div>

          {product.features.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-2">Höjdpunkter</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                {product.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )}

          {product.specifications && Object.keys(product.specifications).length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium mb-2">Specifikationer</h3>
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                {Object.entries(product.specifications).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <h2 className="font-serif text-2xl mb-4">Kanske också intressant</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {related.map((p) => {
              const img = primaryImage(p);
              return (
                <Link key={p.id} to={`/butik/${p.slug}`} className="group block rounded-2xl bg-white border overflow-hidden">
                  <div className="aspect-[4/3] bg-warm-cream/40 flex items-center justify-center overflow-hidden">
                    {img ? <img src={img} alt={p.name} className="w-full h-full object-cover group-hover:scale-[1.02] transition motion-reduce:transform-none" />
                         : <span className="text-5xl" aria-hidden>{p.emoji}</span>}
                  </div>
                  <div className="p-3">
                    <div className="font-medium">{p.name}</div>
                    <div className="text-sm text-muted-foreground">{formatSek(p.price_ore)}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {cartCount(cart) > 0 && (
        <div className="fixed bottom-4 inset-x-4 sm:hidden z-40">
          <Button size="lg" className="w-full shadow-lg" onClick={() => setCartOpen(true)}>
            Öppna varukorg ({cartCount(cart)})
          </Button>
        </div>
      )}
      <button
        className="hidden sm:flex fixed top-4 right-4 z-40 items-center gap-2 rounded-full bg-white border shadow px-4 py-2 hover:bg-warm-cream/40"
        onClick={() => setCartOpen(true)}
        aria-label="Öppna varukorg"
      >
        <ShoppingBag className="h-4 w-4" aria-hidden />
        <span className="text-sm font-medium">{cartCount(cart)}</span>
      </button>

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        cart={cart}
        setCart={setCart}
        products={allProducts ?? []}
        settings={settings ?? DEFAULT_SETTINGS}
        adminPreview={isAdmin && !(settings?.publicEnabled ?? false)}
      />
    </div>
  );
}
