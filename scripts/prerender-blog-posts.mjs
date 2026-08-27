import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { REGULATION_GUIDES } from '../src/data/regulationGuides.mjs';
import { BREED_PRERENDER_PROFILES } from '../src/data/honsraserBreedProfiles.mjs';
import { MARKETPLACE_CATEGORY_PAGES } from '../src/data/marketplaceCategories.mjs';
import { renderBlogMarkdown, stripDuplicateTitleHeading, injectBreedFigures, heroForPost, isHtmlContent } from '../src/lib/blogMarkdown.mjs';
import { rewriteNakedShopAffiliateHrefs } from '../src/lib/adtractionShopLinks.mjs';
import { extractBlogArticlePosts, isRobotsDisallowed, mergeBlogPosts, parseStarDisallows } from '../src/lib/sitemapPolicy.mjs';
import {
  breedTopicH1,
  documentTitleForPath,
  injectTopicBody,
  renderBreedTopicBody,
  renderHomeTopicBody,
} from '../src/lib/prerenderTopicPages.mjs';

const BASE_URL = 'https://honsgarden.se';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;
// Samma publika client-fallback som vite.config.ts – används bara till sitemap
// så att blogg-URL:er inte försvinner när build-env saknar VITE_*-variabler.
const SITEMAP_SUPABASE_URL = SUPABASE_URL || 'https://sikbymtrbhrofysgkqsj.supabase.co';
const SITEMAP_SUPABASE_KEY = SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpa2J5bXRyYmhyb2Z5c2drcXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQ0MjAsImV4cCI6MjA4ODI0MDQyMH0.SlgJoYwkD5GWeZ2mK-GihDvEWpt8noKWE8xulzSOqaU';

const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
const NOINDEX_ROBOTS = 'noindex, nofollow';

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const escapeXml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const stripTags = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

function sanitizeHtml(html = '') {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}

function buildHeadGeneric({ title, description, path, ogImage, ogImageAlt, noindex, ogType = 'website', jsonLd }) {
  const url = `${BASE_URL}${path}`;
  const image = ogImage || '/og-image.jpg';
  const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`;
  const robots = noindex ? NOINDEX_ROBOTS : DEFAULT_ROBOTS;
  const jsonLdTag = jsonLd ? `\n<script type="application/ld+json" id="json-ld-prerendered">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : '';

  return `\n<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${escapeHtml(url)}">
<link rel="alternate" hreflang="sv" href="${escapeHtml(url)}">
<link rel="alternate" hreflang="x-default" href="${escapeHtml(url)}">
<meta property="og:type" content="${escapeHtml(ogType)}">
<meta property="og:url" content="${escapeHtml(url)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:alt" content="${escapeHtml(ogImageAlt || title)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${escapeHtml(imageUrl)}">
<link rel="alternate" type="application/rss+xml" title="Hönsgården – blogg om höns" href="https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/rss">${jsonLdTag}`;
}

function injectHead(template, headHtml) {
  return template
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta name="description"[\s\S]*?>/i, '')
    .replace(/<meta name="robots"[\s\S]*?>/i, '')
    .replace(/<link rel="canonical"[\s\S]*?>/i, '')
    .replace(/<link rel="alternate" hreflang="sv"[\s\S]*?>/i, '')
    .replace(/<link rel="alternate" hreflang="x-default"[\s\S]*?>/i, '')
    .replace(/<meta property="og:title"[\s\S]*?>/i, '')
    .replace(/<meta property="og:description"[\s\S]*?>/i, '')
    .replace(/<meta property="og:url"[\s\S]*?>/i, '')
    .replace(/<meta property="og:image"[\s\S]*?>/i, '')
    .replace(/<meta property="og:image:alt"[\s\S]*?>/i, '')
    .replace(/<meta name="twitter:title"[\s\S]*?>/i, '')
    .replace(/<meta name="twitter:description"[\s\S]*?>/i, '')
    .replace(/<meta name="twitter:image"[\s\S]*?>/i, '')
    .replace('</head>', `${headHtml}\n</head>`);
}

async function writeRoute(route, html) {
  const target = route === '' ? join('dist', 'index.html') : join('dist', route, 'index.html');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, 'utf8');
}

