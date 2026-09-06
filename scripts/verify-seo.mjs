import { existsSync, readFileSync, readdirSync } from "node:fs";
import {
  assertDemoPageHtml,
  assertHomePageHtml,
  assertTopicPageHtml,
  extractH1Texts,
  extractTitle,
} from "../src/lib/prerenderTopicPages.mjs";
import { CONTEXTUAL_CTAS, assertContextualRegisterCta } from "../src/lib/contextualRegisterCtas.mjs";

const required = [
  "dist/index.html",
  "dist/404.html",
  "dist/sitemap.xml",
  "dist/blogg/index.html",
  "dist/borja-med-hons/index.html",
  "dist/honsraser-lista/index.html",
  "dist/salja-agg/index.html",
  "dist/demo/index.html",
];

for (const file of required) {
  if (!existsSync(file)) throw new Error(`SEO-build saknar ${file}`);
}

const sitemap = readFileSync("dist/sitemap.xml", "utf8");
if (!sitemap.includes("<urlset")) throw new Error("sitemap.xml är inte giltig XML");
if (!sitemap.includes("https://honsgarden.se/blogg/bast-honsras-sverige")) {
  throw new Error("sitemap.xml saknar /blogg/bast-honsras-sverige");
}
if (/https:\/\/honsgarden\.se\/app(?:<|\/)/.test(sitemap)) {
  throw new Error("sitemap.xml innehåller /app");
}
if (/https:\/\/honsgarden\.se\/(?:login|reset-password|inbjudan|demo)(?:<|\/|\?)/.test(sitemap)) {
  throw new Error("sitemap.xml innehåller robots-blockerad URL");
}

const excluded = new Set(["kategori", "tagg", "bast-honsras-sverige", "foder-till-hons-guide"]);
const articles = readdirSync("dist/blogg", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !excluded.has(entry.name));
if (articles.length < 5) throw new Error(`För få prerenderade bloggartiklar: ${articles.length}`);

assertHomePageHtml(readFileSync("dist/index.html", "utf8"));
assertDemoPageHtml(readFileSync("dist/demo/index.html", "utf8"));

const topicPages = [
  {
    file: "dist/honsraser/orpington/index.html",
    path: "/honsraser/orpington",
    topicH1: "Orpington",
    titleIncludes: ["Orpington-höna", "~180"],
  },
  {
    file: "dist/honsraser/sussex/index.html",
    path: "/honsraser/sussex",
    topicH1: "Sussex",
    titleIncludes: ["Sussex-höna", "~240"],
  },
  {
    file: "dist/blogg/berakna-foderkostnad-for-hons/index.html",
    path: "/blogg/berakna-foderkostnad-for-hons",
    topicH1: "Beräkna foderkostnad för höns enkelt",
    titleIncludes: ["foderkostnad", "kalkyl"],
  },
];

for (const page of topicPages) {
  if (!existsSync(page.file)) throw new Error(`SEO-build saknar ${page.file}`);
  assertTopicPageHtml(readFileSync(page.file, "utf8"), page);
}

for (const cta of CONTEXTUAL_CTAS) {
  const file = `dist${cta.path}/index.html`;
  if (!existsSync(file)) throw new Error(`SEO-build saknar ${file}`);
  assertContextualRegisterCta(readFileSync(file, "utf8"), cta);
}

