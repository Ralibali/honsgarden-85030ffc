#!/usr/bin/env node
/**
 * Content updates for already published articles.
 *
 * The publisher (editorial-publisher.mjs) stays create-only. An update lives in
 * content/editorial/updates/<slug>/: previous.html is the exact published text
 * (exported with the coverage workflow's export_slugs input), next.html the new
 * text and update.json the metadata. The PR diff shows old and new side by side,
 * and the SQL only changes the row while its text still hashes to previous.html,
 * so an edit made after the export is never overwritten.
 */
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';
import { SHOP_PROGRAMS } from '../src/lib/adtractionPrograms.mjs';

export const UPDATES_DIR = 'content/editorial/updates';
export const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex');

const window = new JSDOM('').window;

// Claims the site cannot back up: no own tests, no invented years of experience.
const UNSUPPORTED_CLAIMS = /\b(?:jag|vi) har (?:testat|provat)\b|bäst i test|testvinnare|erfaren uppfödare|mina erfarenheter|efter \d+\+? år/i;

// Naked links to these merchants become tracked affiliate links when rendered
// (adtractionShopLinks), on every article or only on the program's own slugs.
const isMerchantHost = (hostname, slug) => SHOP_PROGRAMS.some((program) =>
  (program.sitewide || program.slugs.includes(slug)) && program.isNakedHost(hostname));

// Tags count as word breaks ("</p><h2>" separates two words), as in the coverage report.
export function wordCount(html) {
  return html.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;
}

export function validateUpdate({ slug, meta, previous, next }, config, now = new Date()) {
  const fail = (message) => { throw new Error(`${slug}: ${message}`); };
  if (meta.schema_version !== 1 || meta.site !== config.site) fail('wrong schema version or destination site');
  if (meta.slug !== slug) fail('slug must match the folder name');
  if (hash(previous) !== meta.previous_sha256) fail('previous.html is not the exported text (sha256 mismatch)');
  if (previous === next) fail('next.html is unchanged');
  if (typeof meta.reason !== 'string' || meta.reason.trim().length < 20) fail('describe why the article is updated');
  const checked = Date.parse(meta.quality_checked_at);
  if (!Number.isFinite(checked) || checked > now.getTime() + 60_000) fail('quality_checked_at missing or in the future');

  const fields = meta.next ?? {};
  if (typeof fields.title !== 'string' || fields.title.length < 15 || fields.title.length > 140) fail('invalid title');
  if (typeof fields.meta_title !== 'string' || fields.meta_title.length < 15 || fields.meta_title.length > 75) fail('meta_title must be 15–75 characters');
  if (typeof fields.meta_description !== 'string' || fields.meta_description.length < 60 || fields.meta_description.length > 170) fail('meta_description must be 60–170 characters');
  if (typeof fields.excerpt !== 'string' || fields.excerpt.length < 40 || fields.excerpt.length > 300) fail('invalid excerpt');
  if (!Array.isArray(fields.tags) || fields.tags.length > 8 || fields.tags.some((tag) => typeof tag !== 'string' || !tag || tag.length > 60)) fail('invalid tags');

  if (!Array.isArray(meta.source_urls)) fail('source_urls must be an array');
  for (const source of meta.source_urls) {
    const url = new URL(source);
    if (url.protocol !== 'https:' || url.username || url.password) fail('invalid source URL');
  }

  const textToCheck = [fields.title, fields.meta_title, fields.meta_description, fields.excerpt, ...fields.tags].join(' ');
  const body = window.document.createElement('div');
  body.innerHTML = next;
  if (UNSUPPORTED_CLAIMS.test(`${textToCheck} ${body.textContent}`)) fail('unsupported test or experience claim');
  if (body.querySelector('script, iframe, object, embed, form, input, style')) fail('unsupported markup');
  for (const element of body.querySelectorAll('*')) {
    for (const attribute of element.getAttributeNames()) {
      if (/^on/i.test(attribute) || attribute === 'style') fail('unsafe attribute');
    }
  }
  const words = wordCount(next);
  if (words < 900 || words > 2400) fail(`expected 900–2400 words, got ${words}`);
  if (body.querySelectorAll('h2').length < 4) fail('at least four sections required');
  if (body.querySelector('h1')) fail('the page already renders the title as h1');

  let internal = 0;
  for (const link of body.querySelectorAll('a')) {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('//') || href.includes('\\') || /^\s*javascript:/i.test(href)) fail('unsafe link');
    const url = new URL(href, config.origin);
    if (url.protocol !== 'https:' || url.username || url.password) fail(`unsafe link: ${href}`);
    if (url.origin === config.origin) { internal += 1; continue; }
    if (isMerchantHost(url.hostname, slug)) continue;
    if (!meta.source_urls.includes(url.href)) fail(`external link not in source_urls: ${url.href}`);
  }
  if (internal < 2) fail('link to at least two relevant pages on the site');
  for (const source of meta.source_urls) {
    if (![...body.querySelectorAll('a')].some((link) => new URL(link.getAttribute('href') || '', config.origin).href === source)) fail(`source not cited in the text: ${source}`);
  }
  return { words, previousSha256: meta.previous_sha256, nextSha256: hash(next) };
}