function renderArticle(post) {
  const image = heroForPost(post);
  const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`;
  const date = post.published_at ? new Date(post.published_at).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const rendered = isHtmlContent(post.content) ? post.content : renderBlogMarkdown(post.content);
  const rewritten = rewriteNakedShopAffiliateHrefs(
    injectBreedFigures(stripDuplicateTitleHeading(rendered, post.title)),
    post.slug,
  );
  const content = sanitizeHtml(rewritten);

  return `<div class="min-h-screen bg-background">
<header class="border-b border-border/50 bg-card/50"><div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between"><a href="/blogg" class="text-sm text-muted-foreground hover:text-foreground">← Blogg</a><a href="/login?mode=register&amp;source=blog_header" class="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Kom igång</a></div></header>
<main class="max-w-4xl mx-auto px-4 py-8" id="main-content"><article>
<nav class="text-xs text-muted-foreground mb-5"><a href="/">Hem</a> / <a href="/blogg">Blogg</a> / ${escapeHtml(post.title)}</nav>
<div class="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">${post.category ? `<span class="rounded-full border border-border px-2 py-1">${escapeHtml(post.category)}</span>` : ''}${date ? `<time datetime="${escapeHtml(post.published_at)}">${date}</time>` : ''}<span>${post.reading_time_minutes || Math.max(1, Math.ceil(stripTags(post.content).split(/\s+/).length / 220))} min läsning</span></div>
<h1 class="font-serif text-3xl sm:text-5xl text-foreground leading-tight mb-4">${escapeHtml(post.title)}</h1>
${post.excerpt ? `<p class="text-lg text-muted-foreground leading-relaxed mb-6">${escapeHtml(post.excerpt)}</p>` : ''}
<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(post.title)}" class="w-full aspect-[16/9] object-cover rounded-2xl mb-8" loading="eager" />
<div class="prose-custom">${content}</div>
</article></main></div>`;
}

function buildArticleHead(post) {
  const path = `/blogg/${post.slug}`;
  const title = documentTitleForPath(path, `${post.title} | Hönsgården`);
  const description = post.meta_description || post.excerpt || stripTags(post.content).slice(0, 155);
  const url = `${BASE_URL}${path}`;
  const image = heroForPost(post);
  const imageUrl = image.startsWith('http') ? image : `${BASE_URL}${image}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', '@id': `${url}#article`, headline: post.title, description, image: imageUrl, datePublished: post.published_at, dateModified: post.updated_at || post.published_at, author: { '@type': 'Organization', name: 'Hönsgården', url: BASE_URL }, publisher: { '@type': 'Organization', name: 'Hönsgården', url: BASE_URL }, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, inLanguage: 'sv-SE', wordCount: post.word_count || stripTags(post.content).split(/\s+/).length },
      { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Hem', item: BASE_URL }, { '@type': 'ListItem', position: 2, name: 'Blogg', item: `${BASE_URL}/blogg` }, { '@type': 'ListItem', position: 3, name: post.title, item: url }] },
    ],
  };
  return buildHeadGeneric({ title, description, path, ogImage: image, ogImageAlt: post.title, ogType: 'article', jsonLd });
}

