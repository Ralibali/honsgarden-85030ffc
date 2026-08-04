import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Trash2, ShoppingBag, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import type { Tables } from '@/integrations/supabase/types';
import { cartTotalOre, formatSek, setQuantity, type CartItem } from '@/lib/shopCart';

type ShopProduct = Tables<'shop_products'>;

interface ShopCartSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cart: CartItem[];
  products: ShopProduct[];
  onCartChange: (cart: CartItem[]) => void;
  onCheckout: () => void;
  checkingOut: boolean;
}

/** Kundvagnslåda som glider in från höger – snygg, snabb och tydlig. */
export default function ShopCartSheet({
  open, onOpenChange, cart, products, onCartChange, onCheckout, checkingOut,
}: ShopCartSheetProps) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = cart
    .map((it) => ({ item: it, product: byId.get(it.product_id) }))
    .filter((r): r is { item: CartItem; product: ShopProduct } => !!r.product);
  const total = cartTotalOre(cart, products);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/50">
          <SheetTitle className="font-serif text-xl flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" /> Din varukorg
          </SheetTitle>
          <SheetDescription>
            {rows.length === 0 ? 'Varukorgen är tom.' : `${rows.length} ${rows.length === 1 ? 'vara' : 'varor'} i varukorgen`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <AnimatePresence initial={false}>
            {rows.map(({ item, product }) => (
              <motion.div
                key={item.product_id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 24 }}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3"
              >
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                  {product.image_url
                    ? <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                    : product.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{formatSek(product.price_ore)} / st</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline" size="icon" className="h-7 w-7 rounded-full"
                    onClick={() => onCartChange(setQuantity(cart, item.product_id, item.quantity - 1))}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm font-medium tabular-nums">{item.quantity}</span>
                  <Button
                    variant="outline" size="icon" className="h-7 w-7 rounded-full"
                    onClick={() => onCartChange(setQuantity(cart, item.product_id, item.quantity + 1))}
                    disabled={product.stock !== null && item.quantity >= product.stock}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onCartChange(setQuantity(cart, item.product_id, 0))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {rows.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🧺</div>
              <p className="text-sm text-muted-foreground">Lägg till något fint från butiken så syns det här.</p>
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="border-t border-border/50 px-5 py-4 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Totalt</span>
              <span className="font-serif text-2xl">{formatSek(total)}</span>
            </div>
            <div className="relative overflow-hidden rounded-xl">
              <Button
                className="relative w-full h-12 rounded-xl text-base font-semibold shadow-[0_4px_16px_hsl(var(--primary)/0.35)] overflow-hidden group"
                onClick={onCheckout}
                disabled={checkingOut}
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {checkingOut
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Öppnar Stripe…</>
                  : <>Betala med Stripe</>}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Lock className="h-3 w-3" /> Säker kortbetalning via Stripe – priser verifieras alltid server-side
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
