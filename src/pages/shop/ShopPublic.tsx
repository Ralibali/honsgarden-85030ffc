import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ShieldCheck, Truck, Heart, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSeo } from '@/hooks/useSeo';
import { useShopProducts, useShopSettings, DEFAULT_SETTINGS, type ShopProduct } from '@/lib/shop/api';
import { addToCart, cartCount, loadCart, saveCart, type CartItem } from '@/lib/shopCart';
import { ProductCard } from '@/components/shop/public/ProductCard';
import { CartDrawer } from '@/components/shop/public/CartDrawer';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatSek } from '@/lib/shopCart';

type SortKey = 'featured' | 'price_asc' | 'price_desc' | 'newest';

export default function ShopPublic() {
  const { data: products, isLoading } = useShopProducts();
  const { data: settings } = useShopSettings();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(() => loadCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('featured');

  useEffect(() => { saveCart(cart); }, [cart]);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data }: { data: boolean | null }) => setIsAdmin(!!data));
  }, [user]);

  useSeo({
    title: 'Hönsgården Butiken – produkter för svenska hönsägare',
    description: 'Utvalda produkter för dig med höns – kartonger, tillbehör och kläder från Hönsgården. Säker betalning via Stripe.',
    path: '/butik',
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    (products ?? []).forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = [...(products ?? [])];
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((p) => (p.name + ' ' + p.description).toLowerCase().includes(q));
    if (category !== 'all') list = list.filter((p) => p.category === category);
    switch (sort) {
      case 'price_asc': list.sort((a, b) => a.price_ore - b.price_ore); break;
      case 'price_desc': list.sort((a, b) => b.price_ore - a.price_ore); break;
      case 'newest': list.sort((a, b) => (b.sort_order ?? 0) - (a.sort_order ?? 0)); break;
      default:
        list.sort((a, b) => Number(b.featured) - Number(a.featured) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    return list;
  }, [products, query, category, sort]);

  const cartTotalOre = useMemo(() => {
    return cart.reduce((sum, item) => {
      const product = (products ?? []).find((p) => p.id === item.product_id);
      if (!product) return sum;
      return sum + item.quantity * product.price_ore;
    }, 0);
  }, [cart, products]);

  const handleAdd = (p: ShopProduct) => {
    setCart((prev) => addToCart(prev, p.id, p.stock, null));
    setCartOpen(true);
    toast({ title: 'Tillagd i varukorgen', description: p.name });
  };

  const publicEnabled = settings?.publicEnabled ?? false;

  if (!publicEnabled && !isAdmin) {
    return <ClosedSoon supportEmail={settings?.supportEmail ?? 'info@auroramedia.se'} />;
  }

  return (
    <div className="min-h-dvh bg-background font-outfit">
      {isAdmin && !publicEnabled && (
        <div className="bg-amber-100 text-amber-900 text-sm text-center py-2 px-4">
          Förhandsvisning: butiken är dold för vanliga besökare. Slå på i admin under Butik → Inställningar.
        </div>
      )}

      {/* Hero */}
      <section className="pt-20 pb-16 md:pt-28 md:pb-24 text-center px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-primary mb-5">
            Välkommen till butiken
          </div>
          <h1 className="font-playfair italic text-5xl md:text-7xl text-primary leading-[1.1] mb-10">
            Hönsgården
          </h1>
          <div className="w-24 h-px bg-accent mx-auto" aria-hidden />
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-y border-border">
        <div className="max-w-6xl mx-auto px-4 py-10 md:py-14 grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12">
          <TrustItem
            icon={<Heart className="h-7 w-7 text-primary" aria-hidden />}
            title="Utvalt för hönsägare"
            body="Ett fokuserat sortiment för livet med höns."
          />
          <TrustItem
            icon={<ShieldCheck className="h-7 w-7 text-primary" aria-hidden />}
            title="Säker betalning"
            body="Kortbetalning via Stripe. Ingen kortinformation lagras hos oss."
          />
          <TrustItem
            icon={<Truck className="h-7 w-7 text-primary" aria-hidden />}
            title="Leveransinformation"
            body={
              settings?.deliveryText?.trim()
                ? settings.deliveryText
                : settings?.deliveryMethod?.trim()
                  ? `Leverans via ${settings.deliveryMethod}.`
                  : 'Leveranssätt och tid visas i kassan.'
            }
          />
        </div>
      </section>

      {/* Filter & products */}
      <section id="produkter" className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <div className="flex flex-col md:flex-row justify-between items-center mb-16 gap-6">
          <div className="relative w-full md:w-80">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök bland våra varor…"
              className="w-full bg-secondary/50 border-none py-4 px-6 pr-12 rounded-sm text-sm italic placeholder:text-muted-foreground/70 focus-visible:ring-1 focus-visible:ring-primary transition-all"
              aria-label="Sök produkter"
            />
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto">
            <nav className="flex flex-wrap justify-center gap-x-8 gap-y-2" aria-label="Kategorier">
              <button
                type="button"
                onClick={() => setCategory('all')}
                className={`text-xs uppercase tracking-widest font-semibold pb-1 transition-colors ${
                  category === 'all'
                    ? 'text-primary border-b border-primary'
                    : 'text-muted-foreground hover:text-primary'
                }`}
              >
                Alla produkter
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`text-xs uppercase tracking-widest font-semibold pb-1 transition-colors ${
                    category === c
                      ? 'text-primary border-b border-primary'
                      : 'text-muted-foreground hover:text-primary'
                  }`}
                >
                  {c}
                </button>
              ))}
            </nav>

            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger
                className="w-[200px] border-none bg-secondary/50 rounded-sm text-xs uppercase tracking-widest font-semibold focus:ring-1 focus:ring-primary"
                aria-label="Sortering"
              >
                <SelectValue placeholder="Sortera" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Rekommenderat</SelectItem>
                <SelectItem value="price_asc">Pris: lågt till högt</SelectItem>
                <SelectItem value="price_desc">Pris: högt till lågt</SelectItem>
                <SelectItem value="newest">Nyast först</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-20">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-[4/3] w-full rounded-none" />
                <Skeleton className="h-8 w-3/4 rounded-none" />
                <Skeleton className="h-4 w-1/2 rounded-none" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="text-6xl mb-4" aria-hidden>🥚</div>
            <h2 className="font-playfair text-2xl mb-2">Inga produkter matchade</h2>
            <p className="text-muted-foreground">Prova en annan kategori eller sökterm.</p>
          </div>
        ) : (
          <>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-10">
              {filtered.length} {filtered.length === 1 ? 'produkt' : 'produkter'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-20">
              {filtered.map((p) => <ProductCard key={p.id} product={p} onAdd={handleAdd} />)}
            </div>
          </>
        )}
      </section>

      <ShopFooter settings={settings} />

      {/* Floating cart */}
      {cartCount(cart) > 0 && (
        <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="pointer-events-auto flex items-center gap-4 bg-foreground text-background px-6 py-4 rounded-full shadow-2xl hover:scale-105 active:scale-95 transition-all"
            aria-label="Öppna varukorg"
          >
            <span className="relative">
              <ShoppingBag className="h-5 w-5" aria-hidden />
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold border-2 border-foreground">
                {cartCount(cart)}
              </span>
            </span>
            <span className="w-px h-4 bg-background/30" aria-hidden />
            <span className="text-sm uppercase tracking-[0.15em] font-semibold">
              {formatSek(cartTotalOre)}
            </span>
          </button>
        </div>
      )}

      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        cart={cart}
        setCart={setCart}
        products={products ?? []}
        settings={settings ?? DEFAULT_SETTINGS}
        adminPreview={isAdmin && !publicEnabled}
      />
    </div>
  );
}

