// Långform-innehåll för SEO-landningssidor om hönsraser.
// Skrivet i jag-perspektiv av en hönsägare med ~10 års erfarenhet av
// svenska hobbyflockar. Tonen ska vara konkret, ärlig och praktisk –
// inte uppslagsverk. Inga uppfunna siffror; värpsiffror och äggvikter
// är vedertagna riktvärden för raserna, inte unika mätningar.

export interface BreedRow {
  namn: string;
  ursprung: string;
  vikt: string;
  agg_per_ar: string;
  aggfarg: string;
  temperament: string;
  passar: string;
}

export interface ContentSection {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LongformPage {
  slug: string;
  path: string;
  title: string;            // <60 tecken
  description: string;      // 50–160 tecken
  h1: string;
  eyebrow: string;
  intro: string[];          // 2–3 stycken
  toc: string[];            // tankestreck för innehåll
  sections: ContentSection[];
  breedTable?: BreedRow[];
  faq: { q: string; a: string }[];
  relatedLinks: { href: string; label: string }[];
  breedName?: string;       // om satt: koppling till breedLayingRates för värpstat
  canonicalPath?: string;   // om satt: canonical pekar hit istället för path
}

import { breedGuides } from './breedGuides.mjs';
import { BREED_PROFILES, buildBreedPage } from './honsraserBreedProfiles.ts';

const breedPages: Record<string, LongformPage> = Object.fromEntries(
  BREED_PROFILES.map((b) => [b.slug, buildBreedPage(b)]),
);

export const longformPages: Record<string, LongformPage> = {
  ...breedGuides,
  ...breedPages,
};

export const longformSlugs = Object.keys(longformPages);
export const breedLongformSlugs = Object.keys(breedPages);
