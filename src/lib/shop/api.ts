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
  companyName: string;
  companyOrgNumber: string;
  companyAddress: string;
  returnAddress: string;
  deliveryMethod: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
  termsReviewedAt: string | null;
}

const DEFAULT_SETTINGS: ShopSettings = {
  publicEnabled: false,
  shippingOre: 5900,
  freeShippingThresholdOre: 49900,
  supportEmail: 'info@auroramedia.se',
  deliveryText: 'Vi packar din order inom 1–3 arbetsdagar och skickar med Postnord.',
  companyName: '',
  companyOrgNumber: '',
  companyAddress: '',
  returnAddress: '',
  deliveryMethod: 'Postnord',
  deliveryDaysMin: 1,
  deliveryDaysMax: 3,
  termsReviewedAt: null,
};

function readSetting<T>(row: unknown, fallback: T): T {
  if (row === null || row === undefined) return fallback;
  if (typeof row === typeof fallback) return row as T;
  if (typeof row === 'string') {
    if ((row.startsWith('"') && row.endsWith('"'))) return row.slice(1, -1) as unknown as T;
    if (typeof fallback === 'number') {
      const n = Number(row); return (Number.isFinite(n) ? n : fallback) as unknown as T;
    }
    if (typeof fallback === 'boolean') return (row === 'true') as unknown as T;
    return row as unknown as T;
  }
  return row as T;
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
      const termsRaw = raw['shop_terms_reviewed_at'];
      const termsReviewedAt = typeof termsRaw === 'string'
        ? termsRaw.replace(/^"|"$/g, '') || null
        : (termsRaw ? String(termsRaw) : null);
      return {
        publicEnabled: readSetting(raw['shop_public_enabled'], DEFAULT_SETTINGS.publicEnabled),
        shippingOre: readSetting(raw['shop_shipping_ore'], DEFAULT_SETTINGS.shippingOre),
        freeShippingThresholdOre: readSetting(raw['shop_free_shipping_threshold_ore'], DEFAULT_SETTINGS.freeShippingThresholdOre),
        supportEmail: readSetting(raw['shop_support_email'], DEFAULT_SETTINGS.supportEmail),
        deliveryText: readSetting(raw['shop_delivery_text'], DEFAULT_SETTINGS.deliveryText),
        companyName: readSetting(raw['shop_company_name'], DEFAULT_SETTINGS.companyName),
        companyOrgNumber: readSetting(raw['shop_company_org_number'], DEFAULT_SETTINGS.companyOrgNumber),
        companyAddress: readSetting(raw['shop_company_address'], DEFAULT_SETTINGS.companyAddress),
        returnAddress: readSetting(raw['shop_return_address'], DEFAULT_SETTINGS.returnAddress),
        deliveryMethod: readSetting(raw['shop_delivery_method'], DEFAULT_SETTINGS.deliveryMethod),
        deliveryDaysMin: readSetting(raw['shop_delivery_days_min'], DEFAULT_SETTINGS.deliveryDaysMin),
        deliveryDaysMax: readSetting(raw['shop_delivery_days_max'], DEFAULT_SETTINGS.deliveryDaysMax),
        termsReviewedAt,
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
