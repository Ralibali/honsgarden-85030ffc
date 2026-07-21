// Publika hooks och typer för webbshoppen.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ShippingSettings } from '@/lib/shopCart';

export interface ShopVariant {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  options: Record<string, string> | null;
  price_override_ore: number | null;
  stock: number | null;
  active: boolean;
  sort_order: number;
}

export interface ShopProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  long_description: string | null;
  emoji: string;
  image_url: string | null;
  images: string[];
  features: string[];
  specifications: Record<string, string> | null;
  badge: string | null;
  category: string | null;
  featured: boolean;
  is_example: boolean;
  price_ore: number;
  stock: number | null;
  active: boolean;
  shipping_days_min: number | null;
  shipping_days_max: number | null;
  sort_order: number;
  variants: ShopVariant[];
}

export interface ShopSettings extends ShippingSettings {
  publicEnabled: boolean;
  supportEmail: string;
  deliveryText: string;
  deliveryMethod: string;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  companyName: string;
  companyOrgNumber: string;
  companyAddress: string;
  returnAddress: string;
  termsReviewedAt: string | null;
}

export const DEFAULT_SETTINGS: ShopSettings = {
  publicEnabled: false,
  shippingOre: 5900,
  freeShippingThresholdOre: 49900,
  supportEmail: '',
  deliveryText: '',
  deliveryMethod: '',
  deliveryDaysMin: null,
  deliveryDaysMax: null,
  companyName: '',
  companyOrgNumber: '',
  companyAddress: '',
  returnAddress: '',
  termsReviewedAt: null,
};

/** Robust parsning av jsonb-värden från system_settings. */
export function readSettingString(row: unknown, fallback = ''): string {
  if (row === null || row === undefined) return fallback;
  if (typeof row === 'string') {
    const s = row.trim();
    if (s === '' || s === 'null') return fallback;
    if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
    return s;
  }
  if (typeof row === 'number' || typeof row === 'boolean') return String(row);
  return fallback;
}

export function readSettingBool(row: unknown, fallback = false): boolean {
  if (row === null || row === undefined) return fallback;
  if (typeof row === 'boolean') return row;
  const s = readSettingString(row, '').toLowerCase();
  if (s === 'true' || s === '1') return true;
  if (s === 'false' || s === '0') return false;
  return fallback;
}

export function readSettingNumber(row: unknown, fallback: number | null): number | null {
  if (row === null || row === undefined) return fallback;
  if (typeof row === 'number' && Number.isFinite(row)) return row;
  const s = readSettingString(row, '');
  if (s === '' || s === 'null') return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

export function readSettingDate(row: unknown): string | null {
  const s = readSettingString(row, '');
  if (!s || s === 'null') return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? s : null;
}

export function useShopSettings() {
  return useQuery<ShopSettings>({
    queryKey: ['shop-settings'],
    staleTime: 60_000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_shop_settings');
      if (error) return DEFAULT_SETTINGS;
      const raw = (data ?? {}) as Record<string, unknown>;
      return {
        publicEnabled: readSettingBool(raw['shop_public_enabled'], DEFAULT_SETTINGS.publicEnabled),
        shippingOre: readSettingNumber(raw['shop_shipping_ore'], DEFAULT_SETTINGS.shippingOre) ?? DEFAULT_SETTINGS.shippingOre,
        freeShippingThresholdOre: readSettingNumber(raw['shop_free_shipping_threshold_ore'], DEFAULT_SETTINGS.freeShippingThresholdOre) ?? DEFAULT_SETTINGS.freeShippingThresholdOre,
        supportEmail: readSettingString(raw['shop_support_email'], DEFAULT_SETTINGS.supportEmail),
        deliveryText: readSettingString(raw['shop_delivery_text'], DEFAULT_SETTINGS.deliveryText),
        deliveryMethod: readSettingString(raw['shop_delivery_method'], DEFAULT_SETTINGS.deliveryMethod),
        deliveryDaysMin: readSettingNumber(raw['shop_delivery_days_min'], null),
        deliveryDaysMax: readSettingNumber(raw['shop_delivery_days_max'], null),
        companyName: readSettingString(raw['shop_company_name'], ''),
        companyOrgNumber: readSettingString(raw['shop_company_org_number'], ''),
        companyAddress: readSettingString(raw['shop_company_address'], ''),
        returnAddress: readSettingString(raw['shop_return_address'], ''),
        termsReviewedAt: readSettingDate(raw['shop_terms_reviewed_at']),
      };
    },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeProduct(p: any, variants: any[] = []): ShopProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description ?? '',
    long_description: p.long_description ?? null,
    emoji: p.emoji ?? '🥚',
    image_url: p.image_url ?? null,
    images: Array.isArray(p.images) ? p.images : [],
    features: Array.isArray(p.features) ? p.features : [],
    specifications: (p.specifications && typeof p.specifications === 'object') ? p.specifications : null,
    badge: p.badge ?? null,
    category: p.category ?? null,
    featured: !!p.featured,
    is_example: !!p.is_example,
    price_ore: p.price_ore,
    stock: p.stock,
    active: !!p.active,
    shipping_days_min: p.shipping_days_min ?? null,
    shipping_days_max: p.shipping_days_max ?? null,
    sort_order: p.sort_order ?? 0,
    variants: variants
      .filter((v) => v.product_id === p.id && v.active)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((v) => ({
        id: v.id, product_id: v.product_id, name: v.name, sku: v.sku ?? null,
        options: (v.options && typeof v.options === 'object') ? v.options : null,
        price_override_ore: v.price_override_ore ?? null,
        stock: v.stock, active: !!v.active, sort_order: v.sort_order ?? 0,
      })),
  };
}

export function useShopProducts() {
  return useQuery<ShopProduct[]>({
    queryKey: ['shop-products-public'],
    staleTime: 30_000,
    queryFn: async () => {
      const [pRes, vRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('shop_products').select('*').eq('active', true).order('sort_order'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).from('shop_product_variants').select('*').eq('active', true),
      ]);
      if (pRes.error) throw pRes.error;
      const variants = vRes.error ? [] : (vRes.data ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (pRes.data ?? []).map((p: any) => normalizeProduct(p, variants));
    },
  });
}

export function useShopProduct(slug: string | undefined) {
  return useQuery<ShopProduct | null>({
    queryKey: ['shop-product-public', slug],
    enabled: !!slug,
    staleTime: 30_000,
    queryFn: async () => {
      if (!slug) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: p, error } = await (supabase as any)
        .from('shop_products').select('*').eq('slug', slug).eq('active', true).maybeSingle();
      if (error) throw error;
      if (!p) return null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: variants } = await (supabase as any)
        .from('shop_product_variants').select('*').eq('product_id', p.id).eq('active', true);
      return normalizeProduct(p, variants ?? []);
    },
  });
}

export function primaryImage(product: ShopProduct): string | null {
  return product.images[0] ?? product.image_url ?? null;
}

export function priceForVariant(product: ShopProduct, variantId: string | null): number {
  if (variantId) {
    const v = product.variants.find((x) => x.id === variantId);
    if (v?.price_override_ore != null) return v.price_override_ore;
  }
  return product.price_ore;
}

export function stockForVariant(product: ShopProduct, variantId: string | null): number | null {
  if (variantId) {
    const v = product.variants.find((x) => x.id === variantId);
    return v ? v.stock : 0;
  }
  return product.stock;
}
