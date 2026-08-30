#!/usr/bin/env node
/**
 * SEO-motståndare (Swarm X) — maskinläsbar URL-revision av byggd dist.
 *
 * Kryper alla prerenderade HTML-filer och försöker bevisa att
 * indexhygienen är bruten:
 *  1. Exakt en canonical per sida, pekandes på egen produktions-URL.
 *  2. Inga dublett-canonicals mellan sidor.
 *  3. noindex-sidor får inte finnas i sitemap.xml.
 *  4. Varje sitemap-URL ska finnas som prerenderad sida.
 *  5. robots.txt ska annonsera sitemapen.
 *
 *   node scripts/audit-urls.mjs          # rapport
 *   node scripts/audit-urls.mjs --check  # exit 1 vid brott
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const BASE = 'https://honsgarden.se';

function* walkHtml(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkHtml(full);
    else if (entry.endsWith('.html')) yield full;
  }
}

// Sidans egen canonical-konvention: utan avslutande snedstreck; roten normaliseras till bara domänen.
const norm = (u) => (u.endsWith('/') && u.length >= BASE.length + 1 ? u.slice(0, -1) : u);
const pathToUrl = (file) => {
  const rel = file.slice(DIST.length).replace(/\/index\.html$/, '').replace(/\.html$/, '');
  return `${BASE}${rel}`;
};

const violations = [];
const canonicals = new Map(); // canonical -> [urls]
const pageUrls = new Set();
const noindexUrls = new Set();
let pages = 0;

for (const file of walkHtml(DIST)) {
  if (file.endsWith('/404.html')) continue;
  pages += 1;
  const html = readFileSync(file, 'utf8');
  const url = pathToUrl(file);
  pageUrls.add(url);

  const robotsContent = html.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? '';
  const isNoindex = /noindex/i.test(robotsContent);
  if (isNoindex) noindexUrls.add(url);

  // Redirect-stubbar (/guider/* legacy, diakritik-stubbar i public/) är medvetna:
  // noindex + meta refresh + canonical mot målet. De är inte kanoniska sidor.
  const isRedirectStub = /http-equiv="refresh"/.test(html);
  if (isRedirectStub) {
    if (!isNoindex) {
      violations.push({ type: 'redirect_stub_indexable', url, detail: 'stub utan noindex' });
    }
    continue;
  }

  const canonicalMatches = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]);
  if (canonicalMatches.length !== 1) {
    violations.push({ type: 'canonical_count', url, detail: `${canonicalMatches.length} canonicals` });
  } else {
    const canonical = norm(canonicalMatches[0]);
    if (canonical !== url) {
      violations.push({ type: 'canonical_mismatch', url, detail: `canonical=${canonical}` });
    }
    const list = canonicals.get(canonical) ?? [];
    list.push(url);
    canonicals.set(canonical, list);
  }

}

for (const [canonical, urls] of canonicals) {
  if (urls.length > 1) {
    violations.push({ type: 'duplicate_canonical', url: canonical, detail: `${urls.length} sidor: ${urls.join(', ')}` });
  }
}

const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => norm(m[1]));
for (const u of sitemapUrls) {
  if (noindexUrls.has(u)) violations.push({ type: 'noindex_in_sitemap', url: u, detail: '' });
  // /salja-agg/:ort-sidor är medvetet uteslutna vid noll utbud — får aldrig läcka in.
  if (/^https:\/\/honsgarden\.se\/salja-agg\/[^/]+$/.test(u) && noindexUrls.has(u)) {
    violations.push({ type: 'unsupplied_ort_in_sitemap', url: u, detail: '' });
  }
}
const sitemapSet = new Set(sitemapUrls);
const missingPages = [...sitemapUrls].filter((u) => !pageUrls.has(norm(u)));
for (const u of missingPages) {
  violations.push({ type: 'sitemap_url_not_prerendered', url: u, detail: '' });
}

const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
if (!/Sitemap:\s*https:\/\/honsgarden\.se\/sitemap\.xml/i.test(robots)) {
  violations.push({ type: 'robots_sitemap_missing', url: '/robots.txt', detail: '' });
}

console.log(`\n🔍 URL-revision — ${pages} sidor, ${sitemapUrls.length} sitemap-URL:er, ${noindexUrls.size} noindex-sidor\n`);
if (violations.length === 0) {
  console.log('✅ Inga brott mot indexhygienen.');
} else {
  const byType = new Map();
  for (const v of violations) byType.set(v.type, (byType.get(v.type) ?? 0) + 1);
  console.log(`❌ ${violations.length} brott:`);
  for (const [type, count] of byType) console.log(`   ${type}: ${count}`);
  for (const v of violations.slice(0, 25)) console.log(`   • ${v.url} ${v.detail}`);
  if (process.argv.includes('--check')) process.exit(1);
}
