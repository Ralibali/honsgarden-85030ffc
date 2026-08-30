#!/usr/bin/env node
/**
 * Prestandabudget mot byggd dist (Swarm V).
 *
 * Körs EFTER npm run build (vite build). Mäter gzip-storlekar på
 * entry-chunkar och CSS och utvärderar mot budgeten i
 * src/lib/perfBudget.mjs.
 *
 *   node scripts/perf-budget.mjs          # rapport, exit 0
 *   node scripts/perf-budget.mjs --check  # exit 1 vid budgetöverdrag
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { evaluatePerfBudget } from '../src/lib/perfBudget.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const KB = 1024;

const gzipKb = (file) => Math.round(gzipSync(readFileSync(file)).length / KB);

function collect() {
  const assetsDir = join(DIST, 'assets');
  const files = readdirSync(assetsDir);
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const cssFiles = files.filter((f) => f.endsWith('.css'));

  const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
  const entryMatch = indexHtml.match(/assets\/(index-[^"]+\.js)/);
  const entryFile = entryMatch ? entryMatch[1] : jsFiles.find((f) => f.startsWith('index-'));

  const find = (prefix) => {
    const f = jsFiles.filter((x) => x.startsWith(prefix)).sort((a, b) => statSync(join(assetsDir, b)).size - statSync(join(assetsDir, a)).size)[0];
    return f ? gzipKb(join(assetsDir, f)) : undefined;
  };

  const entryJsGzipKb = entryFile ? gzipKb(join(assetsDir, entryFile)) : undefined;
  const vendorJsGzipKb = find('vendor-');
  const uiChunkGzipKb = find('ui-');
  const cssGzipKb = cssFiles.reduce((s, f) => s + gzipKb(join(assetsDir, f)), 0);
  const largestChunkRawKb = Math.round(
    Math.max(...jsFiles.map((f) => statSync(join(assetsDir, f)).size)) / KB,
  );

  const metrics = {
    entryJsGzipKb,
    vendorJsGzipKb,
    uiChunkGzipKb,
    cssGzipKb,
    largestChunkRawKb,
    initialLoadGzipKb:
      entryJsGzipKb != null && vendorJsGzipKb != null && uiChunkGzipKb != null
        ? entryJsGzipKb + vendorJsGzipKb + uiChunkGzipKb + cssGzipKb
        : undefined,
  };

  // Topp-10 tyngsta chunkar (gzip) för rapporten.
  const top = jsFiles
    .map((f) => ({ file: f, gzipKb: gzipKb(join(assetsDir, f)) }))
    .sort((a, b) => b.gzipKb - a.gzipKb)
    .slice(0, 10);
  return { metrics, top, chunkCount: jsFiles.length };
}

const { metrics, top, chunkCount } = collect();
const report = evaluatePerfBudget(metrics);

console.log(`\n⚡ Prestandabudget — ${chunkCount} JS-chunkar\n`);
for (const [id, budget] of Object.entries(report.budgets)) {
  const actual = metrics[id];
  const mark = actual == null ? '❓' : actual > budget ? '❌' : '✅';
  console.log(`${mark} ${id}: ${actual ?? 'saknas'} KB (budget ${budget} KB)`);
}
console.log('\nTyngsta chunkar (gzip):');
for (const t of top) console.log(`   ${String(t.gzipKb).padStart(4)} KB  ${t.file}`);

if (!report.ok) {
  console.error('\nBudgetöverdrag! Ratchet-principen: skärp aldrig genom att höja budgeten tyst — åtgärda regressionen eller dokumentera ett medvetet beslut.');
  if (process.argv.includes('--check')) process.exit(1);
} else {
  console.log('\nAlla budgetar håller. ✅');
}
