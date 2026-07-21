import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Minus, Plus, Trash2, ShoppingBag, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  cartCount, cartSubtotalOre, shippingForSubtotal, formatSek, setQuantity, removeFromCart,
  type CartItem,
} from '@/lib/shopCart';
import { primaryImage, priceForVariant, stockForVariant, type ShopProduct } from '@/lib/shop/api';
import type { ShopSettings } from '@/lib/shop/api';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  setCart: (updater: (prev: CartItem[]) => CartItem[]) => void;
  products: ShopProduct[];
  settings: ShopSettings;
  /** Sätts av ShopPublic när admin förhandsvisar butiken trots att den inte är publik. */
  adminPreview?: boolean;
}

export function CartDrawer({ open, onOpenChange, cart, setCart, products, settings, adminPreview = false }: Props) {
  const [loading, setLoading] = useState(false);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const lines = cart
    .map((it) => {
      const product = byId.get(it.product_id);
      if (!product) return null;
      const variant = it.variant_id ? product.variants.find((v) => v.id === it.variant_id) : null;
      const unit = priceForVariant(product, it.variant_id ?? null);
      const stock = stockForVariant(product, it.variant_id ?? null);
      return { it, product, variant, unit, stock, lineTotal: unit * it.quantity };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const subtotal = cartSubtotalOre(cart, products);
  const shipping = shippingForSubtotal(subtotal, settings);
  const total = subtotal + shipping;
  const toFree = settings.freeShippingThresholdOre - subtotal;
  const progressPct = Math.min(100, Math.round((subtotal / Math.max(1, settings.freeShippingThresholdOre)) * 100));

  const handleCheckout = async () => {
    if (lines.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('shop-checkout', {
        body: {
          items: cart.map((it) => ({
            product_id: it.product_id,
            variant_id: it.variant_id ?? null,
            quantity: it.quantity,
          })),
          preview: adminPreview,
        },
      });
      if (error) throw error;
      const url = (data as { url?: string; error?: string })?.url;
      const errMsg = (data as { error?: string })?.error;
      if (errMsg) throw new Error(errMsg);
      if (!url) throw new Error('Ingen betallänk mottogs');
      window.location.href = url;
    } catch (e) {
      toast({
        title: 'Kunde inte starta betalning',
        description: e instanceof Error ? e.message : 'Försök igen om en stund.',
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-6 pb-3">
          <SheetTitle className="font-serif text-2xl flex items-center gap-2">
            <ShoppingBag className="h-5 w-5" aria-hidden /> Varukorg
            <span className="ml-1 text-sm font-normal text-muted-foreground">
              ({cartCount(cart)} st)
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6">
          {lines.length === 0 ? (
            <div className="text-center text-muted-foreground py-10">
              Din varukorg är tom.
            </div>
          ) : (
            <ul className="space-y-4">
              {lines.map(({ it, product, variant, unit, stock, lineTotal }) => {
                const maxQty = stock ?? 99;
                const img = primaryImage(product);
                return (
                  <li key={`${it.product_id}::${it.variant_id ?? ''}`} className="flex gap-3">
                    <div className="w-16 h-16 rounded-xl bg-warm-cream/50 overflow-hidden flex items-center justify-center shrink-0">
                      {img ? (
                        <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl" aria-hidden>{product.emoji}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{product.name}</div>
                      {variant && (
                        <div className="text-xs text-muted-foreground">{variant.name}</div>
                      )}
                      <div className="text-sm text-muted-foreground">{formatSek(unit)} / st</div>
                      <div className="mt-1 flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          aria-label="Minska antal"
                          onClick={() => setCart((prev) => setQuantity(prev, it.product_id, it.quantity - 1, it.variant_id ?? null))}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="min-w-[2ch] text-center text-sm">{it.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          aria-label="Öka antal"
                          disabled={it.quantity >= maxQty}
                          onClick={() => setCart((prev) => setQuantity(prev, it.product_id, it.quantity + 1, it.variant_id ?? null))}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 ml-1 text-muted-foreground"
                          aria-label="Ta bort ur varukorgen"
                          onClick={() => setCart((prev) => removeFromCart(prev, it.product_id, it.variant_id ?? null))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="text-sm font-medium whitespace-nowrap">{formatSek(lineTotal)}</div>
                  </li>
                );
              })}
            </ul>
          )}

          {lines.length > 0 && (
            <div className="mt-6 space-y-2">
              {toFree > 0 ? (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {formatSek(toFree)} kvar till fri frakt
                  </div>
                  <div className="h-2 rounded-full bg-warm-cream/60 overflow-hidden">
                    <div className="h-full bg-primary transition-all motion-reduce:transition-none" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              ) : (
                <div className="text-sm text-green-700 font-medium">Grattis, du har fri frakt!</div>
              )}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <SheetFooter className="p-6 pt-4 border-t bg-warm-cream/30 flex-col sm:flex-col gap-3">
            <div className="w-full space-y-1 text-sm">
              <div className="flex justify-between"><span>Delsumma</span><span>{formatSek(subtotal)}</span></div>
              <div className="flex justify-between">
                <span>Frakt</span>
                <span>{shipping === 0 ? 'Fri' : formatSek(shipping)}</span>
              </div>
              <Separator className="my-2" />
              <div className="flex justify-between text-base font-semibold">
                <span>Totalt</span><span>{formatSek(total)}</span>
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={handleCheckout} disabled={loading}>
              {loading ? 'Öppnar Stripe…' : 'Till kassan'}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Säker betalning via Stripe
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
