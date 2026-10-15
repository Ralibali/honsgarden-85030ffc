import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hash, listUpdates, readUpdate, updateSql, validateUpdate } from './editorial-update.mjs';

const config = JSON.parse(await readFile('content/editorial/config.json', 'utf8'));
const [slug] = await listUpdates();
const update = await readUpdate(slug);
const withNext = (next) => ({ ...update, next });

test('stored updates pass and keep the exported text', () => {
  const result = validateUpdate(update, config);
  assert.equal(result.previousSha256, hash(update.previous));
  assert.ok(result.words >= 900);
});

test('a changed previous text or unsupported claims are rejected', () => {
  assert.throws(() => validateUpdate({ ...update, previous: `${update.previous} ` }, config), /sha256 mismatch/);
  assert.throws(() => validateUpdate(withNext(update.next.replace('</p>', ' Vi har testat alla modeller.</p>')), config), /unsupported test or experience claim/);
  assert.throws(() => validateUpdate(withNext(`${update.next}<p><a href="https://unreviewed.example/">länk</a></p>`), config), /not in source_urls/);
  assert.throws(() => validateUpdate(withNext(`${update.next}<p onclick="x()">x</p>`), config), /unsafe attribute/);
});

test('approved merchants may be linked, they become tracked links when rendered', () => {
  assert.doesNotThrow(() => validateUpdate(withNext(`${update.next}<p><a href="https://www.p-lindberg.se/">P-Lindberg</a></p>`), config));
});

test('the SQL only updates a row that still holds the exported text', () => {
  const sql = updateSql(update, config);
  assert.match(sql, /IF current_hash <> incoming->>'previous_sha256' THEN\s+RAISE EXCEPTION 'Content update conflict/);
  assert.match(sql, /Content update already applied/);
  assert.match(sql, /FOR UPDATE/);
  assert.equal(sql.match(/UPDATE public\.blog_posts SET/g)?.length, 1);
  assert.doesNotMatch(sql, /INSERT INTO|DELETE FROM|ON CONFLICT/i);
  assert.ok(sql.includes(hash(update.previous)));
});