async function fetchPosts() {
  // Använd samma publika fallback som sitemap/vite så att bygget aldrig
  // tappar prerenderade artiklar när hostingen saknar VITE_-variabler.
  const url = SUPABASE_URL || SITEMAP_SUPABASE_URL;
  const key = SUPABASE_KEY || SITEMAP_SUPABASE_KEY;
  if (!url || !key) {
    throw new Error('Saknar Supabase env vars (SUPABASE_URL/VITE_SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY/VITE_SUPABASE_PUBLISHABLE_KEY)');
  }

  const params = new URLSearchParams({
    select: 'slug,title,excerpt,content,cover_image_url,feature_image_url,category,tags,meta_description,meta_keywords,reading_time_minutes,word_count,published_at,updated_at',
    is_published: 'eq.true',
    order: 'published_at.desc',
    limit: '1000',
  });
  const response = await fetch(`${url}/rest/v1/blog_posts?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });

  if (!response.ok) throw new Error(`Kunde inte hämta bloggartiklar (${response.status})`);
  return response.json();
}

async function fetchPublishedPostsForSitemap() {
  const params = new URLSearchParams({
    select: 'slug,updated_at,published_at',
    is_published: 'eq.true',
    order: 'published_at.desc',
    limit: '1000',
  });
  const response = await fetch(`${SITEMAP_SUPABASE_URL}/rest/v1/blog_posts?${params}`, {
    headers: { apikey: SITEMAP_SUPABASE_KEY, Authorization: `Bearer ${SITEMAP_SUPABASE_KEY}` },
  });
  if (!response.ok) throw new Error(`Kunde inte hämta bloggsluggar till sitemap (${response.status})`);
  return response.json();
}

const STATIC_PAGES = [
  { path: '/', route: '', title: 'Hönsgården – svensk app för hönsägare, ägglogg och hönskalender', description: 'Hönsgården är en svensk app för hobbyhönsägare. Logga ägg, följ flocken, räkna foderkostnad, skapa påminnelser och få koll på hönsgården i mobilen.', ogImage: '/og-image.jpg', priority: '1.0', changefreq: 'weekly' },
  { path: '/app-for-honsagare', route: 'app-for-honsagare', title: 'App för hönsägare – håll koll på ägg, flock, foder och rutiner | Hönsgården', description: 'Hönsgården är en svensk app för hobbyhönsägare. Logga ägg, följ flocken, räkna foderkostnad och skapa vardagsrutiner direkt i mobilen.', ogImage: '/blog-images/hens-garden.jpg', priority: '0.9', changefreq: 'monthly' },
  { path: '/agglogg', route: 'agglogg', title: 'Ägglogg – logga ägg och följ värpningen över tid | Hönsgården', description: 'Digital ägglogg för hönsägare. Logga dagens ägg snabbt, se veckotrender, jämför perioder och förstå hur flocken värper.', ogImage: '/blog-images/hens-garden.jpg', priority: '0.9', changefreq: 'monthly' },
  { path: '/honskalender', route: 'honskalender', title: 'Hönskalender – planera skötsel, rutiner och hönsåret | Hönsgården', description: 'Hönskalender för svenska hönsägare. Håll koll på rengöring, foder, vatten, kvalster, ruggning, kläckning och säsongsrutiner.', ogImage: '/blog-images/chicken-coop.jpg', priority: '0.85', changefreq: 'monthly' },
  { path: '/foderkostnad-hons', route: 'foderkostnad-hons', title: 'Foderkostnad för höns – räkna kostnad per ägg | Hönsgården', description: 'Räkna ut foderkostnad för höns och kostnad per ägg. Hönsgården hjälper dig följa inköp, förbrukning och lönsamhet.', ogImage: '/blog-images/feed-varieties.jpg', priority: '0.85', changefreq: 'monthly' },
  { path: '/klackningskalender', route: 'klackningskalender', title: 'Kläckningskalender för hönsägg – följ dag 1 till 21 | Hönsgården', description: 'Digital kläckningskalender för hönsägg. Håll koll på startdatum, lysning, vändning, luftfuktighet och beräknad kläckdag.', ogImage: '/blog-images/baby-chicks.jpg', priority: '0.85', changefreq: 'monthly' },
  { path: '/borja-med-hons', route: 'borja-med-hons', title: 'Börja med höns – praktisk guide för nya hönsägare | Hönsgården', description: 'Börja med höns hemma? Här får du praktiska råd om hönshus, foder, ägg, rutiner och hur du får koll från första veckan.', ogImage: '/blog-images/baby-chicks.jpg', priority: '0.9', changefreq: 'monthly' },
  { path: '/om-oss', route: 'om-oss', title: 'Om Hönsgården – Vår vision för svenska hönsägare', description: 'Lär känna Hönsgården – byggt av och för svenska hobbyhönsägare. Vår vision, historia och varför vi finns.', ogImage: '/og-image.jpg', priority: '0.7', changefreq: 'monthly' },
  { path: '/blogg', route: 'blogg', title: 'Blogg om höns – Guider, tips & hälsa | Hönsgården', description: 'Läs Sveriges bästa blogg om höns. Guider för nybörjare, hälsotips, hönsraser och allt om hobbyhönsägande.', ogImage: '/og-image.jpg', priority: '0.9', changefreq: 'daily' },
  { path: '/verktyg/aggkalkylator', route: 'verktyg/aggkalkylator', title: 'Äggkalkylator – Räkna äggproduktion & foderkostnad | Hönsgården', description: 'Räkna ut din äggproduktion, foderkostnad per ägg och vinst per höna. Gratis kalkylator för svenska hönsägare.', ogImage: '/og-image.jpg', priority: '0.8', changefreq: 'monthly' },
  { path: '/verktyg/aggregler-vagvisare', route: 'verktyg/aggregler-vagvisare', title: 'Äggregler-vägvisaren – vilka regler gäller för din äggförsäljning? | Hönsgården', description: 'Svara på två frågor och få en personlig checklista: producentkod, äggmärkning, länsstyrelseregistrering, salmonellajournal och kommunens krav – för din flockstorlek och dina försäljningskanaler.', ogImage: '/blog-images/eggs-basket.jpg', priority: '0.85', changefreq: 'monthly' },
  { path: '/karta', route: 'karta', title: 'Hönskarta – hitta säljare av färska ägg nära dig | Hönsgården', description: 'Interaktiv karta över svenska hönsägare som säljer färska ägg. Hitta säljare i din närhet, se öppettider och boka direkt.', ogImage: '/og-image.jpg', priority: '0.85', changefreq: 'weekly' },
  { path: '/marknad', route: 'marknad', title: 'Marknad för höns, ägg och tillbehör | Hönsgården', description: 'Köp och sälj höns, tuppar, kläckägg och tillbehör mellan svenska hönsägare. Enkla annonser, direkt kontakt.', ogImage: '/og-image.jpg', priority: '0.85', changefreq: 'daily' },
  { path: '/salja-agg', route: 'salja-agg', title: 'Sälja ägg privat i Sverige – regler, priser & säljplats | Hönsgården', description: 'Vill du sälja överskottsägg? Läs om regler, prissättning och skapa gratis säljsida på Hönsgården. Hitta orter och säljare nära dig.', ogImage: '/og-image.jpg', priority: '0.9', changefreq: 'weekly' },
  { path: '/honsraser', route: 'honsraser', title: 'Hönsraser i Sverige – jämför lämpliga raser för hobbyn | Hönsgården', description: 'Guide till svenska och internationella hönsraser för hobbyn: värpning, temperament, storlek och vinterhärdighet.', ogImage: '/og-image.jpg', priority: '0.85', changefreq: 'monthly' },
  { path: '/honsraser-lista', route: 'honsraser-lista', title: 'Lista över hönsraser – A till Ö | Hönsgården', description: 'Komplett lista över hönsraser med egenskaper, ursprung och tips. Hitta rätt ras för din flock.', ogImage: '/og-image.jpg', priority: '0.8', changefreq: 'monthly' },
  { path: '/dvarghons', route: 'dvarghons', title: 'Dvärghöns – raser, skötsel och tips för nybörjare | Hönsgården', description: 'Allt om dvärghöns: populära raser, plats- och foderkrav, temperament och vad du bör tänka på innan du skaffar dvärghöns.', ogImage: '/og-image.jpg', priority: '0.8', changefreq: 'monthly' },
  { path: '/skansk-blommehona', route: 'skansk-blommehona', title: 'Skånsk blommehöna – lantras med värpning, temperament och skötsel | Hönsgården', description: 'Skånsk blommehöna är en gammal svensk lantras. Läs om värpning, temperament, färgvariation och skötsel av blommehönor.', ogImage: '/og-image.jpg', priority: '0.8', changefreq: 'monthly' },
  { path: '/app', route: 'app', title: 'Öppna Hönsgården-appen – logga ägg och sköt flocken | Hönsgården', description: 'Logga in i Hönsgården-appen. Registrera ägg, hönor, foder och påminnelser. Fungerar direkt i webbläsaren och som PWA i mobilen.', ogImage: '/og-image.jpg', priority: '0.7', changefreq: 'monthly' },
];

async function loadOrter() {
  try {
    const src = await readFile('src/data/saljaAggOrter.ts', 'utf8');
    const re = /\{\s*slug:\s*'([^']+)'\s*,\s*name:\s*'([^']+)'\s*,\s*lan:\s*'([^']+)'/g;
    const out = [];
    let m;
    while ((m = re.exec(src))) out.push({ slug: m[1], name: m[2], lan: m[3] });
    return out;
  } catch {
    return [];
  }
}

let OG_BASE_BUFFER = null;
async function getOgBaseBuffer() {
  if (!OG_BASE_BUFFER) {
    try {
      OG_BASE_BUFFER = await readFile('public/og-image.jpg');
    } catch {
      OG_BASE_BUFFER = false;
    }
  }
  return OG_BASE_BUFFER || null;
}

async function generateOrtOgImage(ort) {
  const base = await getOgBaseBuffer();
  if (!base) return null;
  const outRel = `/og/ort/${ort.slug}.jpg`;
  const outAbs = join('dist', outRel);
  const svg = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#000" stop-opacity="0"/>
      <stop offset="0.55" stop-color="#000" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#000" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="60" y="470" fill="#FFF9EC" font-family="Georgia, 'Times New Roman', serif" font-size="72" font-weight="700">🥚 Färska ägg i ${escapeXml(ort.name)}</text>
  <text x="60" y="540" fill="#FFF9EC" font-family="Helvetica, Arial, sans-serif" font-size="34" opacity="0.92">Hitta lokala hönsgårdar i ${escapeXml(ort.lan)}</text>
  <text x="60" y="590" fill="#FFF9EC" font-family="Helvetica, Arial, sans-serif" font-size="26" opacity="0.75">honsgarden.se/salja-agg/${escapeXml(ort.slug)}</text>
</svg>`;
  try {
    await mkdir(dirname(outAbs), { recursive: true });
    await sharp(base)
      .resize(1200, 630, { fit: 'cover' })
      .composite([{ input: Buffer.from(svg) }])
      .jpeg({ quality: 82, progressive: true })
      .toFile(outAbs);
    return outRel;
  } catch (e) {
    console.warn(`⚠️ Kunde inte generera OG-bild för ${ort.slug}: ${e.message}`);
    return null;
  }
}

function renderOrtCta(ort) {
  const ortName = escapeHtml(ort.name);
  const slug = escapeHtml(ort.slug);
  return `<aside class="ort-cta" style="margin:2.5rem auto;max-width:720px;padding:1.75rem 1.5rem;border:1px solid #E5E0D5;border-radius:1rem;background:#FAF8F4;text-align:center;font-family:Inter,system-ui,sans-serif;">
  <h2 style="font-family:'Young Serif',Georgia,serif;font-size:1.5rem;line-height:1.3;color:#3A6B35;margin:0 0 0.5rem;">Drömmer du om egna höns i ${ortName}? 🐔</h2>
  <p style="margin:0 0 1.25rem;color:#3f3f3f;font-size:1rem;line-height:1.5;">Kom igång med din egen hönsflock – gratis guide för nybörjare, eller hitta färska ägg från lokala säljare på kartan.</p>
  <div style="display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center;">
    <a href="/borja-med-hons?utm_source=ort-sida&amp;utm_content=${slug}" style="display:inline-block;padding:0.75rem 1.25rem;border-radius:0.75rem;background:#3A6B35;color:#FFF9EC;font-weight:600;text-decoration:none;">Börja med höns</a>
    <a href="/karta?ort=${slug}" style="display:inline-block;padding:0.75rem 1.25rem;border-radius:0.75rem;background:#FFF9EC;color:#3A6B35;border:1px solid #3A6B35;font-weight:600;text-decoration:none;">Se äggsäljare i ${ortName} på kartan</a>
  </div>
</aside>`;
}

function buildOrtPage(template, ort, ogImagePath) {
  const path = `/salja-agg/${ort.slug}`;
  const title = `Köp färska ägg i ${ort.name} – hitta säljare nära dig | Hönsgården`;
  const description = `Hitta lokala hönsägare i ${ort.name} (${ort.lan}) som säljer färska ägg direkt från gården. Bläddra i säljlistor, se priser och boka hämtning nära dig.`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: `Köp färska ägg i ${ort.name}`, description, url: `${BASE_URL}${path}`, inLanguage: 'sv-SE', about: { '@type': 'Place', name: ort.name, address: { '@type': 'PostalAddress', addressLocality: ort.name, addressRegion: ort.lan, addressCountry: 'SE' } } };
  const withHead = injectHead(template, buildHeadGeneric({ title, description, path, ogImage: ogImagePath || '/og-image.jpg', ogImageAlt: `Färska ägg i ${ort.name} – karta över lokala äggsäljare`, jsonLd }));
  return withHead.replace('<div id="root"></div>', `<div id="root">${renderOrtCta(ort)}</div>`);
}

