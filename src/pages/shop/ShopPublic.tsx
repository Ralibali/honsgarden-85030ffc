import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, ShieldCheck, Truck, Heart, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSeo } from '@/hooks/useSeo';
import { useShopProducts, useShopSettings, type ShopProduct } from '@/lib/shop/api';
import { addToCart, cartCount, loadCart, saveCart, type CartItem } from '@/lib/shopCart';
import { ProductCard } from '@/components/shop/public/ProductCard';
import { CartDrawer } from '@/components/shop/public/CartDrawer';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
    description: 'Utvalda produkter för dig med höns – kartonger, tillbehör och kläder från Hönsgården. Snabb leverans, säker betalning via Stripe.',
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
    <div className="min-h-dvh bg-warm-cream/30">
      {isAdmin && !publicEnabled && (
        <div className="bg-amber-100 text-amber-900 text-sm text-center py-2 px-4">
          Förhandsvisning: butiken är dold för vanliga besökare. Slå på i admin under Butik → Inställningar.
        </div>
      )}

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-warm-cream/70 to-transparent">
        <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 text-center">
          <div className="text-sm font-medium text-primary mb-3">Hönsgården Butiken</div>
          <h1 className="font-serif text-4xl md:text-5xl leading-tight">
            Utvalda produkter för svenska hönsägare
          </h1>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Från äggkartonger med eget tryck till varma kläder för morgonrundan – nogsamt utvalt och testat i vår egen hönsgård.
          </p>
          <div className="mt-6">
            <Button size="lg" asChild>
              <a href="#produkter">Se produkter</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section className="border-b bg-white">
        <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <TrustItem icon={<ShieldCheck className="h-5 w-5 text-primary" aria-hidden />} title="Säker betalning" body="Kortbetalning via Stripe. Ingen kortinformation lagras hos oss." />
          <TrustItem icon={<Truck className="h-5 w-5 text-primary" aria-hidden />} title="Snabb leverans" body={settings?.deliveryText ?? 'Vi packar din order inom 1–3 arbetsdagar.'} />
          <TrustItem icon={<Heart className="h-5 w-5 text-primary" aria-hidden />} title="Personlig support" body={`Kontakta oss på ${settings?.supportEmail ?? 'info@auroramedia.se'} – vi svarar personligen.`} />
        </div>
      </section>

      {/* Filter & products */}
      <section id="produkter" className="max-w-6xl mx-auto px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sök produkter…"
              className="pl-9"
              aria-label="Sök produkter"
            />
          </div>
          <div className="flex gap-3">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[160px]" aria-label="Kategori"><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla kategorier</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-[180px]" aria-label="Sortering"><SelectValue placeholder="Sortera" /></SelectTrigger>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-72 rounded-3xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 rounded-3xl bg-white border">
            <div className="text-6xl mb-3" aria-hidden>🥚</div>
            <h2 className="font-serif text-2xl">Inga produkter matchade</h2>
            <p className="mt-2 text-muted-foreground">Prova en annan kategori eller sökterm.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((p) => <ProductCard key={p.id} product={p} onAdd={handleAdd} />)}
          </div>
        )}
      </section>

      <ShopFooter settings={settings} />

      {/* Sticky cart bar (mobile) */}
      {cartCount(cart) > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-40 sm:hidden">
          <Button size="lg" className="w-full shadow-lg" onClick={() => setCartOpen(true)}>
            <ShoppingBag className="h-4 w-4 mr-2" aria-hidden />
            Öppna varukorg ({cartCount(cart)})
          </Button>
        </div>
      )}
      {/* Desktop cart button */}
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
        products={products ?? []}
        settings={settings ?? { publicEnabled: false, shippingOre: 5900, freeShippingThresholdOre: 49900, supportEmail: '', deliveryText: '', companyName: '', companyOrgNumber: '', companyAddress: '', returnAddress: '', deliveryMethod: 'Postnord', deliveryDaysMin: 1, deliveryDaysMax: 3, termsReviewedAt: null }}
      />
    </div>
  );
}

function TrustItem({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground text-sm">{body}</div>
      </div>
    </div>
  );
}

function ShopFooter({ settings }: { settings?: { supportEmail: string } }) {
  return (
    <footer className="border-t bg-white mt-8">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-4 justify-between text-sm text-muted-foreground">
        <div>
          © {new Date().getFullYear()} Hönsgården ·{' '}
          <Link to="/" className="hover:underline">Till huvudsidan</Link>
        </div>
        <div className="flex gap-4 flex-wrap">
          <Link to="/butik/villkor" className="hover:underline">Köpvillkor</Link>
          <Link to="/integritet" className="hover:underline">Integritet</Link>
          <a href={`mailto:${settings?.supportEmail ?? 'info@auroramedia.se'}`} className="hover:underline">Kontakt</a>
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
    <div className="min-h-dvh bg-warm-cream/30 flex items-center justify-center px-4">
      <div className="max-w-lg bg-white rounded-3xl border shadow-sm p-8 text-center">
        <div className="text-6xl mb-4" aria-hidden>🛍️</div>
        <h1 className="font-serif text-3xl">Butiken öppnar snart</h1>
        <p className="mt-3 text-muted-foreground">
          Vi finslipar sortimentet. Skriv gärna till oss om du vill bli meddelad när vi lanserar.
        </p>
        <Button asChild className="mt-6">
          <a href={`mailto:${supportEmail}?subject=Bli%20meddelad%20om%20butiken`}>Meddela mig</a>
        </Button>
        <div className="mt-6">
          <Link to="/" className="text-sm text-primary hover:underline">Tillbaka till Hönsgården</Link>
        </div>
      </div>
    </div>
  );
}
