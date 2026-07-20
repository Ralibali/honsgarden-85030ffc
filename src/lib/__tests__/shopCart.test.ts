import { describe, it, expect } from 'vitest';
import {
  addToCart,
  setQuantity,
  cartCount,
  cartTotalOre,
  formatSek,
  type CartItem,
} from '@/lib/shopCart';

describe('shopCart', () => {
  it('lägger till ny vara', () => {
    const cart = addToCart([], 'a');
    expect(cart).toEqual([{ product_id: 'a', quantity: 1 }]);
  });

  it('ökar antal för befintlig vara', () => {
    const cart = addToCart([{ product_id: 'a', quantity: 2 }], 'a');
    expect(cart[0].quantity).toBe(3);
  });

  it('respekterar lagersaldo', () => {
    const cart = addToCart([{ product_id: 'a', quantity: 3 }], 'a', 3);
    expect(cart[0].quantity).toBe(3);
  });

  it('lägger inte till vara med noll lager', () => {
    expect(addToCart([], 'a', 0)).toEqual([]);
  });

  it('setQuantity 0 tar bort varan', () => {
    const cart = setQuantity([{ product_id: 'a', quantity: 2 }, { product_id: 'b', quantity: 1 }], 'a', 0);
    expect(cart).toEqual([{ product_id: 'b', quantity: 1 }]);
  });

  it('setQuantity sätter exakt antal med tak 99', () => {
    const cart = setQuantity([{ product_id: 'a', quantity: 1 }], 'a', 150);
    expect(cart[0].quantity).toBe(99);
  });

  it('räknar totalt antal', () => {
    const cart: CartItem[] = [
      { product_id: 'a', quantity: 2 },
      { product_id: 'b', quantity: 3 },
    ];
    expect(cartCount(cart)).toBe(5);
  });

  it('räknar totalpris med aktuella priser', () => {
    const cart: CartItem[] = [
      { product_id: 'a', quantity: 2 },
      { product_id: 'b', quantity: 1 },
      { product_id: 'saknas', quantity: 5 },
    ];
    const products = [
      { id: 'a', price_ore: 24900, stock: 10 },
      { id: 'b', price_ore: 9900, stock: null },
    ];
    expect(cartTotalOre(cart, products)).toBe(24900 * 2 + 9900);
  });

  it('formaterar öre till kronor', () => {
    expect(formatSek(24900)).toMatch(/249/);
    expect(formatSek(124900)).toMatch(/1.?249/);
    expect(formatSek(9950)).toMatch(/99,50/);
  });
});
