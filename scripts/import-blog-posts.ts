import { createClient } from '@supabase/supabase-js';
import matter from 'gray-matter';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error('Saknar VITE_SUPABASE_URL/SUPABASE_URL eller SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const toNumber = (value: unknown, fallback: number | null = null) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const wordCount = (content: string) => content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;

async function importPosts() {
  const dir = './seo-content';
  const files = await readdir(dir);

  for (const file of files.filter((f) => f.endsWith('.md'))) {
    const source = await readFile(join(dir, file), 'utf-8');
    const { data, content } = matter(source);
    const words = toNumber(data.word_count, wordCount(content)) ?? wordCount(content);

    if (!data.slug || !data.title) {
      console.error(`❌ ${file}: slug och title krävs i frontmatter`);
      continue;
    }

    const { error } = await supabase.from('blog_posts').upsert({
      slug: String(data.slug),
      title: String(data.title),
      meta_description: data.meta_description ? String(data.meta_description) : null,
      meta_keywords: data.meta_keywords ? String(data.meta_keywords) : null,
      content,
      category: data.category ? String(data.category) : 'guide',
      feature_image_url: data.feature_image_url ? String(data.feature_image_url) : null,
      cover_image_url: data.feature_image_url ? String(data.feature_image_url) : null,
      reading_time_minutes: toNumber(data.reading_time_minutes, Math.max(1, Math.ceil(words / 220))),
      word_count: words,
      published_at: data.published_at ? new Date(data.published_at).toISOString() : new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_published: true,
      author_id: data.author_id ? String(data.author_id) : '00000000-0000-0000-0000-000000000000',
    }, { onConflict: 'slug' });

    if (error) console.error(`❌ ${file}:`, error.message);
    else console.log(`✅ ${file}`);
  }
}

importPosts().catch((error) => {
  console.error('Importen misslyckades:', error.message);
  process.exit(1);
});