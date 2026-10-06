/**
 * Affiliate coverage report for every published blog article.
 *
 * For each article: 30-day views and rank (get_affiliate_article_profile),
 * shop links already in the text, and which catalog products the blog's
 * product engine (smartAffiliate) can place in its sections. Uses the same
 * catalog merge, link rewriting and consolidation rules as the site.
 *
 *   npx tsx scripts/affiliate-coverage.ts            # markdown report
 *   COVERAGE_JSON=1 npx tsx scripts/affiliate-coverage.ts   # + one JSON line per article
 *
 * Reads public data only (publishable key). Writes the markdown to
 * $GITHUB_STEP_SUMMARY when present.
 */
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapDatabaseProduct, mergeCatalog } from '../src/lib/affiliateCatalog';
import { matchSmartProducts, type SmartAffiliateProduct } from '../src/lib/smartAffiliate';
import { isHtmlContent, renderBlogMarkdown } from '../src/lib/blogMarkdown';
import { extractHrefValues, rewriteNakedShopAffiliateHrefs, shopMerchantFromHref } from '../src/lib/adtractionShopLinks';
import { withoutConsolidatedPosts } from '../src/data/blogConsolidation.mjs';
import { linkProductMentions } from '../src/lib/inTextProductLinks';
import { parseDelimited } from '../supabase/functions/sync-affiliate-feed/csv.ts';
import { isRelevantAdtraction } from '../supabase/functions/sync-affiliate-feed/adtraction.ts';
import { isRelevantAddRevenue } from '../supabase/functions/sync-affiliate-feed/addrevenue.ts';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://sikbymtrbhrofysgkqsj.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpa2J5bXRyYmhyb2Z5c2drcXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQ0MjAsImV4cCI6MjA4ODI0MDQyMH0.SlgJoYwkD5GWeZ2mK-GihDvEWpt8noKWE8xulzSOqaU';
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };

// Same rules as src/components/AffiliateProductBox.tsx.
const BLOCKED_SECTIONS = /vanliga frågor|faq|sammanfattning|slutsats|källor|referenser|läs också|relaterade artiklar/i;

type Post = { slug: string; title: string; excerpt: string | null; content: string; category: string | null; tags: string[] | null; published_at: string | null };
type Profile = { views_30d: number; rank_30d: number | null; tier: string; max_blocks: number };

async function rest<T>(path: string): Promise<T> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: HEADERS });
  if (!response.ok) throw new Error(`${path.split('?')[0]}: HTTP ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

async function profile(slug: string): Promise<Profile> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_affiliate_article_profile`, {
    method: 'POST', headers: HEADERS, body: JSON.stringify({ p_slug: slug }),
  });
  if (!response.ok) return { views_30d: 0, rank_30d: null, tier: 'normal', max_blocks: 2 };
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : rows;
  return {
    views_30d: Number(row?.views_30d) || 0,
    rank_30d: row?.rank_30d == null ? null : Number(row.rank_30d),
    tier: ['normal', 'strong', 'hot'].includes(row?.tier) ? row.tier : 'normal',
    max_blocks: Math.max(1, Math.min(5, Number(row?.max_blocks) || 2)),
  };
}

const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
const words = (html: string) => (plain(html) ? plain(html).split(' ').length : 0);

function desiredBlocks(totalWords: number, tier: string, maxBlocks: number): number {
  const natural = totalWords < 650 ? 1 : totalWords < 1200 ? 2 : totalWords < 1900 ? 3 : 4;
  let desired = Math.min(natural, 2);
  if (tier === 'strong') desired = Math.max(3, natural);
  if (tier === 'hot') desired = Math.max(5, natural);
  return Math.min(5, maxBlocks, desired);
}

function sections(html: string): Array<{ heading: string; text: string }> {
  const parts = html.split(/(?=<h[23][\s>])/i);
  return parts
    .map((part) => {
      const heading = part.match(/^<h[23][^>]*>([\s\S]*?)<\/h[23]>/i);
      return heading ? { heading: plain(heading[1]), text: plain(part) } : null;
    })
    .filter((section): section is { heading: string; text: string } => Boolean(section));
}