function dollarQuote(prefix, payload) {
  let tag = `$${prefix}_${hash(payload).slice(0, 16)}$`;
  while (payload.includes(tag)) tag = `${tag.slice(0, -1)}x$`;
  return tag;
}

export function updateSql(update, config) {
  const { words, previousSha256, nextSha256 } = validateUpdate(update, config);
  const fields = update.meta.next;
  const payload = JSON.stringify({
    slug: update.slug,
    previous_sha256: previousSha256,
    next_sha256: nextSha256,
    title: fields.title,
    meta_title: fields.meta_title,
    meta_description: fields.meta_description,
    excerpt: fields.excerpt,
    tags: fields.tags,
    content: update.next,
    word_count: words,
    reading_time_minutes: Math.ceil(words / 220),
  });
  const literal = dollarQuote('update', payload);
  const body = dollarQuote('update_guard', payload);
  // One transaction. The row changes only while it still holds the exported
  // text; a second run is a no-op and any other text raises an error.
  return `-- Content update ${update.slug}; destination ${config.site}, Lovable project ${config.lovable_project_id}
BEGIN;
DO ${body}
DECLARE
  incoming jsonb := ${literal}${payload}${literal}::jsonb;
  current_hash text;
BEGIN
  SELECT encode(sha256(convert_to(content, 'UTF8')), 'hex') INTO current_hash
    FROM public.blog_posts WHERE slug = incoming->>'slug' AND is_published FOR UPDATE;
  IF current_hash IS NULL THEN
    RAISE EXCEPTION 'Content update: % is not a published article', incoming->>'slug';
  END IF;
  IF current_hash = incoming->>'next_sha256' THEN
    RAISE NOTICE 'Content update already applied: %', incoming->>'slug';
    RETURN;
  END IF;
  IF current_hash <> incoming->>'previous_sha256' THEN
    RAISE EXCEPTION 'Content update conflict: % changed after the export; export it again', incoming->>'slug';
  END IF;
  UPDATE public.blog_posts SET
    title = incoming->>'title',
    meta_title = incoming->>'meta_title',
    meta_description = incoming->>'meta_description',
    excerpt = incoming->>'excerpt',
    tags = ARRAY(SELECT jsonb_array_elements_text(incoming->'tags')),
    content = incoming->>'content',
    word_count = (incoming->>'word_count')::int,
    reading_time_minutes = (incoming->>'reading_time_minutes')::int,
    updated_at = now()
  WHERE slug = incoming->>'slug';
END ${body};
SELECT slug, encode(sha256(convert_to(content, 'UTF8')), 'hex') = '${nextSha256}' AS applied, updated_at
  FROM public.blog_posts WHERE slug = '${update.slug}';
COMMIT;
`;
}

export async function readUpdate(slug, root = UPDATES_DIR) {
  const folder = join(root, slug);
  const [meta, previous, next] = await Promise.all([
    readFile(join(folder, 'update.json'), 'utf8').then(JSON.parse),
    readFile(join(folder, 'previous.html'), 'utf8'),
    // An editor's trailing newline is not part of the article.
    readFile(join(folder, 'next.html'), 'utf8').then((html) => html.replace(/\s+$/, '')),
  ]);
  return { slug, meta, previous, next };
}

export async function listUpdates(root = UPDATES_DIR) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
}

async function main() {
  const [command = 'check', slug] = process.argv.slice(2);
  const config = JSON.parse(await readFile('content/editorial/config.json', 'utf8'));
  if (command === 'sql') {
    if (!slug) throw new Error('Usage: node scripts/editorial-update.mjs sql <slug>');
    process.stdout.write(updateSql(await readUpdate(slug), config));
    return;
  }
  if (command !== 'check') throw new Error('Supported commands: check, sql');
  const slugs = await listUpdates();
  for (const name of slugs) validateUpdate(await readUpdate(name), config);
  console.log(`Content updates OK: ${slugs.length} update(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
