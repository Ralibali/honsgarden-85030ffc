import { describe, expect, it } from 'vitest';
import { allowsAutomaticProductPlacements, placementPolicy } from './editorialPlacementPolicy';

describe('controlled editorial product placements', () => {
  it('keeps rotating products out of a guide with reviewed affiliate destinations', () => {
    expect(allowsAutomaticProductPlacements('honsvakt-checklista-overlamning')).toBe(false);
  });
  it('lets a reviewed buying guide opt in to catalog products', () => {
    const policy = placementPolicy([{ slug: 'guide' }, { slug: 'kopguide', automatic_product_placements: true }]);
    expect(policy.allowsAutomatic('guide')).toBe(false);
    expect(policy.allowsAutomatic('kopguide')).toBe(true);
    expect(policy.isReviewed('kopguide')).toBe(true);
    expect(policy.allowsAutomatic('annan-artikel')).toBe(true);
  });
  it('preserves the existing catalog behavior on other guides', () => {
    expect(allowsAutomaticProductPlacements('foder-till-hons-guide')).toBe(true);
  });
});
