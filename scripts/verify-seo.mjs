import { existsSync, readFileSync, readdirSync } from "node:fs";
import { assertTopicPageHtml } from "../src/lib/prerenderTopicPages.mjs";

const required = [
  "dist/index.html",
  "dist/sitemap.xml",
  "dist/blogg/index.html",
  "dist/borja-med-hons/index.html",
  "dist/honsraser-lista/index.html",
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
if (/https:\/\/honsgarden\.se\/(?:login|reset-password|inbjudan)(?:<|\/|\?)/.test(sitemap)) {
  throw new Error("sitemap.xml innehåller robots-blockerad URL");
}

const excluded = new Set(["kategori", "tagg", "bast-honsras-sverige", "foder-till-hons-guide"]);
const articles = readdirSync("dist/blogg", { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !excluded.has(entry.name));
if (articles.length < 5) throw new Error(`För få prerenderade bloggartiklar: ${articles.length}`);

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

console.log(`SEO-build verifierad: ${articles.length} artiklar + ${topicPages.length} topic-sidor`);
