#!/usr/bin/env node
/** Create-only editorial publishing. Emits SQL for the authenticated owner connection. */
import { createHash } from 'node:crypto';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const window = new JSDOM('').window;
const purifier = createDOMPurify(window);
const tags = ['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'img', 'figcaption', 'br'];
const attrs = ['href', 'src', 'alt', 'title', 'rel'];
export const hash = (value) => createHash('sha256').update(value).digest('hex');

export function validateArticle(article, config, now = new Date()) {
  const fail = (message) => { throw new Error(`${article?.slug || 'article'}: ${message}`); };
  if (!/^[a-z][a-z0-9-]+$/.test(config.site) || !/^[a-f0-9-]{36}$/.test(config.author_id) || !/^[a-f0-9-]{36}$/.test(config.lovable_project_id)) fail('invalid destination configuration');
  if (article.schema_version !== 1 || article.site !== config.site) fail('wrong schema version or destination site');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug || '')) fail('invalid slug');
  if (!/^[a-z0-9-]{8,180}$/.test(article.content_id || '')) fail('invalid content_id');
  if (typeof article.title !== 'string' || article.title.length < 15 || article.title.length > 140) fail('invalid title');
  if (typeof article.description !== 'string' || article.description.length < 60 || article.description.length > 180) fail('invalid description');
  if (!config.categories.includes(article.category)) fail('invalid category');
  if (!Array.isArray(article.tags) || article.tags.length > 8 || article.tags.some(t => typeof t !== 'string' || t.length > 60)) fail('invalid tags');
  if (article.author !== 'ChatGPT' || article.status !== 'ready') fail('article must be written and checked before publication');
  if (typeof article.search_intent !== 'string' || article.search_intent.trim().length < 20) fail('search intent required');
  for (const field of ['published_at', 'sources_checked_at', 'quality_checked_at']) {
    const time = Date.parse(article[field]);
    if (!Number.isFinite(time) || time > now.getTime() + 60_000) fail(`${field} missing or in the future`);
  }
  if (!Array.isArray(article.source_urls) || !article.source_urls.length) fail('checked sources required');
  for (const source of article.source_urls) {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password) fail('invalid source URL');
  }
  if (!/^\/blog-images\/[a-zA-Z0-9/_-]+\.(webp|jpg|jpeg|png|svg)$/.test(article.cover_image || '')) fail('use an owned blog image');
  if (!/^\/(?!\/)[a-zA-Z0-9/_?=&%-]*$/.test(article.cta_path || '') || article.cta_path.includes('..')) fail('invalid CTA path');
  const affiliateLinks = article.affiliate_links || [];
  if (!Array.isArray(affiliateLinks)) fail('affiliate_links must be an array');
  for (const affiliate of affiliateLinks) {
    const url = new URL(affiliate.url);
    const permit = (config.affiliate_programs || []).find(p => p.channel_id === url.searchParams.get('as') && p.ad_id === url.searchParams.get('a') && p.host === url.hostname);
    if (!permit || url.protocol !== 'https:' || url.pathname !== '/t/t' || url.username || url.password) fail('affiliate program or channel not verified for this site');
    if (url.searchParams.get('epi') !== article.slug) fail('article EPI required');
    if (!affiliate.destination_url?.startsWith('https:') || !Number.isFinite(Date.parse(affiliate.checked_at))) fail('checked affiliate destination required');
    if (new URL(affiliate.destination_url).hostname !== permit.destination_host) fail('wrong affiliate destination host');
    const destination = url.searchParams.get('url');
    if (!destination || new URL(destination.startsWith('https://') ? destination : 'https://' + destination).href !== new URL(affiliate.destination_url).href) fail('tracking destination mismatch');
    if (Date.parse(article.quality_checked_at) - Date.parse(permit.checked_at) > 35 * 86400000) fail('recheck program approval before adding affiliate links');
  }
  const html = article.content_html;
  if (typeof html !== 'string' || html.length > 80_000) fail('invalid content length');
  const body = window.document.createElement('div');
  body.innerHTML = html;
  const clean = purifier.sanitize(html, { ALLOWED_TAGS: tags, ALLOWED_ATTR: attrs, ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false });
  if (clean !== body.innerHTML) fail('HTML contains unsupported or unsafe markup');
  const words = body.textContent.trim().split(/\s+/).length;
  if (words < 450 || words > 2200) fail(`expected a useful article of 450–2200 words, got ${words}`);
  if (body.querySelectorAll('h2').length < 3) fail('at least three substantive sections required');
  for (const link of body.querySelectorAll('a')) {
    const href = link.getAttribute('href') || '';
    const url = new URL(href, config.origin);
    if (url.protocol !== 'https:' || url.username || url.password) fail('unsafe article link');
    if (href.startsWith('//') || href.includes('\\')) fail('ambiguous link');
    const affiliate = affiliateLinks.find(item => item.url === url.href);
    if (affiliate && !link.rel.split(/\s+/).includes('sponsored')) fail('affiliate link must have rel=sponsored');
    if (url.origin !== config.origin && !article.source_urls.includes(url.href) && !affiliate) fail(`external link not checked: ${url.href}`);
  }
  if (affiliateLinks.length && !/^Annonslänkar:/i.test(body.textContent.trim())) fail('place a clear affiliate disclosure before the article');
  for (const affiliate of affiliateLinks) if (![...body.querySelectorAll('a')].some(a => a.getAttribute('href') === affiliate.url)) fail('unused affiliate declaration');
  for (const image of body.querySelectorAll('img')) {
    const src = image.getAttribute('src') || '';
    if (!src.startsWith('/blog-images/') || src.includes('..') || !image.getAttribute('alt')) fail('invalid inline image');
  }
  if (![...body.querySelectorAll('a')].some(a => a.getAttribute('href') === article.cta_path)) fail('article has no contextual product link');
  return { words, sha256: hash(html) };
}