const CATEGORY_META = {
  guide: { label: 'Guider', title: 'Guider om höns – Allt du behöver veta som hönsägare | Hönsgården', description: 'Kompletta guider om höns – från att bygga hönshus till att välja rätt ras. Steg-för-steg-instruktioner för nybörjare och erfarna hönsägare.', ogImage: '/blog-images/chicken-coop.jpg' },
  recension: { label: 'Recensioner', title: 'Produktrecensioner för hönsägare – Testat & granskat | Hönsgården', description: 'Ärliga recensioner av produkter för hönsägare. Vi testar hönshus, foder, värmelampor, äggkläckare och mer.', ogImage: '/blog-images/feed-varieties.jpg' },
  tips: { label: 'Tips & tricks', title: 'Tips & tricks för hönsägare – Smarta knep för hönsgården | Hönsgården', description: 'Praktiska tips och smarta knep för att sköta dina höns bättre. Spara tid, pengar och håll flocken frisk.', ogImage: '/blog-images/hens-feeding.jpg' },
  halsa: { label: 'Hälsa', title: 'Hönshälsa – Sjukdomar, behandling & förebyggande | Hönsgården', description: 'Allt om hönshälsa: vanliga sjukdomar, symptom, behandling och förebyggande åtgärder. Håll din flock frisk och glad.', ogImage: '/blog-images/hen-health-check.jpg' },
  nyborjare: { label: 'Nybörjare', title: 'Börja med höns – Komplett nybörjarguide | Hönsgården', description: 'Ska du skaffa höns? Här hittar du allt en nybörjare behöver veta – från val av ras till bygge av hönshus och daglig skötsel.', ogImage: '/blog-images/baby-chicks.jpg' },
  raser: { label: 'Raser', title: 'Hönsraser i Sverige – Jämförelser & guider | Hönsgården', description: 'Jämför hönsraser för svenskt klimat: värpning, temperament, vinterhärdighet och pris för hobbyhönsägare.', ogImage: '/blog-images/chicken-breeds.jpg' },
  tradgard: { label: 'Trädgård & odling', title: 'Trädgård & odling – Tips för självhushåll | Hönsgården', description: 'Odla grönsaker, kompostera med höns och skapa en produktiv trädgård.', ogImage: '/blog-images/spring-garden.jpg' },
  hem: { label: 'Hem & hållbarhet', title: 'Hem & hållbarhet – Hållbart boende med höns | Hönsgården', description: 'Tips för ett hållbart hem med höns. Kompostering, självhushåll och smarta lösningar för den miljömedvetna hönsägaren.', ogImage: '/blog-images/farm-kitchen.jpg' },
  friluftsliv: { label: 'Friluftsliv & natur', title: 'Friluftsliv & natur – Utomhuslivet med höns | Hönsgården', description: 'Friluftsliv, naturupplevelser och livet utomhus.', ogImage: '/blog-images/sunset-farm.jpg' },
};

