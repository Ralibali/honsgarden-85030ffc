#!/usr/bin/env node
// Temporary, read-only release export for the 2026-11-25 content review.
// Uses the existing validators and SQL generators. Never connects to a database.
import { readFile } from 'node:fs/promises';
import { readUpdate, updateSql, hash as updateHash } from './editorial-update.mjs';
import { publicationSql, hash } from './editorial-publisher.mjs';

const config = JSON.parse(await readFile('content/editorial/config.json', 'utf8'));
const slugs = ['klacka-agg', 'sittpinnar-hons', 'varprede-hons', 'varmelampa-hons', 'vattenautomat-hons'];
for (const slug of slugs) {
  const update = await readUpdate(slug);
  const sql = updateSql(update, config);
  if (process.env.CI) console.log('EDITORIAL_SQL:' + JSON.stringify({kind:'update', slug, sha256:updateHash(update.next), sql}));
}
const article = JSON.parse(await readFile('content/editorial/articles/fagelinfluensa-sverige-2026.json', 'utf8'));
const sql = publicationSql(article, config);
if (process.env.CI) console.log('EDITORIAL_SQL:' + JSON.stringify({kind:'create', slug:article.slug, sha256:hash(article.content_html), sql}));
console.log('Release SQL validated; no database writes performed.');
