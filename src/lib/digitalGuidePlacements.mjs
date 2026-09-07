// Explicitly reviewed article matches: do not promote a chicken guide on
// unrelated gardening articles merely because their title says beginner.
const BEGINNER_ARTICLES = new Set([
  'hobbyhons-nyborjarguide', 'skaffa-hons-nyborjare',
  'skaffa-hons-nyborjarguide', 'kopa-hons', 'honsapp-for-nyborjare',
]);
const BREED_ARTICLES = new Set([
  'bast-honsras-sverige', 'honsraser-for-agglaggeri-sverige', 'brahma-hons',
]);

export const DIGITAL_GUIDE_PATH = '/guider/mina-forsta-hons';
export const DIGITAL_GUIDE_SAMPLE_PATH = '/guider/mina-forsta-hons-smakprov.pdf';
export const DIGITAL_GUIDE_COVER_PATH = '/guider/mina-forsta-hons-omslag.jpg?v=1.2';

export const DIGITAL_GUIDE_COPY = {
  beginner: {
    title: 'Gör en plan för dina första höns.',
    body: 'Samla dina beslut om boende, inköp och budget. Mina första höns ger dig checklistor, en plan för första månaden och arbetsblad att fylla i.',
  },
  breed: {
    title: 'När du valt ras – planera starten.',
    body: 'Ta nästa steg från rasval till vardag med flocken. Mina första höns hjälper dig att planera boende, budget, inflyttning och rutiner.',
  },
};

export function digitalGuideAudienceForArticle(slug) {
  if (BEGINNER_ARTICLES.has(slug)) return 'beginner';
  if (BREED_ARTICLES.has(slug)) return 'breed';
  return null;
}

// All inputs below are the fixed, reviewed copy above; no CMS HTML is interpolated.
export function renderDigitalGuidePlacement(audience = 'beginner') {
  const copy = DIGITAL_GUIDE_COPY[audience];
  if (!copy) return '';
  return `<aside data-digital-guide="${audience}" aria-label="Hönsgårdens PDF-guide" class="my-8 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:p-6">
    <div class="flex items-start gap-4 sm:gap-6">
      <img src="${DIGITAL_GUIDE_COVER_PATH}" alt="Omslaget till Mina första höns" width="120" height="170" loading="lazy" class="w-20 sm:w-28 h-auto shrink-0 rounded border border-border shadow-sm" />
      <div class="min-w-0"><p class="text-xs font-semibold uppercase tracking-wide text-primary">Vår PDF-guide · 24 sidor</p>
        <h2 class="mt-2 font-serif text-xl sm:text-2xl text-foreground">${copy.title}</h2>
        <p class="mt-2 text-sm leading-relaxed text-muted-foreground">${copy.body}</p>
      </div>
    </div>
    <p class="mt-4 text-sm text-foreground">199 kr inkl. moms · engångsköp · ifyllbar och utskrivbar PDF</p>
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <a href="${DIGITAL_GUIDE_PATH}" class="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Se guiden – 199 kr</a>
      <a href="${DIGITAL_GUIDE_SAMPLE_PATH}" target="_blank" rel="noopener noreferrer" class="inline-flex min-h-11 items-center px-2 text-sm font-medium text-primary underline">Gratis smakprov · 4 sidor</a>
    </div>
  </aside>`;
}
