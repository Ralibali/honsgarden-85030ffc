import { existsSync, readFileSync, readdirSync } from "node:fs";

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

console.log(`SEO-build verifierad: ${articles.length} artiklar`);
