// Kundvagnslogik för webbshoppen – rena funktioner, lätta att testa.
// v2: stöd för varianter, versionshantering och frakt.

export interface CartItem {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
}

export interface PricedVariant {
  id: string;
  product_id: string;
  price_override_ore: number | null;
  stock: number | null;
  active: boolean;
}

export interface PricedProduct {
  id: string;
  price_ore: number;
  stock: number | null;
  variants?: PricedVariant[];
}

const CART_KEY = 'honsgarden_shop_cart_v2';
const LEGACY_KEY = 'honsgarden_shop_cart';

function keyOf(it: Pick<CartItem, 'product_id' | 'variant_id'>) {
  return `${it.product_id}::${it.variant_id ?? ''}`;
}

function effectiveStock(product: PricedProduct | undefined, variantId?: string | null): number | null {
  if (!product) return 0;
  if (variantId) {
    const v = product.variants?.find((x) => x.id === variantId);
    if (!v) return 0;
    return v.stock;
  }
  return product.stock;
}

function unitPrice(product: PricedProduct | undefined, variantId?: string | null): number {
  if (!product) return 0;
  if (variantId) {
    const v = product.variants?.find((x) => x.id === variantId);
    if (v?.price_override_ore != null) return v.price_override_ore;
  }
  return product.price_ore;
}

/** Lägg till en vara (eller öka antalet om den redan finns). */
export function addToCart(
  cart: CartItem[],
  productId: string,
  stock: number | null = null,
  variantId: string | null = null,
): CartItem[] {
  const k = keyOf({ product_id: productId, variant_id: variantId });
  const existing = cart.find((it) => keyOf(it) === k);
  const maxQty = stock !== null ? Math.max(0, stock) : 99;
  if (existing) {
    return cart.map((it) =>
      keyOf(it) === k ? { ...it, quantity: Math.min(it.quantity + 1, maxQty) } : it,
    );
  }
  if (maxQty < 1) return cart;
  return [...cart, { product_id: productId, variant_id: variantId, quantity: 1 }];
}

/** Sätt exakt antal; 0 tar bort varan. */
export function setQuantity(
  cart: CartItem[],
  productId: string,
  quantity: number,
  variantId: string | null = null,
): CartItem[] {
  const k = keyOf({ product_id: productId, variant_id: variantId });
  if (quantity <= 0) return cart.filter((it) => keyOf(it) !== k);
  return cart.map((it) => (keyOf(it) === k ? { ...it, quantity: Math.min(quantity, 99) } : it));
}

/** Ta bort en rad helt. */
export function removeFromCart(cart: CartItem[], productId: string, variantId: string | null = null): CartItem[] {
  const k = keyOf({ product_id: productId, variant_id: variantId });
  return cart.filter((it) => keyOf(it) !== k);
}

/** Totalt antal varor. */
export function cartCount(cart: CartItem[]): number {
  return cart.reduce((s, it) => s + it.quantity, 0);
}

/** Delsumma i öre. */
export function cartSubtotalOre(cart: CartItem[], products: PricedProduct[]): number {
  const byId = new Map(products.map((p) => [p.id, p]));
  return cart.reduce((sum, it) => sum + unitPrice(byId.get(it.product_id), it.variant_id) * it.quantity, 0);
}

/** Bakåtkompatibel alias. */
export const cartTotalOre = cartSubtotalOre;

export interface ShippingSettings {
  shippingOre: number;
  freeShippingThresholdOre: number;
}

/** Beräkna frakt baserat på subtotal. */
export function shippingForSubtotal(subtotalOre: number, settings: ShippingSettings): number {
  if (subtotalOre <= 0) return 0;
  if (settings.freeShippingThresholdOre > 0 && subtotalOre >= settings.freeShippingThresholdOre) return 0;
  return Math.max(0, settings.shippingOre);
}

/** Totalpris inkl. frakt i öre. */
export function cartTotalWithShippingOre(cart: CartItem[], products: PricedProduct[], settings: ShippingSettings) {
  const subtotal = cartSubtotalOre(cart, products);
  const shipping = shippingForSubtotal(subtotal, settings);
  return { subtotal, shipping, total: subtotal + shipping };
}

/** Formatera öre som svenska kronor. */
export function formatSek(ore: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: ore % 100 === 0 ? 0 : 2,
  }).format(ore / 100);
}

export function loadCart(): CartItem[] {
  try {
    let raw = localStorage.getItem(CART_KEY);
    if (!raw) {
      // Migrera från v1 om det finns
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        raw = legacy;
        try { localStorage.setItem(CART_KEY, legacy); localStorage.removeItem(LEGACY_KEY); } catch { /* noop */ }
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it): it is CartItem =>
        typeof it?.product_id === 'string'
        && Number.isFinite(it?.quantity)
        && it.quantity > 0
      )
      .map((it) => ({
        product_id: it.product_id,
        variant_id: typeof it.variant_id === 'string' ? it.variant_id : null,
        quantity: Math.min(99, Math.max(1, Math.floor(it.quantity))),
      }));
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    /* privat surfning – kundvagnen lever bara i minnet */
  }
}

export function clearCart(): void {
  try { localStorage.removeItem(CART_KEY); } catch { /* noop */ }
}
