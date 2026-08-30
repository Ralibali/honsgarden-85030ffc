#!/usr/bin/env node
/**
 * Redaktionell granskning av publicerat innehåll (Swarm D).
 *
 * Hämtar publicerade artiklar via publik REST (samma mönster som
 * prerender-skriptet) och kör policy-granskningen i
 * src/lib/editorialAudit.mjs.
 *
 * Användning:
 *   node scripts/editorial-audit.mjs          # rapport, exit 0
 *   node scripts/editorial-audit.mjs --check  # exit 1 vid errors
 */

import { auditPosts } from '../src/lib/editorialAudit.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sikbymtrbhrofysgkqsj.supabase.co';
const SUPABASE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpa2J5bXRyYmhyb2Z5c2drcXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2NjQ0MjAsImV4cCI6MjA4ODI0MDQyMH0.SlgJoYwkD5GWeZ2mK-GihDvEWpt8noKWE8xulzSOqaU';

async function fetchPosts() {
  const params = new URLSearchParams({
    select: 'slug,title,excerpt,content,category,tags,meta_description,cover_image_url,feature_image_url,word_count',
    is_published: 'eq.true',
    order: 'published_at.desc',
    limit: '1000',
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/blog_posts?${params}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!response.ok) throw new Error(`Kunde inte hämta artiklar (${response.status})`);
  return response.json();
}

const groupBy = (findings) => {
  const map = new Map();
  for (const f of findings) map.set(f.type, (map.get(f.type) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
};

async function main() {
  const check = process.argv.includes('--check');
  const posts = await fetchPosts();
  const report = auditPosts(posts);

  console.log(`\n📰 Redaktionell granskning — ${report.total} publicerade artiklar\n`);

  if (report.errors.length > 0) {
    console.log(`❌ Errors (${report.errors.length}) — bör åtgärdas:`);
    for (const [type, count] of groupBy(report.errors)) console.log(`   ${type}: ${count}`);
    for (const e of report.errors.slice(0, 20)) console.log(`   • ${e.slug}: ${e.detail}`);
  } else {
    console.log('✅ Inga errors (dubbletter/trasiga interna länkar).');
  }

  if (report.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${report.warnings.length}) — redaktionell genomgång:`);
    for (const [type, count] of groupBy(report.warnings)) console.log(`   ${type}: ${count}`);
    for (const w of report.warnings.slice(0, 25)) console.log(`   • ${w.slug}: ${w.type}${w.detail ? ` — ${w.detail}` : ''}`);
  } else {
    console.log('✅ Inga warnings.');
  }

  if (check && report.errors.length > 0) {
    console.error('\n--check: errors hittades.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Granskningen misslyckades:', err.message);
  process.exit(1);
});
