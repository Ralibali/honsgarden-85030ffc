import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const EMBED_URL = "https://app.trysoro.com/api/embed/bfddd713-72b8-48fc-b6ba-70a659602721";
const AUTHOR_ID = "00000000-0000-0000-0000-000000000000";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function cleanSlug(slug: string) {
  return slug
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function wordCount(html: string) {
  return html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!["GET", "POST"].includes(req.method)) return jsonResponse({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  const serviceKeyAuth = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const provided = auth.replace("Bearer ", "").trim();
  const okSecret = cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (provided !== serviceKeyAuth && !okSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }


  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return jsonResponse({ error: "Missing backend configuration" }, 500);

    const script = await fetch(EMBED_URL).then((res) => {
      if (!res.ok) throw new Error(`Soro embed could not be fetched (${res.status})`);
      return res.text();
    });

    const articlesJson = script.match(/var SORO_ARTICLES = (\[[\s\S]*?\]);\n/)?.[1];
    const apiBase = script.match(/var SORO_API_BASE = ['"]([^'"]+)['"]/)?.[1];
    const token = script.match(/var SORO_TOKEN = ['"]([^'"]+)['"]/)?.[1];
    if (!articlesJson || !apiBase || !token) throw new Error("Soro metadata could not be parsed");

    const articles = JSON.parse(articlesJson) as Array<{
      id: string;
      title: string;
      slug: string;
      excerpt?: string;
      isoDate?: string;
      image?: string;
      content?: string;
    }>;

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    let synced = 0;
    let skipped = 0;

    for (const article of articles) {
      const detail = await fetch(`${apiBase}/api/embed/${token}/article/${article.id}`).then((res) =>
        res.ok ? res.json() : null,
      );
      const content = detail?.content || article.content || "";
      const slug = cleanSlug(article.slug || "");
      if (!slug || !article.title || !content) {
        skipped += 1;
        continue;
      }

      const words = wordCount(content);
      const { error } = await supabase.from("blog_posts").upsert({
        slug,
        title: article.title,
        excerpt: article.excerpt ?? null,
        meta_description: article.excerpt ? article.excerpt.slice(0, 155) : null,
        meta_keywords: "soro, hönsgården, hönsapp",
        content,
        category: "guide",
        feature_image_url: article.image ?? null,
        cover_image_url: article.image ?? null,
        reading_time_minutes: Math.max(1, Math.ceil(words / 220)),
        word_count: words,
        published_at: article.isoDate ? new Date(article.isoDate).toISOString() : new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_published: true,
        author_id: AUTHOR_ID,
      }, { onConflict: "slug" });

      if (error) throw new Error(error.message);
      synced += 1;
    }

    return jsonResponse({ success: true, found: articles.length, synced, skipped });
  } catch (error) {
    console.error("sync-soro-blog error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});