function buildStaticPage(template, page) {
  const jsonLd = { '@context': 'https://schema.org', '@type': page.path === '/' ? 'WebSite' : 'WebPage', name: page.title, description: page.description, url: `${BASE_URL}${page.path}`, inLanguage: 'sv-SE' };
  const withHead = injectHead(template, buildHeadGeneric({ ...page, jsonLd }));
  if (page.path === '/') {
    return injectTopicBody(withHead, renderHomeTopicBody());
  }
  return withHead;
}

function buildCategoryPage(template, slug, meta) {
  const path = `/blogg/kategori/${slug}`;
  const jsonLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: meta.label, description: meta.description, url: `${BASE_URL}${path}`, inLanguage: 'sv-SE' };
  return injectHead(template, buildHeadGeneric({ title: meta.title, description: meta.description, path, ogImage: meta.ogImage, ogImageAlt: meta.label, jsonLd }));
}

function buildTagPage(template, tag) {
  const path = `/blogg/tagg/${encodeURIComponent(tag)}`;
  const display = tag.charAt(0).toUpperCase() + tag.slice(1);
  return injectHead(template, buildHeadGeneric({ title: `${display} – Artiklar om ${tag} | Hönsgården`, description: `Läs alla artiklar om ${tag}. Tips, guider och information från Hönsgården.`, path, ogImage: '/og-image.jpg', ogImageAlt: display, jsonLd: { '@context': 'https://schema.org', '@type': 'CollectionPage', name: display, url: `${BASE_URL}${path}`, inLanguage: 'sv-SE' } }));
}

function buildTermsPage(template) {
  return injectHead(template, buildHeadGeneric({ title: 'Användarvillkor & Integritetspolicy | Hönsgården', description: 'Hönsgårdens användarvillkor och integritetspolicy.', path: '/terms', noindex: true }));
}

