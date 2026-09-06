/** Shared by article prerendering and the client so useful links survive hydration. */
export const GUIDE_NEXT_STEPS = {
  'hur-manga-agg-lagger-en-hona': {
    title: 'Följ äggen i din egen flock',
    body: 'Rassiffror är en utgångspunkt. Anteckna datum och antal ägg för att kunna jämföra din egen flock över tid. I demon kan du se hur appens översikt ser ut med exempeldata.',
    primary: { href: '/demo', label: 'Se äggöversikten i demon' },
    related: { href: '/blogg/foder-till-hons-guide', label: 'Läs guiden om foder till höns' },
  },
  'foder-till-hons-guide': {
    title: 'Räkna med dina egna foderkostnader',
    body: 'Vad äggen kostar beror på dina utgifter och hur många ägg du får. Fyll i foderkostnad, övriga kostnader och uppskattad värpning i kalkylatorn. Resultatet är en uppskattning utifrån dina uppgifter.',
    primary: { href: '/verktyg/aggkalkylator', label: 'Beräkna kostnad per ägg' },
    related: { href: '/blogg/hur-manga-agg-lagger-en-hona', label: 'Läs om vad som påverkar äggproduktionen' },
  },
  'hons-pa-vintern': {
    title: 'Samla vinterns rutiner på ett ställe',
    body: 'Skriv ner vilka sysslor du behöver komma ihåg och följ dina anteckningar om flocken. Se appens översikt med exempeldata i Hönsgårdens demo innan du skapar konto.',
    primary: { href: '/demo', label: 'Se appens översikt i demon' },
    related: { href: '/blogg/foder-till-hons-guide', label: 'Läs vidare om foder till höns' },
  },
  'skaffa-hons-nyborjare': {
    title: 'Prova vardagen med en digital flock',
    body: 'Se Hönsgårdens översikt för flock och ägg. Demon använder exempeldata och låter dig utforska appen utan att skapa konto.',
    primary: { href: '/demo', label: 'Prova Hönsgården utan konto' },
    related: { href: '/blogg/bygga-honshus', label: 'Läs guiden om att bygga hönshus' },
  },
  'klacka-agg': {
    title: 'Gör en plan utifrån ditt startdatum',
    body: 'Kläckningskalkylatorn ger en översikt över beräknade datum utifrån när du startar. Använd den som planeringsstöd, inte som garanti för när äggen kläcks.',
    primary: { href: '/verktyg/klackningskalkylator', label: 'Öppna kläckningskalkylatorn' },
    related: { href: '/blogg/skaffa-hons-nyborjare', label: 'Läs nybörjarguiden för hönsägare' },
  },
};

function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Exactly one section on the five selected articles; all other articles are unchanged. */
export function injectGuideNextSteps(html = '', slug) {
  const guide = Object.hasOwn(GUIDE_NEXT_STEPS, slug ?? '') ? GUIDE_NEXT_STEPS[slug] : undefined;
  if (!guide || !html || /id=["']guide-next-steps["']/.test(html)) return html;
  const link = (item) => `<a href="${escapeHtml(item.href)}" class="text-primary underline underline-offset-2">${escapeHtml(item.label)}</a>`;
  return `${html}<section id="guide-next-steps" aria-labelledby="guide-next-steps-title" class="my-8 rounded-2xl border border-border bg-card p-5 sm:p-6">`
    + `<h2 id="guide-next-steps-title" class="font-serif text-xl text-foreground">${escapeHtml(guide.title)}</h2>`
    + `<p>${escapeHtml(guide.body)}</p>`
    + `<ul><li>${link(guide.primary)}</li><li>${link(guide.related)}</li></ul></section>`;
}