function reviewedSlugs(): Set<string> {
  const dir = join(process.cwd(), 'content/editorial/articles');
  return new Set(readdirSync(dir).filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')).slug));
}

function analyse(post: Post, catalog: SmartAffiliateProduct[], prof: Profile, reviewed: boolean) {
  const raw = isHtmlContent(post.content) ? post.content : renderBlogMarkdown(post.content);
  const html = rewriteNakedShopAffiliateHrefs(raw, post.slug, { sitewide: !reviewed });
  const linkMerchants: Record<string, number> = {};
  for (const href of extractHrefValues(html)) {
    const merchant = shopMerchantFromHref(href);
    if (merchant) linkMerchants[merchant] = (linkMerchants[merchant] ?? 0) + 1;
  }

  const all = sections(html);
  const firstAllowed = Math.floor(all.length * 0.2);
  const used = new Set<string>();
  const placements: Array<{ heading: string; product: string; advertiser: string; category: string }> = [];
  const eligible = all.filter((section, index) => index >= firstAllowed && !BLOCKED_SECTIONS.test(section.heading) && section.text.split(' ').length >= 35);
  for (const section of eligible) {
    const [best] = matchSmartProducts(catalog, { slug: post.slug, title: post.title, heading: section.heading, text: section.text }, 5, used);
    if (!best) continue;
    used.add(best.id);
    placements.push({ heading: section.heading, product: best.name, advertiser: best.advertiser, category: best.category });
  }
  const articleCandidates = matchSmartProducts(catalog, { slug: post.slug, title: post.title, heading: post.title, text: plain(html).slice(0, 4000) }, 5);
  const totalWords = words(html);
  const inTextLinks = reviewed ? [] : [...linkProductMentions(html, catalog, { slug: post.slug, title: post.title })
    .matchAll(/<a [^>]*data-intext-product="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
    .map(([, id, word]) => `${word} → ${catalog.find((product) => product.id === id)?.name ?? id}`);
  const target = reviewed ? 0 : desiredBlocks(totalWords, prof.tier, prof.max_blocks);

  return {
    slug: post.slug,
    title: post.title,
    category: post.category,
    reviewed,
    views30d: prof.views_30d,
    rank30d: prof.rank_30d,
    tier: prof.tier,
    words: totalWords,
    sections: all.length,
    eligibleSections: eligible.length,
    targetBlocks: target,
    sectionMatches: placements.length,
    shortfall: Math.max(0, target - placements.length),
    inTextShopLinks: linkMerchants,
    newInTextLinks: inTextLinks,
    placements,
    articleCandidates: articleCandidates.map((product) => `${product.name} (${product.advertiser}/${product.category})`),
    headings: all.map((section) => section.heading),
  };
}

/** Feed URLs committed in migrations, with how many rows the sync would import. */
async function feedDiagnostics(): Promise<string[]> {
  const dir = join(process.cwd(), 'supabase/migrations');
  const urls = new Set<string>();
  for (const file of readdirSync(dir)) {
    for (const match of readFileSync(join(dir, file), 'utf8').matchAll(/'(https:\/\/(?:adtraction\.com\/productfeed\.htm|addrevenue\.io\/productfeed)[^']+)'/g)) urls.add(match[1]);
  }
  const addRevenueSlugs: Record<string, string> = { '984666': 'by-benson', '985743': 'dintradgard' };
  const lines = ['## Produktflöden i migreringarna', '', '| Flöde | HTTP | Rader | Skulle importeras | Varav i lager |', '|---|---:|---:|---:|---:|'];
  for (const url of urls) {
    const label = url.includes('addrevenue') ? `AddRevenue ${addRevenueSlugs[new URL(url).searchParams.get('a') ?? ''] ?? '?'}` : `Adtraction apid=${new URL(url).searchParams.get('apid')}`;
    try {
      const response = await fetch(url);
      const text = response.ok ? await response.text() : '';
      if (url.includes('addrevenue')) {
        const rows = parseDelimited(text, ';').filter((row) => row.id);
        const slug = addRevenueSlugs[new URL(url).searchParams.get('a') ?? ''] ?? '';
        const kept = rows.filter((row) => isRelevantAddRevenue(row, slug) && row.image_link && row.link);
        lines.push(`| ${label} | ${response.status} | ${rows.length} | ${kept.length} | ${kept.filter((row) => !/out of stock/i.test(row.availability ?? '')).length} |`);
        if (rows.length === 0) lines.push(`|  | första 200 tecken: \`${text.slice(0, 200).replace(/[|\n`]/g, ' ')}\` | | | |`);
      } else {
        const rows = parseDelimited(text, '\t', "'").filter((row) => row.SKU);
        const kept = rows.filter(isRelevantAdtraction);
        lines.push(`| ${label} | ${response.status} | ${rows.length} | ${kept.length} | ${kept.filter((row) => /yes/i.test(row.Instock ?? '')).length} |`);
      }
    } catch (error) {
      lines.push(`| ${label} | fel | ${error instanceof Error ? error.message : String(error)} | | |`);
    }
  }
  return lines;
}