function renderRegulationGuideBody(guide, updatedFormatted) {
  const sectionsHtml = guide.sections.map((s) => `
<section id="${s.id}" class="scroll-mt-24 mt-8"><h2 class="text-2xl font-serif mb-3">${escapeHtml(s.heading)}</h2>
<div class="prose prose-neutral max-w-none text-foreground/85 leading-relaxed">${sanitizeHtml(s.html)}</div></section>`).join('\n');

  const faqHtml = guide.faqs.map((f) => `
<details class="rounded-xl border border-border bg-card/50 p-4"><summary class="cursor-pointer font-medium">${escapeHtml(f.q)}</summary>
<p class="mt-3 text-sm text-foreground/80 leading-relaxed">${escapeHtml(f.a)}</p></details>`).join('\n');

  const authLinks = guide.authorityLinks.map((l) => `<li><a href="${escapeHtml(l.href)}" rel="noopener noreferrer" target="_blank" class="underline">${escapeHtml(l.label)}</a></li>`).join('');
  const relLinks = guide.relatedLinks.map((l) => `<li><a href="${escapeHtml(l.href)}" class="text-primary underline">${escapeHtml(l.label)}</a></li>`).join('');

  return `<div class="min-h-screen bg-background">
<header class="border-b border-border/50 bg-card/50"><div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between"><a href="/" class="font-serif text-lg">🐔 Hönsgården</a><a href="/login?mode=register&amp;source=blog_header" class="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Kom igång</a></div></header>
<main class="max-w-3xl mx-auto px-4 py-8" id="main-content">
<nav class="text-xs text-muted-foreground mb-4"><a href="/">Start</a> / <a href="/blogg">Guider</a> / ${escapeHtml(guide.h1)}</nav>
<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">Regelguide</div>
<h1 class="text-3xl sm:text-4xl font-serif leading-tight mb-4">${escapeHtml(guide.h1)}</h1>
<p class="text-sm text-muted-foreground mb-6">Senast uppdaterad: <time datetime="${escapeHtml(guide.updated)}">${escapeHtml(updatedFormatted)}</time></p>
<div class="prose prose-neutral max-w-none text-foreground/85 leading-relaxed">${sanitizeHtml(guide.introHtml)}</div>
<article>${sectionsHtml}</article>
<aside class="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p class="font-medium mb-2">Regler kan ändras – dubbelkolla alltid källan</p><p>Den här guiden är en översikt och ersätter inte myndigheternas information. För aktuella regler hänvisar vi till Jordbruksverket och Livsmedelsverket:</p><ul class="list-disc ml-5 mt-2 space-y-1">${authLinks}</ul></aside>
<section class="mt-10"><h2 class="text-2xl font-serif mb-4">Vanliga frågor</h2><div class="space-y-3">${faqHtml}</div></section>
<section class="mt-10 rounded-2xl border border-border bg-card/30 p-6"><h2 class="text-lg font-serif mb-3">Läs vidare</h2><ul class="space-y-2">${relLinks}</ul></section>
</main></div>`;
}

function buildRegulationGuidePage(template, guide) {
  const path = `/guider/${guide.slug}`;
  const url = `${BASE_URL}${path}`;
  const updatedFormatted = new Date(guide.updated).toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Article', '@id': `${url}#article`, headline: guide.h1, description: guide.metaDescription, datePublished: guide.updated, dateModified: guide.updated, author: { '@type': 'Organization', name: 'Hönsgården', url: BASE_URL }, publisher: { '@type': 'Organization', name: 'Hönsgården', url: BASE_URL }, mainEntityOfPage: { '@type': 'WebPage', '@id': url }, inLanguage: 'sv-SE' },
      { '@type': 'FAQPage', mainEntity: guide.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) },
      { '@type': 'BreadcrumbList', itemListElement: [ { '@type': 'ListItem', position: 1, name: 'Hem', item: BASE_URL }, { '@type': 'ListItem', position: 2, name: 'Guider', item: `${BASE_URL}/blogg` }, { '@type': 'ListItem', position: 3, name: guide.h1, item: url } ] },
    ],
  };
  const head = buildHeadGeneric({ title: guide.title, description: guide.metaDescription, path, ogImage: guide.ogImage, ogImageAlt: guide.h1, ogType: 'article', jsonLd });
  return injectHead(template, head).replace('<div id="root"></div>', `<div id="root">${renderRegulationGuideBody(guide, updatedFormatted)}</div>`);
}


function buildBreedPage(template, breed) {
  const path = `/honsraser/${breed.slug}`;
  const url = `${BASE_URL}${path}`;
  const h1 = breedTopicH1(breed);
  const title = documentTitleForPath(path, `${breed.namn} – värpning, temperament & skötsel | Hönsgården`);
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'Article', headline: h1, description: breed.description, url, inLanguage: 'sv-SE', author: { '@type': 'Organization', name: 'Hönsgården' }, publisher: { '@type': 'Organization', name: 'Hönsgården' }, mainEntityOfPage: { '@type': 'WebPage', '@id': url } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: breed.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [ { '@type': 'ListItem', position: 1, name: 'Hem', item: BASE_URL }, { '@type': 'ListItem', position: 2, name: 'Hönsraser', item: `${BASE_URL}/honsraser` }, { '@type': 'ListItem', position: 3, name: breed.namn, item: url } ] },
  ];
  const withHead = injectHead(template, buildHeadGeneric({ title, description: breed.description, path, ogImage: '/blog-images/hens-garden.jpg', ogImageAlt: `${breed.namn} – hönsras`, ogType: 'article', jsonLd }));
  return injectTopicBody(withHead, renderBreedTopicBody(breed, h1));
}

