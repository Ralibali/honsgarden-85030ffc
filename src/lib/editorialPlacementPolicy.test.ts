import { describe, expect, it } from 'vitest';
import { allowsAutomaticProductPlacements } from './editorialPlacementPolicy';

describe('controlled editorial product placements', () => {
  it('keeps rotating products out of a guide with reviewed affiliate destinations', () => {
    expect(allowsAutomaticProductPlacements('honsvakt-checklista-overlamning')).toBe(false);
  });
  it('lets a reviewed buying guide opt in to catalog products', () => {
    expect(allowsAutomaticProductPlacements('automatisk-honslucka-jamforelse')).toBe(true);
  });
  it('preserves the existing catalog behavior on other guides', () => {
    expect(allowsAutomaticProductPlacements('foder-till-hons-guide')).toBe(true);
  });
});
