export interface RegulationSection {
  id: string;
  heading: string;
  html: string;
}
export interface RegulationFaq {
  q: string;
  a: string;
}
export interface RegulationLink {
  href: string;
  label: string;
}
export interface RegulationGuide {
  slug: string;
  title: string;
  h1: string;
  metaDescription: string;
  excerpt: string;
  updated: string;
  ogImage: string;
  introHtml: string;
  sections: RegulationSection[];
  faqs: RegulationFaq[];
  relatedLinks: RegulationLink[];
  authorityLinks: RegulationLink[];
}
export const REGULATION_GUIDES: RegulationGuide[];
export function getRegulationGuide(slug: string): RegulationGuide | null;