function renderMarketplaceCategoryBody(page) {
  return `<div class="min-h-screen bg-background">
<main class="container mx-auto max-w-5xl px-5 pt-24 pb-16" id="main-content">
  <nav class="text-xs text-muted-foreground mb-4"><a href="/">Hem</a> / <a href="/marknad">Marknad</a> / ${escapeHtml(page.h1)}</nav>
  <h1 class="font-serif text-4xl md:text-5xl text-foreground mb-3">${escapeHtml(page.h1)}</h1>
  <p class="text-muted-foreground max-w-2xl mb-8 leading-relaxed">${escapeHtml(page.intro)}</p>
  <div class="mb-10"><a href="/marknad/ny" class="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-primary-foreground font-medium">Lägg in gratis annons →</a></div>
  <section class="max-w-3xl border-t border-border/40 pt-8">
    <h2 class="font-serif text-2xl text-foreground mb-4">Vanliga frågor</h2>
    <div class="space-y-5">
      ${page.faq.map(([q, a]) => `<div><h3 class="text-sm font-semibold text-foreground mb-1">${escapeHtml(q)}</h3><p class="text-sm text-muted-foreground leading-relaxed">${escapeHtml(a)}</p></div>`).join('')}
    </div>
    <p class="mt-8 text-xs text-muted-foreground"><a href="/marknad" class="underline">← Tillbaka till hela marknaden</a></p>
  </section>
</main></div>`;
}

function buildMarketplaceCategoryPage(template, page) {
  const path = `/marknad/k/${page.slug}`;
  const url = `${BASE_URL}${path}`;
  const jsonLd = [
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: page.h1, description: page.metaDescription, url, inLanguage: 'sv-SE', publisher: { '@type': 'Organization', name: 'Hönsgården' } },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: page.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [ { '@type': 'ListItem', position: 1, name: 'Hem', item: BASE_URL }, { '@type': 'ListItem', position: 2, name: 'Marknad', item: `${BASE_URL}/marknad` }, { '@type': 'ListItem', position: 3, name: page.h1, item: url } ] },
  ];
  const head = buildHeadGeneric({ title: page.title, description: page.metaDescription, path, ogImage: '/og-image.jpg', ogImageAlt: page.h1, ogType: 'website', jsonLd });
  return injectHead(template, head).replace('<div id="root"></div>', `<div id="root">${renderMarketplaceCategoryBody(page)}</div>`);
}

function buildArticlePage(template, post) {
  return injectTopicBody(injectHead(template, buildArticleHead(post)), renderArticle(post));
}


function buildRedirectPage(template, targetPath) {
  const targetUrl = `${BASE_URL}${targetPath}`;
  const head = `\n<title>Omdirigerar till ${escapeHtml(targetUrl)}</title><meta name="robots" content="noindex, follow"><link rel="canonical" href="${escapeHtml(targetUrl)}"><meta http-equiv="refresh" content="0; url=${escapeHtml(targetUrl)}"><script>window.location.replace(${JSON.stringify(targetPath)});</script>`;
  return injectHead(template, head).replace('<div id="root"></div>', `<div id="root"><p>Den här sidan har flyttats. Omdirigerar till <a href="${escapeHtml(targetUrl)}">${escapeHtml(targetUrl)}</a>…</p></div>`);
}

