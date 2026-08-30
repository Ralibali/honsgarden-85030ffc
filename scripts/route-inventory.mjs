#!/usr/bin/env node
/**
 * Route inventory CLI — keeps vercel.json routing in sync with the canonical
 * inventory in src/lib/routeInventory.mjs.
 *
 *   node scripts/route-inventory.mjs           print the inventory table
 *   node scripts/route-inventory.mjs --check   exit 1 if vercel.json drifts
 *   node scripts/route-inventory.mjs --write   regenerate rewrites/redirects
 *
 * Why this exists: vercel.json previously rewrote EVERY path ("/(.*)") to
 * /index.html, so bogus URLs answered HTTP 200 with the app shell — a
 * site-wide soft-404. The inventory enumerates the real routes instead, so
 * unknown paths fall through to Vercel's filesystem 404 (public/404.html).
 */
import { readFile, writeFile } from 'node:fs/promises';
import {
  ROUTE_REDIRECTS,
  STATIC_PUBLIC_ROUTES,
  DYNAMIC_PUBLIC_ROUTES,
  APP_SHELL_ROUTES,
  buildVercelRewrites,
  buildVercelRedirects,
} from '../src/lib/routeInventory.mjs';

const VERCEL_JSON = new URL('../vercel.json', import.meta.url);
const mode = process.argv.includes('--write')
  ? 'write'
  : process.argv.includes('--check')
    ? 'check'
    : 'print';

const normalise = (value) => JSON.stringify(value, null, 2);

async function main() {
  const expectedRewrites = buildVercelRewrites();
  const expectedRedirects = buildVercelRedirects();

  if (mode === 'print') {
    console.log('Redirects (infra-level, evaluated before filesystem):');
    for (const r of ROUTE_REDIRECTS) console.log(`  ${r.source} → ${r.destination} (${r.statusCode})`);
    console.log(`\nStatic public routes (${STATIC_PUBLIC_ROUTES.length}):`);
    for (const r of STATIC_PUBLIC_ROUTES) console.log(`  ${r}`);
    console.log(`\nDynamic public routes (${DYNAMIC_PUBLIC_ROUTES.length}):`);
    for (const r of DYNAMIC_PUBLIC_ROUTES) console.log(`  ${r.pattern}  (e.g. ${r.example})`);
    console.log(`\nApp shell routes (${APP_SHELL_ROUTES.length}):`);
    for (const r of APP_SHELL_ROUTES) console.log(`  ${r.pattern}`);
    console.log(`\nvercel.json rewrites: ${expectedRewrites.length}, redirects: ${expectedRedirects.length}`);
    console.log('Everything else → filesystem, then true 404 (public/404.html).');
    return;
  }

  const config = JSON.parse(await readFile(VERCEL_JSON, 'utf8'));
  const inSync =
    normalise(config.rewrites ?? []) === normalise(expectedRewrites) &&
    normalise(config.redirects ?? []) === normalise(expectedRedirects);

  if (mode === 'check') {
    if (!inSync) {
      console.error('vercel.json routing is OUT OF SYNC with src/lib/routeInventory.mjs');
      console.error(`  expected ${expectedRewrites.length} rewrites, found ${(config.rewrites ?? []).length}`);
      console.error(`  expected ${expectedRedirects.length} redirects, found ${(config.redirects ?? []).length}`);
      console.error('Run: node scripts/route-inventory.mjs --write');
      process.exit(1);
    }
    console.log(`vercel.json routing in sync (${expectedRewrites.length} rewrites, ${expectedRedirects.length} redirects).`);
    return;
  }

  if (inSync) {
    console.log('vercel.json already in sync — nothing to write.');
    return;
  }
  config.redirects = expectedRedirects;
  config.rewrites = expectedRewrites;
  await writeFile(VERCEL_JSON, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`vercel.json updated: ${expectedRewrites.length} rewrites, ${expectedRedirects.length} redirects.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
