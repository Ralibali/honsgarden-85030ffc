// Controlled original guides contain their individually reviewed product links.
// Rotating catalog suggestions must not add unreviewed recommendations to them,
// unless the article opts in: a buying guide sets `automatic_product_placements`
// so in-stock catalog products for the product types it discusses are linked.
const articles = import.meta.glob<{ slug: string; automatic_product_placements?: boolean }>('/content/editorial/articles/*.json', {
  eager: true,
  import: 'default',
});
const reviewedSlugs = new Set(Object.values(articles).map(article => article.slug));
const optedInSlugs = new Set(
  Object.values(articles).filter(article => article.automatic_product_placements === true).map(article => article.slug),
);

export function isReviewedEditorialArticle(slug: string): boolean {
  return reviewedSlugs.has(slug);
}

export function allowsAutomaticProductPlacements(slug: string): boolean {
  return !isReviewedEditorialArticle(slug) || optedInSlugs.has(slug);
}
