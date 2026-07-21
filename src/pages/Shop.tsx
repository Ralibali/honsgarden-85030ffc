import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingBag, Lock, Plus, Pencil, Trash2, Loader2, ShieldCheck,
  CreditCard, CheckCircle2, Sparkles, PackageOpen, Eye, EyeOff, LayoutDashboard, Undo2,

} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { useSeo } from '@/hooks/useSeo';
import { brandName } from '@/lib/brand';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import ShopCartSheet from '@/components/shop/ShopCartSheet';
import ShopProductForm, { type ProductFormValues } from '@/components/shop/ShopProductForm';
import ShopOrders from '@/components/shop/ShopOrders';
import ShopAdminSettings from '@/components/shop/ShopAdminSettings';
import ShopOverview from '@/components/shop/ShopOverview';
import ShopWithdrawalRequests from '@/components/shop/ShopWithdrawalRequests';
import {
  addToCart, cartCount, formatSek, loadCart, saveCart, type CartItem,
} from '@/lib/shopCart';

type ShopProduct = Tables<'shop_products'>;
type ShopOrder = Tables<'shop_orders'>;

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

/* ---------- Låsskärm för alla utom admin ---------- */
function LockedShop() {
  return (
    <div className="max-w-md mx-auto mt-10">
      <Card className="p-8 rounded-3xl text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
        <motion.div
          className="relative w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center mb-4"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Lock className="h-7 w-7 text-primary" />
        </motion.div>
        <h2 className="font-serif text-2xl relative">Butiken är låst</h2>
        <p className="text-sm text-muted-foreground mt-2 relative">
          Webbshoppen är under uppbyggnad och syns bara för gårdens ägare.
          Hör av dig om du letar efter något! 🐔
        </p>
      </Card>
    </div>
  );
}