function buildSitemap(posts, tags, orter = [], regulationGuides = [], breeds = [], marketplaceCategories = [], disallows = []) {
  const now = new Date().toISOString().split('T')[0];
  const urls = [];
  const push = (loc, opts = {}) => {
    if (isRobotsDisallowed(loc, disallows)) return;
    urls.push({ loc, lastmod: opts.lastmod || now, changefreq: opts.changefreq || 'monthly', priority: opts.priority || '0.7' });
  };

  STATIC_PAGES.forEach((page) => push(`${BASE_URL}${page.path}`, { changefreq: page.changefreq, priority: page.priority }));
  Object.keys(CATEGORY_META).forEach((slug) => push(`${BASE_URL}/blogg/kategori/${slug}`, { changefreq: 'weekly', priority: '0.7' }));
  tags.forEach((tag) => push(`${BASE_URL}/blogg/tagg/${encodeURIComponent(tag)}`, { changefreq: 'weekly', priority: '0.6' }));
  posts.forEach((post) => push(`${BASE_URL}/blogg/${post.slug}`, { lastmod: (post.updated_at || post.published_at || now).split('T')[0], changefreq: 'weekly', priority: '0.8' }));
  orter.forEach((ort) => push(`${BASE_URL}/salja-agg/${ort.slug}`, { changefreq: 'weekly', priority: '0.75' }));
  regulationGuides.forEach((g) => push(`${BASE_URL}/guider/${g.slug}`, { lastmod: g.updated, changefreq: 'monthly', priority: '0.85' }));
  breeds.forEach((b) => push(`${BASE_URL}/honsraser/${b.slug}`, { changefreq: 'monthly', priority: '0.8' }));
  marketplaceCategories.forEach((p) => push(`${BASE_URL}/marknad/k/${p.slug}`, { changefreq: 'daily', priority: '0.8' }));

  const body = urls.map(u => `  <url>\n    <loc>${escapeXml(u.loc)}</loc>\n    <lastmod>${u.lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}


const SKIPPED_STEPS = [];

async function runStep(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    const reason = error?.message || String(error);
    SKIPPED_STEPS.push({ name, reason });
    console.error(`⚠️ PRERENDER-STEG MISSLYCKADES [${name}]: ${error?.stack || reason}`);
  }
}

function noteSkipped(name, reason) {
  SKIPPED_STEPS.push({ name, reason });
  console.warn(`⚠️ HOPPAR ÖVER [${name}]: ${reason}`);
}

async function main() {
  const template = await readFile('dist/index.html', 'utf8');

  let posts = [];
  let orter = [];
  const regulationSlugs = new Set(REGULATION_GUIDES.map((g) => g.slug));
  const tagSet = new Set();

  await runStep('fetch-posts', async () => {
    posts = await fetchPosts();
    for (const post of posts) if (Array.isArray(post.tags)) post.tags.forEach(t => t && tagSet.add(t));
  });
  await runStep('load-orter', async () => {
    orter = await loadOrter();
  });

  await runStep('static-pages', async () => {
    for (const page of STATIC_PAGES) await writeRoute(page.route, buildStaticPage(template, page));
    await writeRoute('terms', buildTermsPage(template));
  });

  await runStep('category-pages', async () => {
    for (const [slug, meta] of Object.entries(CATEGORY_META)) await writeRoute(`blogg/kategori/${slug}`, buildCategoryPage(template, slug, meta));
  });

  const tags = Array.from(tagSet);
  await runStep('tag-pages', async () => {
    for (const tag of tags) await writeRoute(`blogg/tagg/${encodeURIComponent(tag)}`, buildTagPage(template, tag));
  });

  await runStep('blog-articles', async () => {
    await Promise.all(posts.flatMap((post) => {
      const ops = [writeRoute(`blogg/${post.slug}`, buildArticlePage(template, post))];
      if (!regulationSlugs.has(post.slug)) {
        ops.push(writeRoute(`guider/${post.slug}`, buildRedirectPage(template, `/blogg/${post.slug}`)));
      }
      return ops;
    }));
    await writeRoute('guider', buildRedirectPage(template, '/blogg'));
  });

  await runStep('regulation-guides', async () => {
    for (const guide of REGULATION_GUIDES) {
      await writeRoute(`guider/${guide.slug}`, buildRegulationGuidePage(template, guide));
    }
  });

  await runStep('ort-pages', async () => {
    for (const ort of orter) {
      const ogPath = await generateOrtOgImage(ort);
      await writeRoute(`salja-agg/${ort.slug}`, buildOrtPage(template, ort, ogPath));
    }
  });

  await runStep('breed-pages', async () => {
    for (const breed of BREED_PRERENDER_PROFILES) {
      await writeRoute(`honsraser/${breed.slug}`, buildBreedPage(template, breed));
    }
  });

  await runStep('marketplace-category-pages', async () => {
    for (const page of MARKETPLACE_CATEGORY_PAGES) {
      await writeRoute(`marknad/k/${page.slug}`, buildMarketplaceCategoryPage(template, page));
    }
  });

  await runStep('sitemap', async () => {
    const disallows = parseStarDisallows(await readFile('public/robots.txt', 'utf8'));
    let fallbackPosts = [];
    for (const candidate of [join('dist', 'sitemap.xml'), join('public', 'sitemap.xml')]) {
      try {
        fallbackPosts = extractBlogArticlePosts(await readFile(candidate, 'utf8'));
        if (fallbackPosts.length) break;
      } catch {
        /* nästa kandidat */
      }
    }
    let livePosts = posts;
    if (!livePosts.length) {
      try {
        livePosts = await fetchPublishedPostsForSitemap();
      } catch (error) {
        console.warn(`[sitemap] kunde inte hämta bloggposter live: ${error?.message || error}`);
      }
    }
    const sitemapPosts = mergeBlogPosts(livePosts, fallbackPosts);
    if (!sitemapPosts.some((post) => post.slug === 'bast-honsras-sverige')) {
      throw new Error('sitemap saknar /blogg/bast-honsras-sverige');
    }
    await writeFile(
      join('dist', 'sitemap.xml'),
      buildSitemap(sitemapPosts, tags, orter, REGULATION_GUIDES, BREED_PRERENDER_PROFILES, MARKETPLACE_CATEGORY_PAGES, disallows),
      'utf8',
    );
  });

  console.log(`✅ Prerender klar: ${STATIC_PAGES.length} statiska + ${Object.keys(CATEGORY_META).length} kategori- + ${tags.length} tagg- + ${posts.length} artikel- + ${orter.length} ort- + ${REGULATION_GUIDES.length} regelguide- + ${BREED_PRERENDER_PROFILES.length} rassidor + ${MARKETPLACE_CATEGORY_PAGES.length} marknadskategorier.`);



  if (SKIPPED_STEPS.length === 0) {
    console.log('📋 Sammanfattning: alla prerender-steg lyckades.');
  } else {
    console.log(`📋 Sammanfattning: ${SKIPPED_STEPS.length} steg hoppades över:`);
    for (const { name, reason } of SKIPPED_STEPS) {
      console.log(`   • ${name} — ${reason}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(`⚠️ PRERENDER MISSLYCKADES: ${error?.stack || error?.message || error}`);
  })
  .finally(() => {
    // Prerender är progressiv förbättring – deploya alltid det redan lyckade vite-bygget.
    process.exit(0);
  });