export function publicationSql(article, config) {
  const { words } = validateArticle(article, config);
  const hex = hash(`${config.site}:${article.content_id}`);
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  const row = {
    id, slug: article.slug, title: article.title, excerpt: article.description,
    content: article.content_html, cover_image_url: article.cover_image,
    category: article.category, tags: article.tags, meta_title: article.title,
    meta_description: article.description, is_published: true,
    published_at: article.published_at, author_id: config.author_id,
  };
  if (config.extended_columns) Object.assign(row, {
    feature_image_url: article.cover_image, reading_time_minutes: Math.ceil(words / 220), word_count: words,
  });
  const payload = JSON.stringify(row);
  let delimiter = `$article_${hash(payload).slice(0, 16)}$`;
  while (payload.includes(delimiter)) delimiter = delimiter.slice(0, -1) + 'x$';
  const literal = `${delimiter}${payload}${delimiter}::jsonb`;
  let guard = `$editorial_guard_${hash(payload).slice(0, 16)}$`;
  while (payload.includes(guard)) guard = guard.slice(0, -1) + 'x$';
  const columns = Object.keys(row);
  const names = columns.join(', ');
  // One PostgreSQL transaction: a retry preserves existing content, and conflicting
  // slugs, IDs or exact duplicate text fail. No UPDATE or upsert-overwrite path.
  return `-- Destination: ${config.site}; Lovable project ${config.lovable_project_id}\n` +
`BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('owned-editorial:${config.site}', 0));
DO ${guard}
DECLARE incoming jsonb := ${literal};
BEGIN
  IF EXISTS (SELECT 1 FROM public.blog_posts WHERE slug = incoming->>'slug'
    AND (content IS DISTINCT FROM incoming->>'content' OR title IS DISTINCT FROM incoming->>'title' OR NOT is_published)) THEN
    RAISE EXCEPTION 'Editorial conflict: preserve existing article or draft';
  END IF;
  IF EXISTS (SELECT 1 FROM public.blog_posts WHERE slug <> incoming->>'slug'
    AND (content = incoming->>'content' OR id = (incoming->>'id')::uuid)) THEN
    RAISE EXCEPTION 'Editorial duplicate: same text or content ID under another slug';
  END IF;
END; ${guard};
WITH incoming AS (SELECT * FROM jsonb_populate_record(NULL::public.blog_posts, ${literal})),
inserted AS (
  INSERT INTO public.blog_posts (${names}) SELECT ${names} FROM incoming
  ON CONFLICT (slug) DO NOTHING RETURNING id, slug
)
SELECT incoming.slug, COALESCE(inserted.id, existing.id) AS id,
  CASE WHEN inserted.id IS NULL THEN 'already_present' ELSE 'inserted' END AS status
FROM incoming LEFT JOIN inserted USING (slug)
LEFT JOIN public.blog_posts existing USING (slug);
COMMIT;\n`;
}

async function main() {
  const [command = 'check', file] = process.argv.slice(2);
  const config = JSON.parse(await readFile('content/editorial/config.json', 'utf8'));
  if (command === 'sql') {
    if (!file) throw new Error('Usage: node scripts/editorial-publisher.mjs sql content/editorial/articles/<slug>.json');
    const article = JSON.parse(await readFile(file, 'utf8'));
    await access(join('public', article.cover_image));
    process.stdout.write(publicationSql(article, config));
    return;
  }
  if (command !== 'check') throw new Error('Supported commands: check, sql');
  const directory = 'content/editorial/articles';
  const slugs = new Set();
  const ids = new Set();
  const hashes = new Set();
  const intents = new Set();
  for (const name of (await readdir(directory)).filter(name => name.endsWith('.json'))) {
    const article = JSON.parse(await readFile(join(directory, name), 'utf8'));
    const { sha256 } = validateArticle(article, config);
    const intent = article.search_intent.toLowerCase().trim();
    if (slugs.has(article.slug) || ids.has(article.content_id) || hashes.has(sha256) || intents.has(intent)) throw new Error(`Duplicate editorial item: ${name}`);
    slugs.add(article.slug); ids.add(article.content_id); hashes.add(sha256); intents.add(intent);
    await access(join('public', article.cover_image));
  }
  console.log(`Editorial check OK: ${slugs.size} article(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