/* ---------- Kvittens vy efter Stripe ---------- */
function PurchaseResult({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const [tries, setTries] = useState(0);
  const { data: order } = useQuery({
    queryKey: ['shop-order-by-session', sessionId, tries],
    queryFn: async () => {
      const { data } = await supabase
        .from('shop_orders')
        .select('*')
        .eq('stripe_session_id', sessionId)
        .maybeSingle();
      return data as ShopOrder | null;
    },
    refetchInterval: (query) =>
      query.state.data?.status === 'paid' ? false : 2000,
  });

  useEffect(() => {
    if (order?.status !== 'paid' && tries < 15) {
      const t = setTimeout(() => setTries((v) => v + 1), 2000);
      return () => clearTimeout(t);
    }
  }, [order?.status, tries]);

  const paid = order?.status === 'paid';

  return (
    <div className="max-w-md mx-auto mt-6">
      <Card className="p-8 rounded-3xl text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-success/10 to-transparent pointer-events-none" />
        <motion.div
          className={`relative w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
            paid ? 'bg-success/15 border border-success/30' : 'bg-warning/10 border border-warning/30'
          }`}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          {paid
            ? <CheckCircle2 className="h-8 w-8 text-success" />
            : <Loader2 className="h-7 w-7 text-warning animate-spin" />}
        </motion.div>
        <h2 className="font-serif text-2xl relative">
          {paid ? 'Tack för ditt köp! 🎉' : 'Väntar på betalning…'}
        </h2>
        <p className="text-sm text-muted-foreground mt-2 relative">
          {paid
            ? `Ordern är bekräftad${order ? ` på ${formatSek(order.amount_total_ore)}` : ''}. Du hittar den under fliken Ordrar.`
            : 'Stripe bekräftar betalningen – det tar bara några sekunder.'}
        </p>
        {(paid || tries >= 15) && (
          <Button className="mt-5 rounded-xl relative" onClick={onDone}>
            Tillbaka till butiken
          </Button>
        )}
      </Card>
    </div>
  );
}

/* ---------- Huvudsidan ---------- */
export default function Shop() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cart, setCart] = useState<CartItem[]>(() => loadCart());
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  useSeo({
    title: `Butik | ${brandName()}`,
    description: 'Hönsgårdens egna webbshop.',
    path: '/app/butik',
    noindex: true,
  });

  const { data: adminCheck, isLoading: adminLoading } = useQuery({
    queryKey: ['admin-check'],
    queryFn: () => api.adminCheck(),
  });
  const isAdmin = !!adminCheck?.is_admin;

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['shop-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_products')
        .select('*')
        .order('sort_order')
        .order('created_at');
      if (error) throw error;
      return data as ShopProduct[];
    },
    enabled: isAdmin,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['shop-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shop_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as ShopOrder[];
    },
    enabled: isAdmin,
  });

  const { data: variants = [] } = useQuery({
    queryKey: ['shop-variants-all'],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from('shop_product_variants').select('*');
      if (error) throw error;
      return (data ?? []) as Tables<'shop_product_variants'>[];
    },
    enabled: isAdmin,
  });

  const [activeTab, setActiveTab] = useState('oversikt');


  useEffect(() => { saveCart(cart); }, [cart]);

  const kopState = searchParams.get('kop');
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (kopState === 'klart') {
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
    } else if (kopState === 'avbrutet') {
      toast({ title: 'Köpet avbröts', description: 'Varukorgen är kvar om du vill försöka igen.' });
      setSearchParams({}, { replace: true });
    }
  }, [kopState, queryClient, setSearchParams]);

  const activeProducts = useMemo(() => products.filter((p) => p.active), [products]);
  const count = cartCount(cart);

  const handleAdd = (product: ShopProduct) => {
    setCart((c) => addToCart(c, product.id, product.stock));
    setAddedId(product.id);
    setTimeout(() => setAddedId((id) => (id === product.id ? null : id)), 900);
  };

  const handleCheckout = async () => {
    setCheckingOut(true);
    try {
      const { data, error } = await supabase.functions.invoke('shop-checkout', {
        body: { items: cart },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error('Ingen checkout-URL från Stripe');
      window.location.href = data.url;
    } catch (e) {
      toast({
        title: 'Kunde inte starta betalningen',
        description: e instanceof Error ? e.message : 'Försök igen om en stund.',
        variant: 'destructive',
      });
      setCheckingOut(false);
    }
  };

  const saveProduct = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const { normalizeSlug, isValidSlug, SLUG_CONFLICT_ERROR, isSlugUniqueViolation } =
        await import('@/lib/shop/validation');
      const basePayload = {
        name: values.name,
        description: values.description,
        long_description: values.long_description || null,
        emoji: values.emoji,
        image_url: values.image_url || null,
        images: values.images ?? [],
        features: values.features ?? [],
        specifications: values.specifications ?? {},
        category: values.category || null,
        badge: values.badge || null,
        featured: !!values.featured,
        shipping_days_min: values.shipping_days_min,
        shipping_days_max: values.shipping_days_max,
        price_ore: values.priceOre,
        stock: values.stock,
        sort_order: values.sort_order,
        active: values.active,
        is_example: false,
      };
      const desiredSlug = normalizeSlug(values.slug || values.name);
      if (!isValidSlug(desiredSlug)) throw new Error('URL-slug saknas eller är ogiltig.');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: conflict } = await (supabase as any)
        .from('shop_products').select('id').eq('slug', desiredSlug).maybeSingle();
      const slugTaken = conflict && (!editing || conflict.id !== editing.id);
      if (slugTaken) throw new Error(SLUG_CONFLICT_ERROR);

      try {
        if (editing) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from('shop_products')
            .update({ ...basePayload, slug: desiredSlug }).eq('id', editing.id);
          if (error) throw error;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase as any).from('shop_products').insert([{ ...basePayload, slug: desiredSlug }]);
          if (error) throw error;
        }
      } catch (e) {
        if (isSlugUniqueViolation(e)) throw new Error(SLUG_CONFLICT_ERROR);
        throw e;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-products'] });
      queryClient.invalidateQueries({ queryKey: ['shop-products-public'] });
      toast({ title: editing ? 'Produkten uppdaterad' : 'Produkten tillagd' });
    },
    onError: (e) => {
      toast({
        title: 'Kunde inte spara produkten',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      });
    },
  });


  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('shop_products').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shop-products'] }),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shop_products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-products'] });
      toast({ title: 'Produkten borttagen' });
    },
  });

  if (adminLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-64 rounded-2xl" />
        <Skeleton className="h-40 rounded-3xl" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!isAdmin) return <LockedShop />;

  if (kopState === 'klart' && sessionId) {
    return (
      <PurchaseResult
        sessionId={sessionId}
        onDone={() => setSearchParams({}, { replace: true })}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Butik"
        emoji="🛍️"
        subtitle="Din egen webbshop – kopplad till ditt Stripe-konto"
        actions={
          <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/5 text-primary">
            <Lock className="h-3 w-3" /> Bara synlig för dig
          </Badge>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="rounded-xl flex-wrap h-auto">
          <TabsTrigger value="oversikt" className="rounded-lg gap-1.5"><LayoutDashboard className="h-4 w-4" /> Översikt</TabsTrigger>
          <TabsTrigger value="butik" className="rounded-lg gap-1.5"><ShoppingBag className="h-4 w-4" /> Butik</TabsTrigger>
          <TabsTrigger value="produkter" className="rounded-lg gap-1.5"><PackageOpen className="h-4 w-4" /> Produkter</TabsTrigger>
          <TabsTrigger value="ordrar" className="rounded-lg gap-1.5"><CreditCard className="h-4 w-4" /> Ordrar</TabsTrigger>
          <TabsTrigger value="installningar" className="rounded-lg gap-1.5"><ShieldCheck className="h-4 w-4" /> Inställningar</TabsTrigger>
        </TabsList>

        {/* ---------------- ÖVERSIKT ---------------- */}
        <TabsContent value="oversikt" className="space-y-4 mt-0">
          <ShopOverview orders={orders} products={products} variants={variants} loading={ordersLoading || productsLoading} onOpenOrders={() => setActiveTab("ordrar")} onOpenProducts={() => setActiveTab("produkter")} />
        </TabsContent>


        {/* ---------------- BUTIK ---------------- */}
        <TabsContent value="butik" className="space-y-6 mt-0">
          <motion.div
            className="relative overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/12 via-accent/8 to-transparent p-6 sm:p-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              className="absolute -top-10 -right-8 text-7xl opacity-15 select-none"
              animate={{ y: [0, -8, 0], rotate: [0, 6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              🛍️
            </motion.div>
            <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3 mr-1" /> Förhandsläge
            </Badge>
            <h2 className="font-serif text-2xl sm:text-3xl max-w-lg leading-tight">
              Välkommen till din butik – så här snygg blir den
            </h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              Lägg till produkter, testa ett köp med Stripe och finjustera i lugn och ro.
              När du är redo gör vi den publik för dina kunder – med samma polish.
            </p>
          </motion.div>

          {productsLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          ) : activeProducts.length === 0 ? (
            <Card className="p-10 rounded-2xl text-center">
              <div className="text-4xl mb-3">🧺</div>
              <p className="font-serif text-lg">Inga synliga produkter ännu</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Lägg till din första produkt under fliken Produkter.
              </p>
              <Button className="rounded-xl" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="h-4 w-4 mr-1.5" /> Lägg till produkt
              </Button>
            </Card>
          ) : (
            <motion.div
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4"
              variants={staggerContainer}
              initial="hidden"
              animate="show"
            >
              {activeProducts.map((product) => {
                const out = product.stock !== null && product.stock <= 0;
                const low = product.stock !== null && product.stock > 0 && product.stock <= 5;
                return (
                  <motion.div key={product.id} variants={staggerItem}>
                    <Card className="group overflow-hidden rounded-2xl border-border/50 hover:border-primary/25 hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
                      <div className="relative aspect-[4/3] bg-gradient-to-br from-primary/12 via-muted/40 to-accent/10 flex items-center justify-center overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                        ) : (
                          <span className="text-7xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 select-none">
                            {product.emoji}
                          </span>
                        )}
                        {out && (
                          <Badge className="absolute top-3 right-3 bg-destructive/90 text-destructive-foreground border-0">Slut</Badge>
                        )}
                        {low && (
                          <Badge className="absolute top-3 right-3 bg-warning/90 text-warning-foreground border-0">
                            Bara {product.stock} kvar
                          </Badge>
                        )}
                      </div>
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-serif text-lg leading-snug">{product.name}</h3>
                          <p className="font-serif text-lg text-primary shrink-0">{formatSek(product.price_ore)}</p>
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                        )}
                        <div className="relative overflow-hidden rounded-xl pt-1">
                          <Button
                            className="relative w-full rounded-xl overflow-hidden group/btn"
                            disabled={out}
                            onClick={() => handleAdd(product)}
                          >
                            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover/btn:translate-x-full" />
                            {addedId === product.id
                              ? <><CheckCircle2 className="h-4 w-4 mr-1.5" /> I varukorgen!</>
                              : out ? 'Slutsåld' : <><ShoppingBag className="h-4 w-4 mr-1.5" /> Lägg i varukorg</>}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </TabsContent>

        {/* ---------------- PRODUKTER ---------------- */}
        <TabsContent value="produkter" className="space-y-4 mt-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {products.length} {products.length === 1 ? 'produkt' : 'produkter'} · ändringar syns direkt i butiken
            </p>
            <Button className="rounded-xl" onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> Ny produkt
            </Button>
          </div>

          {productsLoading ? (
            <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div>
          ) : products.length === 0 ? (
            <Card className="p-10 rounded-2xl text-center">
              <div className="text-4xl mb-3">📦</div>
              <p className="font-serif text-lg">Inga produkter ännu</p>
            </Card>
          ) : (
            <div className="space-y-3 stagger-children">
              {products.map((product) => (
                <Card key={product.id} className="p-3 sm:p-4 rounded-2xl border-border/50 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                    {product.image_url
                      ? <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                      : product.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{product.name}</p>
                      {!product.active && (
                        <Badge variant="outline" className="text-muted-foreground gap-1">
                          <EyeOff className="h-3 w-3" /> Dold
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatSek(product.price_ore)}
                      {product.stock !== null ? ` · ${product.stock} i lager` : ' · obegränsat lager'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span title={product.active ? 'Synlig' : 'Dold'} className="flex items-center">
                      {product.active
                        ? <Eye className="h-4 w-4 text-muted-foreground/50 mr-1" />
                        : <EyeOff className="h-4 w-4 text-muted-foreground/50 mr-1" />}
                    </span>
                    <Switch
                      checked={product.active}
                      onCheckedChange={(active) => toggleActive.mutate({ id: product.id, active })}
                    />
                    <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl"
                      onClick={() => { setEditing(product); setFormOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon"
                          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Ta bort {product.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Produkten försvinner från butiken. Genomförda ordrar påverkas inte.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="rounded-xl">Avbryt</AlertDialogCancel>
                          <AlertDialogAction className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteProduct.mutate(product.id)}>
                            Ta bort
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------------- ORDRAR ---------------- */}
        <TabsContent value="ordrar" className="mt-0">
          <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Betalda ordrar markeras automatiskt via din befintliga Stripe-webhook.
          </div>
          <ShopOrders orders={orders} loading={ordersLoading} />
        </TabsContent>

        {/* ---------------- INSTÄLLNINGAR ---------------- */}
        <TabsContent value="installningar" className="mt-0">
          <ShopAdminSettings />
        </TabsContent>
      </Tabs>

      {/* Varukorgs-knapp */}
      {count > 0 && !cartOpen && (
        <motion.div
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <Button
            size="lg"
            className="relative rounded-full h-14 pl-5 pr-6 shadow-[0_8px_24px_hsl(var(--primary)/0.4)] gap-2"
            onClick={() => setCartOpen(true)}
          >
            <ShoppingBag className="h-5 w-5" />
            <span className="font-semibold">Varukorg</span>
            <span className="absolute -top-1.5 -right-1.5 min-w-6 h-6 px-1.5 rounded-full bg-accent text-accent-foreground text-xs font-bold flex items-center justify-center border-2 border-background">
              {count}
            </span>
          </Button>
        </motion.div>
      )}

      <ShopCartSheet
        open={cartOpen}
        onOpenChange={setCartOpen}
        cart={cart}
        products={products}
        onCartChange={setCart}
        onCheckout={handleCheckout}
        checkingOut={checkingOut}
      />

      <ShopProductForm
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editing}
        onSave={async (values) => { await saveProduct.mutateAsync(values); }}
      />
    </div>
  );
}
