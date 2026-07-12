import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMBED_URL = "https://app.trysoro.com/api/embed/bfddd713-72b8-48fc-b6ba-70a659602721";
const AUTHOR_ID = "00000000-0000-0000-0000-000000000000";
const MAX_ARTICLES_PER_RUN = 100;
const MAX_CONTENT_LENGTH = 500_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-cron-secret, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request, serviceRoleKey: string) {
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  return (
    (!!serviceRoleKey && bearer === serviceRoleKey) ||
    (!!cronSecret && req.headers.get("x-cron-secret") === cronSecret)
  );
}

function cleanSlug(slug: string) {
  return slug
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);
}

function wordCount(html: string) {
  return html.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return jsonResponse({ error: "Missing backend configuration" }, 500);
  if (!isAuthorized(req, serviceKey)) return jsonResponse({ error: "Unauthorized" }, 401);

  try {
    const embedResponse = await fetch(EMBED_URL, {
      headers: { "User-Agent": "Honsgarden-Soro-Sync/1.0" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!embedResponse.ok) throw new Error(`Soro embed could not be fetched (${embedResponse.status})`);
    const script = await embedResponse.text();
    if (script.length > 5_000_000) throw new Error("Soro embed response too large");

    const articlesJson = script.match(/var SORO_ARTICLES = (\[[\s\S]*?\]);\n/)?.[1];
    const apiBaseRaw = script.match(/var SORO_API_BASE = ['"]([^'"]+)['"]/)?.[1];
    const token = script.match(/var SORO_TOKEN = ['"]([^'"]+)['"]/)?.[1];
    const apiBase = safeHttpUrl(apiBaseRaw);
    if (!articlesJson || !apiBase || !token || token.length > 500) {
      throw new Error("Soro metadata could not be parsed safely");
    }

    const parsed = JSON.parse(articlesJson);
    if (!Array.isArray(parsed)) throw new Error("Soro article payload is invalid");
    const articles = parsed.slice(0, MAX_ARTICLES_PER_RUN) as Array<{
      id: string;
      title: string;
      slug: string;
      excerpt?: string;
      isoDate?: string;
      image?: string;
      content?: string;
    }>;

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    let synced = 0;
    let skipped = 0;

    for (const article of articles) {
      const articleId = String(article.id || "").slice(0, 200);
      if (!articleId) {
        skipped += 1;
        continue;
      }

      const detailUrl = new URL(`/api/embed/${encodeURIComponent(token)}/article/${encodeURIComponent(articleId)}`, apiBase);
      const detailResponse = await fetch(detailUrl, {
        headers: { "User-Agent": "Honsgarden-Soro-Sync/1.0" },
        signal: AbortSignal.timeout(20_000),
      });
      const detail = detailResponse.ok ? await detailResponse.json().catch(() => null) : null;
      const content = String(detail?.content || article.content || "").slice(0, MAX_CONTENT_LENGTH);
      const slug = cleanSlug(String(article.slug || ""));
      const title = String(article.title || "").trim().slice(0, 240);
      if (!slug || !title || !content) {
        skipped += 1;
        continue;
      }

      const words = wordCount(content);
      const excerpt = article.excerpt ? String(article.excerpt).slice(0, 500) : null;
      const imageUrl = safeHttpUrl(article.image);
      const publishedDate = article.isoDate ? new Date(article.isoDate) : new Date();
      const publishedAt = Number.isNaN(publishedDate.getTime()) ? new Date().toISOString() : publishedDate.toISOString();

      const { error } = await supabase.from("blog_posts").upsert({
        slug,
        title,
        excerpt,
        meta_description: excerpt?.slice(0, 155) ?? null,
        meta_keywords: "soro, hönsgården, hönsapp",
        content,
        category: "guide",
        feature_image_url: imageUrl,
        cover_image_url: imageUrl,
        reading_time_minutes: Math.max(1, Math.ceil(words / 220)),
        word_count: words,
        published_at: publishedAt,
        updated_at: new Date().toISOString(),
        is_published: true,
        author_id: AUTHOR_ID,
      }, { onConflict: "slug" });

      if (error) throw new Error(error.message);
      synced += 1;
    }

    let deployTriggered = false;
    if (synced > 0) {
      const deployHook = safeHttpUrl(Deno.env.get("DEPLOY_HOOK_URL"));
      if (deployHook) {
        try {
          const hookResponse = await fetch(deployHook, {
            method: "POST",
            signal: AbortSignal.timeout(20_000),
          });
          deployTriggered = hookResponse.ok;
          if (!hookResponse.ok) {
            console.error("Deploy hook non-OK:", hookResponse.status, await hookResponse.text().catch(() => ""));
          }
        } catch (error) {
          console.error("Deploy hook failed:", error);
        }
      }
    }

    return jsonResponse({ success: true, found: articles.length, synced, skipped, deployTriggered });
  } catch (error) {
    console.error("sync-soro-blog error", error);
    return jsonResponse({ error: "Blog sync failed" }, 500);
  }
});
