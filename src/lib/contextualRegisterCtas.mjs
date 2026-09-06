/**
 * In-content CTAs for a few existing public URLs.
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

/** Path A copy-only demo CTA — /demo, never register/trial. One slug only. */
export const CONTEXTUAL_DEMO_CTAS = [
  {
    slug: 'berakna-foderkostnad-for-hons',
    path: '/blogg/berakna-foderkostnad-for-hons',
    href: '/demo?source=foderkostnad',
    source: 'foderkostnad',
    afterHeading: 'Beräkna foderkostnad för höns per månad',
    body: 'Siffrorna i artikeln är exempel. Se foder och ägg ihop i appen — utan konto.',
    button: 'Se demo utan konto',
  },
];

export const CONTEXTUAL_CTAS = [
  ...CONTEXTUAL_REGISTER_CTAS,
  ...CONTEXTUAL_DEMO_CTAS,
];

export function contextualRegisterCtaForSlug(slug) {
  if (!slug) return undefined;
  return CONTEXTUAL_REGISTER_CTAS.find((cta) => cta.slug === slug);
}

export function contextualDemoCtaForSlug(slug) {
  if (!slug) return undefined;
  return CONTEXTUAL_DEMO_CTAS.find((cta) => cta.slug === slug);
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
    + `<p class="mt-4"><a href="${escapeHtml(cta.href)}" class="contextual-cta-button inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">${escapeHtml(cta.button)}</a></p>`
    + `</aside>`;
}

function decodeHtml(value = '') {
  return String(value).replace(/&amp;/g, '&');
}

export function htmlHasContextualRegisterCta(html, cta) {
  const decoded = decodeHtml(html);
  return decoded.includes(cta.href) && html.includes(cta.button) && html.includes(cta.body);
}

export function assertContextualRegisterCta(html, cta) {
  const decoded = decodeHtml(html);
  if (!decoded.includes(cta.href)) {
    throw new Error(`${cta.path} saknar CTA href ${cta.href}`);
  }
  if (!html.includes(cta.button)) {
    throw new Error(`${cta.path} saknar CTA-knapp «${cta.button}»`);
  }
  if (!html.includes(cta.body)) {
    throw new Error(`${cta.path} saknar CTA-brödtext «${cta.body}»`);
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

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** After the named heading's section (until next same/higher heading). Else after last aside, else end. */
export function injectAfterHeadingSection(html, heading, block) {
  const escaped = escapeRegExp(heading);
  const headingRe = new RegExp(
    `(<h([2-4])\\b[^>]*>[\\s\\S]*?${escaped}[\\s\\S]*?<\\/h\\2>)`,
    'i',
  );
  const match = headingRe.exec(html);
  if (match && match.index !== undefined) {
    const level = Number(match[2]);
    const headingEnd = match.index + match[1].length;
    const after = html.slice(headingEnd);
    const nextHeadingRe = new RegExp(`<h[1-${level}]\\b`, 'i');
    const next = after.search(nextHeadingRe);
    const insertAt = next === -1 ? html.length : headingEnd + next;
    return `${html.slice(0, insertAt)}${block}${html.slice(insertAt)}`;
  }

  const lastAside = html.lastIndexOf('</aside>');
  if (lastAside !== -1) {
    const insertAt = lastAside + '</aside>'.length;
    return `${html.slice(0, insertAt)}${block}${html.slice(insertAt)}`;
  }

  return `${html}${block}`;
}

function injectOneCta(html, cta) {
  if (!html || htmlHasContextualRegisterCta(html, cta)) return html;
  const block = renderContextualRegisterCtaHtml(cta);
  if (cta.after === 'comparison-table') return injectAfterComparisonTable(html, block);
  if (cta.afterHeading) return injectAfterHeadingSection(html, cta.afterHeading, block);
  return html;
}

/** Inject slug-matched register/demo CTAs. Idempotent. Other slugs unchanged. */
export function injectContextualRegisterCta(html = '', slug) {
  if (!html) return html;
  let result = html;
  const registerCta = contextualRegisterCtaForSlug(slug);
  if (registerCta?.after === 'comparison-table') {
    result = injectOneCta(result, registerCta);
  }
  const demoCta = contextualDemoCtaForSlug(slug);
  if (demoCta) {
    result = injectOneCta(result, demoCta);
  }
  return result;
}
