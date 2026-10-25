# Architecture rules

- Shop search relevance and catalog-derived suggestions live in pure functions in `src/lib/shop/search.ts`; the existing shop page owns filter state so checkout, data loading and pricing remain independent.