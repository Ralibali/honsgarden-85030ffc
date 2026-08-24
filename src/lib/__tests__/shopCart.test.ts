import { describe, it, expect, beforeEach } from 'vitest';
import {
  addToCart,
  setQuantity,
  removeFromCart,
  cartCount,
  cartSubtotalOre,
  cartTotalWithShippingOre,
  shippingForSubtotal,
  formatSek,
  loadCart,
  saveCart,
  clearCart,
  type CartItem,
} from '@/lib/shopCart';

const SETTINGS = { shippingOre: 5900, freeShippingThresholdOre: 49900 };

describe('shopCart', () => {
  beforeEach(() => localStorage.clear());

  it('lägger till ny vara', () => {
    expect(addToCart([], 'a')).toEqual([{ product_id: 'a', variant_id: null, quantity: 1 }]);
  });

  it('ökar antal för befintlig vara med samma variant', () => {
    const cart = addToCart([{ product_id: 'a', variant_id: null, quantity: 2 }], 'a');
    expect(cart[0].quantity).toBe(3);
  });

  it('behandlar olika varianter som separata rader', () => {
    let cart: CartItem[] = [];
    cart = addToCart(cart, 'a', null, 'v1');
    cart = addToCart(cart, 'a', null, 'v2');
    expect(cart).toHaveLength(2);
  });

  it('respekterar lagersaldo', () => {
    const cart = addToCart([{ product_id: 'a', variant_id: null, quantity: 3 }], 'a', 3);
    expect(cart[0].quantity).toBe(3);
  });

  it('lägger inte till vara med noll lager', () => {
    expect(addToCart([], 'a', 0)).toEqual([]);
  });

  it('setQuantity 0 tar bort varan', () => {
    const cart = setQuantity(
      [{ product_id: 'a', variant_id: null, quantity: 2 }, { product_id: 'b', variant_id: null, quantity: 1 }],
      'a', 0,
    );
    expect(cart).toEqual([{ product_id: 'b', variant_id: null, quantity: 1 }]);
  });

  it('removeFromCart tar bort exakt matchande variant', () => {
    const cart: CartItem[] = [
      { product_id: 'a', variant_id: 'x', quantity: 1 },
      { product_id: 'a', variant_id: 'y', quantity: 1 },
    ];
    expect(removeFromCart(cart, 'a', 'x')).toEqual([{ product_id: 'a', variant_id: 'y', quantity: 1 }]);
  });

  it('räknar totalt antal', () => {
    expect(cartCount([
      { product_id: 'a', variant_id: null, quantity: 2 },
      { product_id: 'b', variant_id: null, quantity: 3 },
    ])).toBe(5);
  });

  it('räknar subtotal med variantpris', () => {
    const cart: CartItem[] = [
      { product_id: 'a', variant_id: 'v1', quantity: 2 },
      { product_id: 'a', variant_id: null, quantity: 1 },
    ];
    const products = [{
      id: 'a', price_ore: 10000, stock: null, variants: [
        { id: 'v1', product_id: 'a', price_override_ore: 15000, stock: null, active: true },
      ],
    }];
    expect(cartSubtotalOre(cart, products)).toBe(15000 * 2 + 10000);
  });

  it('frakt: 59 kr under tröskel', () => {
    expect(shippingForSubtotal(10000, SETTINGS)).toBe(5900);
  });

  it('frakt: fri vid/över tröskel', () => {
    expect(shippingForSubtotal(49900, SETTINGS)).toBe(0);
    expect(shippingForSubtotal(60000, SETTINGS)).toBe(0);
  });

  it('cartTotalWithShippingOre summerar korrekt', () => {
    const cart: CartItem[] = [{ product_id: 'a', variant_id: null, quantity: 1 }];
    const products = [{ id: 'a', price_ore: 20000, stock: null }];
    const t = cartTotalWithShippingOre(cart, products, SETTINGS);
    expect(t).toEqual({ subtotal: 20000, shipping: 5900, total: 25900 });
  });

  it('formaterar öre till kronor', () => {
    expect(formatSek(24900)).toMatch(/249/);
    expect(formatSek(9950)).toMatch(/99,50/);
  });

  it('sparar och laddar kundvagn med varianter', () => {
    const cart: CartItem[] = [{ product_id: 'a', variant_id: 'v1', quantity: 2 }];
    saveCart(cart);
    expect(loadCart()).toEqual(cart);
    clearCart();
    expect(loadCart()).toEqual([]);
  });

  it('migrerar legacy-kundvagn från v1-nyckel', () => {
    localStorage.setItem('honsgarden_shop_cart', JSON.stringify([{ product_id: 'x', quantity: 3 }]));
    const cart = loadCart();
    expect(cart).toEqual([{ product_id: 'x', variant_id: null, quantity: 3 }]);
  });
});
