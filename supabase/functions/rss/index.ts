import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BASE_URL = "https://honsgarden.se";

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("title, slug, excerpt, cover_image_url, published_at, updated_at, category, tags")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(50);

  const now = new Date().toUTCString();
  const latestDate = posts?.[0]?.published_at ? new Date(posts[0].published_at).toUTCString() : now;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Hönsgården – Bloggen</title>
    <link>${BASE_URL}/blogg</link>
    <description>Tips, guider och recensioner för hönsägare. Allt om höns, ägg, hönshus och hållbart lantliv.</description>
    <language>sv</language>
    <lastBuildDate>${latestDate}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/favicon.ico</url>
      <title>Hönsgården</title>
      <link>${BASE_URL}</link>
    </image>
`;

  if (posts) {
    for (const post of posts) {
      const pubDate = post.published_at ? new Date(post.published_at).toUTCString() : now;
      const imageUrl = post.cover_image_url
        ? (post.cover_image_url.startsWith("http") ? post.cover_image_url : `${BASE_URL}${post.cover_image_url}`)
        : null;

      xml += `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE_URL}/blogg/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blogg/${post.slug}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(post.excerpt || '')}</description>`;

      if (post.category) {
        xml += `\n      <category>${escapeXml(post.category)}</category>`;
      }
      if (post.tags) {
        for (const tag of post.tags) {
          xml += `\n      <category>${escapeXml(tag)}</category>`;
        }
      }
      if (imageUrl) {
        xml += `\n      <media:content url="${escapeXml(imageUrl)}" medium="image" />`;
      }

      xml += `\n    </item>\n`;
    }
  }

  xml += `  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
});
