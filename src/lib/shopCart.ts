// Kundvagnslogik för webbshoppen – rena funktioner, lätta att testa.

export interface CartItem {
  product_id: string;
  quantity: number;
}

export interface PricedProduct {
  id: string;
  price_ore: number;
  stock: number | null;
}

const CART_KEY = 'honsgarden_shop_cart';

/** Lägg till en vara (eller öka antalet om den redan finns). */
export function addToCart(cart: CartItem[], productId: string, stock: number | null = null): CartItem[] {
  const existing = cart.find((it) => it.product_id === productId);
  const maxQty = stock !== null ? Math.max(0, stock) : 99;
  if (existing) {
    return cart.map((it) =>
      it.product_id === productId ? { ...it, quantity: Math.min(it.quantity + 1, maxQty) } : it,
    );
  }
  if (maxQty < 1) return cart;
  return [...cart, { product_id: productId, quantity: 1 }];
}

/** Sätt exakt antal; 0 tar bort varan. */
export function setQuantity(cart: CartItem[], productId: string, quantity: number): CartItem[] {
  if (quantity <= 0) return cart.filter((it) => it.product_id !== productId);
  return cart.map((it) =>
    it.product_id === productId ? { ...it, quantity: Math.min(quantity, 99) } : it,
  );
}

/** Totalt antal varor i kundvagnen. */
export function cartCount(cart: CartItem[]): number {
  return cart.reduce((sum, it) => sum + it.quantity, 0);
}

/** Totalt pris i öre, givet aktuella produktpriser från databasen. */
export function cartTotalOre(cart: CartItem[], products: PricedProduct[]): number {
  const byId = new Map(products.map((p) => [p.id, p]));
  return cart.reduce((sum, it) => {
    const product = byId.get(it.product_id);
    return product ? sum + product.price_ore * it.quantity : sum;
  }, 0);
}

/** Formatera öre som svenska kronor, t.ex. "1 249 kr". */
export function formatSek(ore: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: ore % 100 === 0 ? 0 : 2,
  }).format(ore / 100);
}

export function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (it): it is CartItem =>
        typeof it?.product_id === 'string' && Number.isFinite(it?.quantity) && it.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function saveCart(cart: CartItem[]): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // Privat surfning m.m. – kundvagnen lever bara i minnet då.
  }
}