const fmtLinks = (links: Record<string, number>) => Object.entries(links).map(([merchant, count]) => `${merchant}×${count}`).join(', ') || '–';

async function main() {
  const posts = withoutConsolidatedPosts(await rest<Post[]>('blog_posts?select=slug,title,excerpt,content,category,tags,published_at&is_published=eq.true&order=published_at.desc&limit=1000')) as Post[];
  const productRows = await rest<Record<string, any>[]>('affiliate_products?select=id,external_id,name,price,price_original,image_url,image_urls,product_url,affiliate_url,category,in_stock,is_active,description,short_description,specs,affiliate_advertisers(slug,name)&is_active=eq.true&limit=5000');
  const live = productRows.filter((row) => row.in_stock !== false)
    .map(mapDatabaseProduct).filter((product): product is SmartAffiliateProduct => Boolean(product));
  const catalog = mergeCatalog(live);
  const reviewed = reviewedSlugs();

  const byAdvertiser = new Map<string, { active: number; inStock: number; categories: Record<string, number> }>();
  for (const row of productRows) {
    const slug = (Array.isArray(row.affiliate_advertisers) ? row.affiliate_advertisers[0] : row.affiliate_advertisers)?.slug ?? 'unknown';
    const entry = byAdvertiser.get(slug) ?? { active: 0, inStock: 0, categories: {} };
    entry.active += 1;
    if (row.in_stock !== false) {
      entry.inStock += 1;
      entry.categories[row.category ?? 'okänd'] = (entry.categories[row.category ?? 'okänd'] ?? 0) + 1;
    }
    byAdvertiser.set(slug, entry);
  }

  const results = [];
  for (const post of posts) results.push(analyse(post, catalog, await profile(post.slug), reviewed.has(post.slug)));
  results.sort((a, b) => b.views30d - a.views30d || a.slug.localeCompare(b.slug));

  const lines: string[] = [];
  lines.push(`# Affiliate-täckning per artikel (${new Date().toISOString().slice(0, 10)})`, '');
  lines.push(`Artiklar: ${results.length} · produkter i katalogen (efter sammanslagning): ${catalog.length}`, '');
  lines.push('## Katalog per annonsör (DB)', '', '| Annonsör | Aktiva | I lager | Kategorier i lager |', '|---|---:|---:|---|');
  for (const [slug, entry] of [...byAdvertiser.entries()].sort((a, b) => b[1].inStock - a[1].inStock)) {
    lines.push(`| ${slug} | ${entry.active} | ${entry.inStock} | ${Object.entries(entry.categories).map(([c, n]) => `${c} ${n}`).join(', ')} |`);
  }
  lines.push('', '## Artiklar (sorterat på visningar senaste 30 dagarna)', '');
  lines.push('| Artikel | Visn. 30d | Nivå | Ord | Mål | Matchade avsnitt | Butikslänkar i text | Nya textlänkar | Exempel |', '|---|---:|---|---:|---:|---:|---|---|---|');
  for (const r of results) {
    const example = r.placements[0] ? `${r.placements[0].product} (${r.placements[0].advertiser})` : (r.articleCandidates[0] ?? '–');
    lines.push(`| ${r.slug}${r.reviewed ? ' (granskad)' : ''} | ${r.views30d} | ${r.tier} | ${r.words} | ${r.targetBlocks} | ${r.sectionMatches}${r.shortfall ? ` (−${r.shortfall})` : ''} | ${fmtLinks(r.inTextShopLinks)} | ${r.newInTextLinks.join('; ').replace(/\|/g, '/') || '–'} | ${example.replace(/\|/g, '/')} |`);
  }
  const gaps = results.filter((r) => !r.reviewed && r.shortfall > 0 && r.views30d > 0);
  lines.push('', `## Luckor med trafik (${gaps.length})`, '');
  for (const r of gaps.slice(0, 40)) lines.push(`- **${r.slug}** (${r.views30d} visn., saknar ${r.shortfall}): ${r.headings.slice(0, 8).join(' / ')}`);

  lines.push('', ...(await feedDiagnostics()));
  const markdown = lines.join('\n');
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  if (process.env.COVERAGE_JSON) for (const r of results) console.log(`COVERAGE_JSON ${JSON.stringify(r)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