function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center text-center space-y-3">
      <div className="text-primary">{icon}</div>
      <div className="text-xs uppercase tracking-widest font-semibold text-primary">{title}</div>
      <div className="text-sm text-muted-foreground max-w-xs leading-relaxed">{body}</div>
    </div>
  );
}

function ShopFooter({ settings }: { settings?: { supportEmail: string } }) {
  return (
    <footer className="border-t bg-card mt-8">
      <div className="max-w-6xl mx-auto px-4 py-10 flex flex-col md:flex-row gap-4 justify-between text-sm text-muted-foreground">
        <div>
          © {new Date().getFullYear()} Hönsgården ·{' '}
          <Link to="/" className="hover:text-foreground transition-colors">Till huvudsidan</Link>
        </div>
        <div className="flex gap-4 flex-wrap">
          <Link to="/butik/villkor" className="hover:text-foreground transition-colors">Köpvillkor</Link>
          <Link to="/butik/angra" className="hover:text-foreground transition-colors">Ångra köp</Link>
          <Link to="/integritet" className="hover:text-foreground transition-colors">Integritet</Link>
          <a href={`mailto:${settings?.supportEmail ?? 'info@auroramedia.se'}`} className="hover:text-foreground transition-colors">Kontakt</a>
        </div>
      </div>
    </footer>
  );
}

function ClosedSoon({ supportEmail }: { supportEmail: string }) {
  useSeo({
    title: 'Hönsgården Butiken – öppnar snart',
    description: 'Butiken öppnar snart. Kontakta oss om du vill bli meddelad när vi lanserar.',
    path: '/butik',
    noindex: true,
  });
  return (
    <div className="min-h-dvh bg-background font-outfit flex items-center justify-center px-4">
      <div className="max-w-lg bg-card rounded-3xl border shadow-sm p-10 text-center">
        <div className="text-6xl mb-5" aria-hidden>🛍️</div>
        <h1 className="font-playfair text-3xl mb-3">Butiken öppnar snart</h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Vi finslipar sortimentet. Skriv gärna till oss om du vill bli meddelad när vi lanserar.
        </p>
        <Button asChild className="rounded-sm px-8 py-3 h-auto text-xs uppercase tracking-widest font-semibold">
          <a href={`mailto:${supportEmail}?subject=Bli%20meddelad%20om%20butiken`}>Meddela mig</a>
        </Button>
        <div className="mt-8">
          <Link to="/" className="text-sm text-primary hover:underline">Tillbaka till Hönsgården</Link>
        </div>
      </div>
    </div>
  );
}
