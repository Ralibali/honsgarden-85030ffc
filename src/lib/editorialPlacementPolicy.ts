// Controlled original guides contain their individually reviewed product links.
// Rotating catalog suggestions must not add unreviewed recommendations to them.
const articles = import.meta.glob<{ slug: string }>('/content/editorial/articles/*.json', {
  eager: true,
  import: 'default',
});
const reviewedSlugs = new Set(Object.values(articles).map(article => article.slug));

export function allowsAutomaticProductPlacements(slug: string): boolean {
  return !reviewedSlugs.has(slug);
}
