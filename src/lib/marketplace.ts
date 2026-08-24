import type { Database } from '@/integrations/supabase/types';

export type MarketplaceListing = Database['public']['Tables']['marketplace_listings']['Row'];
export type MarketplaceMessage = Database['public']['Tables']['marketplace_messages']['Row'];
export type MarketplaceCategory =
  | 'hons-kycklingar' | 'tuppar' | 'klackagg' | 'andra-djur'
  | 'honshus-inredning' | 'foder-tillskott' | 'maskiner-redskap'
  | 'stangsel' | 'ovrigt' | 'skankes' | 'kopes';

export const CATEGORIES: { value: MarketplaceCategory; label: string; emoji: string }[] = [
  { value: 'hons-kycklingar', label: 'Höns & kycklingar', emoji: '🐔' },
  { value: 'tuppar', label: 'Tuppar', emoji: '🐓' },
  { value: 'klackagg', label: 'Kläckägg', emoji: '🥚' },
  { value: 'andra-djur', label: 'Andra djur', emoji: '🐑' },
  { value: 'honshus-inredning', label: 'Hönshus & inredning', emoji: '🏠' },
  { value: 'foder-tillskott', label: 'Foder & tillskott', emoji: '🌾' },
  { value: 'maskiner-redskap', label: 'Maskiner & redskap', emoji: '🔧' },
  { value: 'stangsel', label: 'Stängsel', emoji: '🪵' },
  { value: 'skankes', label: 'Skänkes', emoji: '🎁' },
  { value: 'kopes', label: 'Köpes', emoji: '🔍' },
  { value: 'ovrigt', label: 'Övrigt', emoji: '📦' },
];

export const REGIONS = [
  'Blekinge', 'Dalarna', 'Gotland', 'Gävleborg', 'Halland', 'Jämtland',
  'Jönköping', 'Kalmar', 'Kronoberg', 'Norrbotten', 'Skåne', 'Stockholm',
  'Södermanland', 'Uppsala', 'Värmland', 'Västerbotten', 'Västernorrland',
  'Västmanland', 'Västra Götaland', 'Örebro', 'Östergötland',
];

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function categoryEmoji(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.emoji ?? '📦';
}

export function formatPrice(price: number | null, isGiveaway: boolean): string {
  if (isGiveaway) return 'Skänkes';
  if (price === null || price === 0) return 'Pris ej angivet';
  return `${price.toLocaleString('sv-SE')} kr`;
}

export function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just nu';
  if (diff < 3600) return `${Math.floor(diff / 60)} min sedan`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} tim sedan`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} d sedan`;
  return new Date(iso).toLocaleDateString('sv-SE');
}

/** Maskera kontaktuppgifter i fritext för att skydda mot kringgående av meddelandesystemet. */
export function hasContactInfo(text: string): boolean {
  const phone = /(\+?46|0)\s?[1-9](\s?\d){7,9}/;
  const email = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  return phone.test(text) || email.test(text);
}