function decodeHtml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractQuotedField(block, field) {
  const match = block.match(new RegExp(`${field}:\\s*'((?:\\\\'|[^'])*)'`));
  if (!match) throw new Error(`Saknar ${field} i SaljaAgg.tsx useSeo`);
  return match[1].replace(/\\'/g, "'");
}

function parseSaljaAggUseSeo() {
  const source = readFileSync("src/pages/SaljaAgg.tsx", "utf8");
  const match = source.match(/useSeo\(\{([\s\S]*?)\n {2}\}\);/);
  if (!match) throw new Error("SaljaAgg.tsx saknar useSeo-anrop");
  return {
    title: extractQuotedField(match[1], "title"),
    description: extractQuotedField(match[1], "description"),
  };
}

function attr(html, pattern, label) {
  const match = html.match(pattern);
  if (!match) throw new Error(`/salja-agg saknar ${label}`);
  return decodeHtml(match[1]);
}

const saljaAggSeo = parseSaljaAggUseSeo();
const saljaAggHtml = readFileSync("dist/salja-agg/index.html", "utf8");
const saljaAggTitle = attr(saljaAggHtml, /<title>([\s\S]*?)<\/title>/i, "title");
const saljaAggDescription = attr(saljaAggHtml, /<meta name="description" content="([^"]*)"/i, "meta description");
const saljaAggOgTitle = attr(saljaAggHtml, /<meta property="og:title" content="([^"]*)"/i, "og:title");
const saljaAggOgDescription = attr(saljaAggHtml, /<meta property="og:description" content="([^"]*)"/i, "og:description");
const saljaAggTwitterTitle = attr(saljaAggHtml, /<meta name="twitter:title" content="([^"]*)"/i, "twitter:title");
const saljaAggTwitterDescription = attr(saljaAggHtml, /<meta name="twitter:description" content="([^"]*)"/i, "twitter:description");
const saljaAggJsonLdRaw = attr(
  saljaAggHtml,
  /<script type="application\/ld\+json" id="json-ld-prerendered">([\s\S]*?)<\/script>/i,
  "prerenderad WebPage JSON-LD",
);
const saljaAggJsonLd = JSON.parse(saljaAggJsonLdRaw);

if (saljaAggTitle !== saljaAggSeo.title) {
  throw new Error(`/salja-agg title matchar inte useSeo: ${saljaAggTitle}`);
}
if (saljaAggDescription !== saljaAggSeo.description) {
  throw new Error("/salja-agg meta description matchar inte useSeo");
}
if (saljaAggOgTitle !== saljaAggSeo.title || saljaAggOgDescription !== saljaAggSeo.description) {
  throw new Error("/salja-agg og-taggar matchar inte useSeo");
}
if (saljaAggTwitterTitle !== saljaAggSeo.title || saljaAggTwitterDescription !== saljaAggSeo.description) {
  throw new Error("/salja-agg twitter-taggar matchar inte useSeo");
}
if (saljaAggJsonLd["@type"] !== "WebPage") {
  throw new Error(`/salja-agg JSON-LD måste vara WebPage, fick ${saljaAggJsonLd["@type"]}`);
}
if (saljaAggJsonLd.name !== saljaAggSeo.title || saljaAggJsonLd.description !== saljaAggSeo.description) {
  throw new Error("/salja-agg WebPage JSON-LD name/description matchar inte useSeo");
}
if (/regler|priser/i.test(saljaAggTitle) || /regler|prissättning|priser/i.test(saljaAggDescription)) {
  throw new Error("/salja-agg first-byte SEO leder med regler/priser");
}

const reglerFile = "dist/guider/salja-agg-regler/index.html";
if (!existsSync(reglerFile)) throw new Error(`SEO-build saknar ${reglerFile}`);
const reglerHtml = readFileSync(reglerFile, "utf8");
const reglerH1s = extractH1Texts(reglerHtml);
const reglerTitle = extractTitle(reglerHtml);
if (reglerTitle !== "Sälja ägg från egna höns – reglerna i klartext (2026)") {
  throw new Error(`/guider/salja-agg-regler title ändrades: ${reglerTitle}`);
}
if (reglerH1s.length !== 1) {
  throw new Error(`/guider/salja-agg-regler first-byte har ${reglerH1s.length} H1: ${reglerH1s.join(" | ") || "ingen"}`);
}
if (reglerH1s[0] !== "Sälja ägg från egna höns – reglerna i klartext") {
  throw new Error(`/guider/salja-agg-regler H1 ändrades: ${reglerH1s[0]}`);
}
if (reglerH1s.includes("Hönsgården")) {
  throw new Error("/guider/salja-agg-regler har leftover generic H1 «Hönsgården»");
}
if (!/"@type"\s*:\s*"FAQPage"/.test(reglerHtml)) {
  throw new Error("/guider/salja-agg-regler saknar FAQPage");
}

console.log(`SEO-build verifierad: / + /demo + /salja-agg + /guider/salja-agg-regler + ${articles.length} artiklar + ${topicPages.length} topic-sidor`);
