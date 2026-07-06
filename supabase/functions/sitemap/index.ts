import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const responseHeaders = {
  ...corsHeaders,
  "Content-Type": "application/xml; charset=utf-8",
};

const BASE_URL = "https://honsgarden.se";

const CATEGORIES = [
  "guide", "recension", "tips", "halsa",
  "nyborjare", "raser", "tradgard", "hem", "friluftsliv",
];

// SEO_SOURCES removed: /raser, /problem, /skotsel, /manad routes are not
// registered in App.tsx, so emitting them in the sitemap produces 404s for
// crawlers. Re-add here only when matching <Route path="..."> entries exist.

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, updated_at, published_at, cover_image_url, feature_image_url, title, category, tags")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  const { data: settings } = await supabase
    .from("seo_settings")
    .select("public_routes_enabled")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  // Active public egg-sale listings (drives /s/:slug)
  const { data: eggSaleListings } = await supabase
    .from("public_egg_sale_listings")
    .select("slug, updated_at")
    .eq("is_active", true);

  // Active marketplace listings (drives /marknad/:slug)
  const { data: marketplaceListings } = await supabase
    .from("marketplace_listings")
    .select("slug, updated_at")
    .eq("status", "active");

  const MARKETPLACE_CATEGORY_SLUGS = ["hons-till-salu", "klackagg", "tillbehor", "honshus"];


  // Static list of localities for /salja-agg/:ort (mirrors src/data/saljaAggOrter.ts)
  const SALJA_AGG_ORTER = ["goteborg","malmo","lund","helsingborg","angelholm","bastad","kristianstad","ystad","simrishamn","trelleborg","eslov","hassleholm","landskrona","lomma","staffanstorp","laholm","halmstad","falkenberg","varberg","kungsbacka","molndal","partille","lerum","alingsas","kungalv","stenungsund","uddevalla","trollhattan","vanersborg","boras","ulricehamn","vargarda","skovde","mariestad","lidkoping","jonkoping","huskvarna","vetlanda","eksjo","nassjo","varnamo","vaxjo","alvesta","kalmar","nybro","oskarshamn","vastervik","visby","karlskrona","ronneby","karlshamn","linkoping","norrkoping","motala","mjolby","soderkoping","finspang","vadstena","stockholm","solna","sundbyberg","jarfalla","taby","vallentuna","osteraker","norrtalje","nacka","varmdo","tyreso","haninge","nynashamn","huddinge","botkyrka","sodertalje","nykvarn","uppsala","enkoping","knivsta","tierp","vasteras","koping","eskilstuna","strangnas","nykoping","katrineholm","orebro","kumla","lindesberg","karlskoga","karlstad","kristinehamn","arvika","forshaga","falun","borlange","leksand","mora","gavle","sandviken","soderhamn","hudiksvall","sundsvall","harnosand","ornskoldsvik","ostersund","umea","skelleftea","pitea","lulea","boden","kiruna"];


  // Collect unique tags
  const allTags = new Set<string>();
  if (posts) {
    for (const post of posts) {
      if (post.tags) {
        for (const tag of post.tags) allTags.add(tag);
      }
      if (post.category) allTags.add(post.category);
    }
  }

  const staticPages = [
    { loc: "/", priority: "1.0", changefreq: "weekly" },
    { loc: "/blogg", priority: "0.9", changefreq: "daily" },
    { loc: "/om-oss", priority: "0.7", changefreq: "monthly" },
    { loc: "/verktyg/aggkalkylator", priority: "0.8", changefreq: "monthly" },
    { loc: "/app-for-honsagare", priority: "0.8", changefreq: "monthly" },
    { loc: "/agglogg", priority: "0.8", changefreq: "monthly" },
    { loc: "/honskalender", priority: "0.7", changefreq: "monthly" },
    { loc: "/foderkostnad-hons", priority: "0.7", changefreq: "monthly" },
    { loc: "/klackningskalender", priority: "0.7", changefreq: "monthly" },
    { loc: "/borja-med-hons", priority: "0.7", changefreq: "monthly" },
    { loc: "/honsraser", priority: "0.9", changefreq: "monthly" },
    { loc: "/honsraser-lista", priority: "0.8", changefreq: "monthly" },
    { loc: "/dvarghons", priority: "0.8", changefreq: "monthly" },
    { loc: "/skansk-blommehona", priority: "0.8", changefreq: "monthly" },
    { loc: "/salja-agg", priority: "0.8", changefreq: "weekly" },
    { loc: "/karta", priority: "0.6", changefreq: "weekly" },
    { loc: "/s/agg", priority: "0.5", changefreq: "monthly" },
    { loc: "/marknad", priority: "0.85", changefreq: "daily" },
  ];


  const now = new Date().toISOString().split("T")[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;

  // Static pages
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${BASE_URL}${page.loc}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <xhtml:link rel="alternate" hreflang="sv" href="${BASE_URL}${page.loc}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}${page.loc}" />
  </url>
`;
  }

  // Category pages
  for (const cat of CATEGORIES) {
    xml += `  <url>
    <loc>${BASE_URL}/blogg/kategori/${cat}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="sv" href="${BASE_URL}/blogg/kategori/${cat}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/blogg/kategori/${cat}" />
  </url>
`;
  }

  // Tag pages
  for (const tag of allTags) {
    const encoded = encodeURIComponent(tag);
    xml += `  <url>
    <loc>${BASE_URL}/blogg/tagg/${encoded}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="sv" href="${BASE_URL}/blogg/tagg/${encoded}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/blogg/tagg/${encoded}" />
  </url>
`;
  }

  // Locality pages /salja-agg/:ort
  for (const ort of SALJA_AGG_ORTER) {
    xml += `  <url>
    <loc>${BASE_URL}/salja-agg/${ort}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="sv" href="${BASE_URL}/salja-agg/${ort}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/salja-agg/${ort}" />
  </url>
`;
  }

  // Active public egg-sale listings /s/:slug
  if (eggSaleListings) {
    for (const listing of eggSaleListings) {
      if (!listing.slug) continue;
      const lastmod = (listing.updated_at || now).split("T")[0];
      xml += `  <url>
    <loc>${BASE_URL}/s/${listing.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
    <xhtml:link rel="alternate" hreflang="sv" href="${BASE_URL}/s/${listing.slug}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/s/${listing.slug}" />
  </url>
`;
    }
  }


  // Blog posts (both /blogg/ canonical and /guider/ alternate)
  if (posts) {
    for (const post of posts) {
      const lastmod = (post.updated_at || post.published_at || now).split("T")[0];
      const featureImage = post.feature_image_url || post.cover_image_url;
      const imageUrl = featureImage
        ? (featureImage.startsWith("http") ? featureImage : `${BASE_URL}${featureImage}`)
        : null;

      xml += `  <url>
    <loc>${BASE_URL}/blogg/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="sv" href="${BASE_URL}/blogg/${post.slug}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/blogg/${post.slug}" />`;

      if (imageUrl) {
        xml += `
    <image:image>
      <image:loc>${escapeXml(imageUrl)}</image:loc>
      <image:title>${escapeXml(post.title || "")}</image:title>
    </image:image>`;
      }

      xml += `
  </url>
`;
    }
  }

  // Marketplace category landing pages /marknad/k/:kategori
  for (const cat of MARKETPLACE_CATEGORY_SLUGS) {
    xml += `  <url>
    <loc>${BASE_URL}/marknad/k/${cat}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
    <xhtml:link rel="alternate" hreflang="sv" href="${BASE_URL}/marknad/k/${cat}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/marknad/k/${cat}" />
  </url>
`;
  }

  // Active marketplace listings /marknad/:slug
  if (marketplaceListings) {
    for (const listing of marketplaceListings) {
      if (!listing.slug) continue;
      const lastmod = (listing.updated_at || now).split("T")[0];
      xml += `  <url>
    <loc>${BASE_URL}/marknad/${listing.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
    <xhtml:link rel="alternate" hreflang="sv" href="${BASE_URL}/marknad/${listing.slug}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE_URL}/marknad/${listing.slug}" />
  </url>
`;
    }
  }

  // SEO_SOURCES loop removed — see comment near top of file.


  xml += `</urlset>`;


  return new Response(xml, {
    headers: {
      ...responseHeaders,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
});
