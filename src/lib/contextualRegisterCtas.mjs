/**
 * In-content register-CTAs for three existing public URLs.
 * Copy is the Growth spec — do not rewrite.
 *
 * Keep in sync with `src/lib/contextualRegisterCtas.ts`.
 */

export const CONTEXTUAL_REGISTER_CTAS = [
  {
    slug: 'orpington',
    path: '/honsraser/orpington',
    href: '/login?mode=register&source=orpington',
    source: 'orpington',
    afterHeading: 'Hur många ägg lägger en orpington per år?',
    body: 'Guiden säger ~180 ägg per år. Dina egna hönor visar hur det ser ut hos dig.',
    button: 'Logga ägg från din Orpington — gratis',
  },
  {
    slug: 'sussex',
    path: '/honsraser/sussex',
    href: '/login?mode=register&source=sussex',
    source: 'sussex',
    afterHeading: 'Hur många ägg lägger en sussex per år?',
    body: 'Sussex värper ~240 ägg. Logga dina så ser du mönstret, inte bara minnet.',
    button: 'Logga ägg från din Sussex — gratis',
  },
  {
    slug: 'bast-honsras-sverige',
    path: '/blogg/bast-honsras-sverige',
    href: '/login?mode=register&source=bast-honsras',
    source: 'bast-honsras',
    after: 'comparison-table',
    body: 'Tabellen är teori. Logga värpning per höna så ser du vilken ras som faktiskt funkar i din flock.',
    button: 'Logga värpning i din flock — gratis',
  },
];

export function contextualRegisterCtaForSlug(slug) {
  if (!slug) return undefined;
  return CONTEXTUAL_REGISTER_CTAS.find((cta) => cta.slug === slug);
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderContextualRegisterCtaHtml(cta) {
  return `<aside class="my-8 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/8 via-card to-accent/5 p-5 sm:p-6" aria-label="${escapeHtml(cta.button)}">`
    + `<p class="text-sm text-muted-foreground leading-relaxed">${escapeHtml(cta.body)}</p>`
    + `<p class="mt-4"><a href="${escapeHtml(cta.href)}" class="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">${escapeHtml(cta.button)}</a></p>`
    + `</aside>`;
}

function decodeHtml(value = '') {
  return String(value).replace(/&amp;/g, '&');
}

export function htmlHasContextualRegisterCta(html, cta) {
  const decoded = decodeHtml(html);
  return decoded.includes(cta.href) && html.includes(cta.button);
}

export function assertContextualRegisterCta(html, cta) {
  const decoded = decodeHtml(html);
  if (!decoded.includes(cta.href)) {
    throw new Error(`${cta.path} saknar register-CTA href ${cta.href}`);
  }
  if (!html.includes(cta.button)) {
    throw new Error(`${cta.path} saknar register-CTA-knapp «${cta.button}»`);
  }
}

function injectAfterComparisonTable(html, block) {
  const withHeading = html.replace(
    /(<h2\b[^>]*>[\s\S]*?Jämförelsetabell[\s\S]*?<\/h2>[\s\S]*?<div class="table-wrapper">[\s\S]*?<\/table>\s*<\/div>)/i,
    `$1${block}`,
  );
  if (withHeading !== html) return withHeading;

  const firstWrapper = html.replace(
    /(<div class="table-wrapper">[\s\S]*?<\/table>\s*<\/div>)/i,
    `$1${block}`,
  );
  if (firstWrapper !== html) return firstWrapper;

  const firstTable = html.replace(/<\/table>/i, `</table>${block}`);
  if (firstTable !== html) return firstTable;

  return `${html}${block}`;
}

/** Inject the bast-honsras CTA after the jämförelsetabell. Idempotent. Other slugs unchanged. */
export function injectContextualRegisterCta(html = '', slug) {
  const cta = contextualRegisterCtaForSlug(slug);
  if (!cta || cta.after !== 'comparison-table' || !html) return html;
  if (htmlHasContextualRegisterCta(html, cta)) return html;
  return injectAfterComparisonTable(html, renderContextualRegisterCtaHtml(cta));
}
