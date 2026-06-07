// Typer och hjälpare för anpassning av publika säljsidor (Agdas bod).

export type ThemeBackground = 'cream' | 'light' | 'warm' | 'forest' | 'dark';
export type ThemeHeader = 'classic' | 'hero' | 'minimal';

export type SaleTheme = {
  accent?: string;        // hex color
  bg?: ThemeBackground;
  headerStyle?: ThemeHeader;
  headline?: string;      // valfri override av rubrik
  tagline?: string;       // valfri override av kortbeskrivning
  logoUrl?: string;
  coverUrl?: string;
};

export type SaleSection =
  | { id: string; type: 'about'; title?: string; body: string; image?: string }
  | { id: string; type: 'rich_text'; title?: string; body: string }
  | { id: string; type: 'gallery'; title?: string; images: string[] }
  | { id: string; type: 'faq'; title?: string; items: { q: string; a: string }[] }
  | { id: string; type: 'hens'; title?: string; body: string; image?: string }
  | { id: string; type: 'highlight'; title: string; body: string; icon?: 'sparkles' | 'leaf' | 'heart' | 'sun' | 'shield' }
  | { id: string; type: 'video'; title?: string; url: string };

export type SaleSectionType = SaleSection['type'];

export const DEFAULT_THEME: SaleTheme = {
  accent: '#3A6B35',
  bg: 'cream',
  headerStyle: 'classic',
};

export const BG_CLASS: Record<ThemeBackground, string> = {
  cream: 'bg-[hsl(var(--background))]',
  light: 'bg-white',
  warm: 'bg-gradient-to-b from-[#FAF3E5] via-[#F6E9D0] to-[#F1DDB8]',
  forest: 'bg-gradient-to-b from-[#EAF1E5] via-[#DCE7D2] to-[#C8D9BC]',
  dark: 'bg-[#1A1F1A] text-stone-100',
};

export const ACCENT_PRESETS: { label: string; hex: string }[] = [
  { label: 'Mossgrön', hex: '#3A6B35' },
  { label: 'Höstrost', hex: '#B5562C' },
  { label: 'Solgul', hex: '#E0A82E' },
  { label: 'Himmelblå', hex: '#3A6E8F' },
  { label: 'Plommon', hex: '#7C3F58' },
  { label: 'Terrakotta', hex: '#C2674E' },
  { label: 'Vintergrön', hex: '#264D3B' },
  { label: 'Kol', hex: '#2F2F2F' },
];

export const SECTION_LABELS: Record<SaleSectionType, string> = {
  about: 'Om gården',
  rich_text: 'Textsektion',
  gallery: 'Bildgalleri',
  faq: 'Vanliga frågor',
  hens: 'Våra höns',
  highlight: 'Highlight-banner',
  video: 'Video',
};

export function normalizeTheme(raw: any): SaleTheme {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_THEME };
  return { ...DEFAULT_THEME, ...raw };
}

export function normalizeSections(raw: any): SaleSection[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is SaleSection => !!s && typeof s === 'object' && typeof s.type === 'string' && typeof s.id === 'string');
}

export function newSection(type: SaleSectionType): SaleSection {
  const id = (globalThis.crypto?.randomUUID?.() || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  switch (type) {
    case 'about': return { id, type, title: 'Om gården', body: 'Här berättar du kort om dig och din hönsgård.', image: '' };
    case 'rich_text': return { id, type, title: 'Rubrik', body: 'Skriv något om dina ägg, foder, hämtning eller leverans.' };
    case 'gallery': return { id, type, title: 'Bilder från gården', images: [] };
    case 'faq': return { id, type, title: 'Vanliga frågor', items: [{ q: 'Hur ofta får ni nya ägg?', a: 'Vi samlar ägg varje morgon och uppdaterar lagret löpande.' }] };
    case 'hens': return { id, type, title: 'Våra höns', body: 'Vi har en blandning av raser som lever ute i flock.', image: '' };
    case 'highlight': return { id, type, title: 'Frigående', body: 'Våra höns går ute hela dagen och hämtas in på kvällen.', icon: 'leaf' };
    case 'video': return { id, type, title: 'Hälsning från gården', url: '' };
  }
}
