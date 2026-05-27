// Prebuild: hämtar den kompletta sitemap-XML:en från edge-funktionen
// (som inkluderar blogginlägg, /salja-agg/:ort, /s/:slug m.m.) och
// skriver den till public/sitemap.xml så att crawlers som hämtar
// https://honsgarden.se/sitemap.xml ser alla rutter.
//
// Faller tillbaka på att lämna befintlig public/sitemap.xml orörd
// om edge-funktionen inte kan nås under build.

import { writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT_REF = "sikbymtrbhrofysgkqsj";
const SITEMAP_URL = `https://${PROJECT_REF}.supabase.co/functions/v1/sitemap`;
const OUT = resolve("public/sitemap.xml");

try {
  const res = await fetch(SITEMAP_URL, { headers: { Accept: "application/xml" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  if (!xml.includes("<urlset")) throw new Error("invalid XML payload");
  writeFileSync(OUT, xml);
  const count = (xml.match(/<url>/g) || []).length;
  console.log(`sitemap.xml written from edge function (${count} entries)`);
} catch (err) {
  console.warn(`[sitemap] kunde inte hämta från edge-funktion: ${err.message}`);
  if (existsSync(OUT)) {
    console.warn(`[sitemap] behåller befintlig ${OUT}`);
  } else {
    console.warn(`[sitemap] ingen befintlig fil att falla tillbaka på`);
  }
}
