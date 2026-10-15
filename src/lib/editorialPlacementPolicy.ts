// Controlled original guides contain their individually reviewed product links.
// Rotating catalog suggestions must not add unreviewed recommendations to them,
// unless the article opts in: a buying guide sets `automatic_product_placements`
// so in-stock catalog products for the product types it discusses are linked.
type EditorialArticle = { slug: string; automatic_product_placements?: boolean };

export function placementPolicy(list: EditorialArticle[]) {
  const reviewed = new Set(list.map(article => article.slug));
  const optedIn = new Set(list.filter(article => article.automatic_product_placements === true).map(article => article.slug));
  return {
    isReviewed: (slug: string) => reviewed.has(slug),
    allowsAutomatic: (slug: string) => !reviewed.has(slug) || optedIn.has(slug),
  };
}

const articles = import.meta.glob<EditorialArticle>('/content/editorial/articles/*.json', {
  eager: true,
  import: 'default',
});
const policy = placementPolicy(Object.values(articles));

export function isReviewedEditorialArticle(slug: string): boolean {
  return policy.isReviewed(slug);
}

export function allowsAutomaticProductPlacements(slug: string): boolean {
  return policy.allowsAutomatic(slug);
}
