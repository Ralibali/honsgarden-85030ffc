/**
 * Topic H1 + CTR titles for prerendered public pages.
 *
 * Keep in sync with `src/lib/prerenderTopicPages.mjs`.
 *  - .ts  används av tester och klient-SEO
 *  - .mjs används av scripts/prerender-blog-posts.mjs
 */

export const CTR_DOCUMENT_TITLES: Record<string, string> = {
  '/honsraser/orpington': 'Orpington-höna – nybörjarvänlig ras, ~180 ägg/år | Hönsgården',
  '/honsraser/sussex': 'Sussex-höna – nyfiken ras som värper ~240 ägg | Hönsgården',
  '/blogg/berakna-foderkostnad-for-hons': 'Beräkna foderkostnad för höns – kalkyl för din flock | Hönsgården',
};

export const TOPIC_PAGE_PATHS = Object.keys(CTR_DOCUMENT_TITLES);

export function documentTitleForPath(path: string, fallback: string): string {
  return CTR_DOCUMENT_TITLES[path] || fallback;
}

export function breedTopicH1(breed: { namn: string; h1Suffix?: string }): string {
  if (breed.h1Suffix) return `${breed.namn} – ${breed.h1Suffix}`;
  return `${breed.namn} – värpning, temperament och skötsel`;
}

export function escapeHtml(value = ''): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function stripGenericBrandH1(html = ''): string {
  return String(html).replace(/<h1(?:\s[^>]*)?>\s*Hönsgården\s*<\/h1>/gi, '');
}

export function injectTopicBody(html: string, bodyHtml: string): string {
  return stripGenericBrandH1(
    String(html).replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`),
  );
}

export function renderBreedTopicBody(
  breed: { namn: string; description?: string; faq?: [string, string][]; h1Suffix?: string },
  h1 = breedTopicH1(breed),
): string {
  const faqHtml = (breed.faq || []).map(([q, a]) => (
    `<div><h2 class="text-sm font-semibold text-foreground mb-1">${escapeHtml(q)}</h2>`
    + `<p class="text-sm text-muted-foreground leading-relaxed">${escapeHtml(a)}</p></div>`
  )).join('');

  return `<div class="min-h-screen bg-background">
<main class="container mx-auto max-w-4xl px-5 pt-24 pb-16" id="main-content" tabindex="-1">
  <nav class="text-xs text-muted-foreground mb-4"><a href="/">Hem</a> / <a href="/honsraser">Hönsraser</a> / ${escapeHtml(breed.namn)}</nav>
  <h1 class="font-serif text-4xl md:text-5xl text-foreground mb-3">${escapeHtml(h1)}</h1>
  <p class="text-muted-foreground max-w-2xl mb-8 leading-relaxed">${escapeHtml(breed.description || '')}</p>
  <section class="max-w-3xl border-t border-border/40 pt-8">
    <h2 class="font-serif text-2xl text-foreground mb-4">Vanliga frågor</h2>
    <div class="space-y-5">${faqHtml}</div>
    <p class="mt-8 text-xs text-muted-foreground"><a href="/honsraser" class="underline">← Alla hönsraser</a></p>
  </section>
</main></div>`;
}

export function extractH1Texts(html = ''): string[] {
  return [...String(html).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => (
    match[1].replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
  ));
}

export function extractTitle(html = ''): string {
  const match = String(html).match(/<title>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim() : '';
}

export function isGenericBrandH1(text = ''): boolean {
  return String(text).replace(/<[^>]+>/g, '').trim() === 'Hönsgården';
}

export function isGenericBrandTitle(title = ''): boolean {
  const value = String(title).trim();
  return !value || value === 'Hönsgården' || value.startsWith('Hönsgården – Äggloggare');
}

export const HOME_PATH = '/';
export const HOME_TOPIC_H1 = 'Lite enklare att ha höns';
export const HOME_DOCUMENT_TITLE =
  'Hönsgården – svensk app för hönsägare, ägglogg och hönskalender';

export function renderHomeTopicBody(): string {
  return `<div class="min-h-screen" style="background:#faf8f4;color:#22392b">
<main class="container mx-auto max-w-6xl px-5 pt-28 pb-16" id="main-content" tabindex="-1">
  <p class="text-sm tracking-wide mb-5" style="color:#7d9b76">Svensk app för hönsägare</p>
  <h1 class="font-serif text-4xl md:text-6xl leading-tight mb-5">Lite enklare att ha höns.<br /><span style="color:#7d9b76">Lite roligare att följa dem.</span></h1>
  <p class="max-w-xl text-base leading-relaxed mb-8">Ägglogg, hönsprofiler, foderkostnad, kalender och Agdas äggbod på ett ställe. Logga vardagen, se mönstren och sälj ägg utan Excel-kaos.</p>
  <p><a href="/login?mode=register" class="inline-flex items-center justify-center rounded-full px-8 py-3 font-medium" style="background:#3a6b35;color:#f4f1e6">Kom igång gratis</a></p>
</main>
</div>`;
}

export function extractRootInnerHtml(html = ''): string {
  const startMatch = String(html).match(/<div id="root"[^>]*>/i);
  if (!startMatch || startMatch.index == null) return '';
  const from = startMatch.index + startMatch[0].length;
  const rest = String(html).slice(from);
  const noscriptAt = rest.search(/<noscript[\s>]/i);
  const scriptAt = rest.search(/<script[\s>]/i);
  const candidates = [noscriptAt, scriptAt].filter((index) => index >= 0);
  const end = candidates.length ? Math.min(...candidates) : rest.length;
  return rest.slice(0, end).replace(/<\/div>\s*$/i, '').trim();
}

export function assertHomePageHtml(html: string) {
  const root = extractRootInnerHtml(html);
  if (!root) {
    throw new Error('/ har tomt #root');
  }
  if (!root.includes(HOME_TOPIC_H1)) {
    throw new Error(`/#root saknar topic-H1 «${HOME_TOPIC_H1}»`);
  }
  return assertTopicPageHtml(html, {
    path: HOME_PATH,
    topicH1: HOME_TOPIC_H1,
    titleIncludes: ['ägglogg', 'hönskalender'],
  });
}

export function assertTopicPageHtml(
  html: string,
  { topicH1, titleIncludes, path }: { topicH1: string; titleIncludes?: string[]; path?: string },
) {
  const h1s = extractH1Texts(html);
  const title = extractTitle(html);
  const generic = h1s.filter(isGenericBrandH1);
  if (generic.length) {
    throw new Error(`${path || 'sidan'} har fortfarande generic H1 «Hönsgården»`);
  }
  if (!h1s.some((h1) => h1.includes(topicH1))) {
    throw new Error(`${path || 'sidan'} saknar topic-H1 «${topicH1}» (hittade: ${h1s.join(' | ') || 'ingen'})`);
  }
  if (isGenericBrandTitle(title)) {
    throw new Error(`${path || 'sidan'} har generic title: ${title || '(saknas)'}`);
  }
  for (const needle of titleIncludes || []) {
    if (!title.includes(needle)) {
      throw new Error(`${path || 'sidan'} title saknar «${needle}»: ${title}`);
    }
  }
  return { h1s, title };
}
