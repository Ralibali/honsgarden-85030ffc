import { describe, expect, it } from 'vitest';
import { allowsAutomaticProductPlacements } from './editorialPlacementPolicy';

describe('controlled editorial product placements', () => {
  it('keeps rotating products out of a guide with reviewed affiliate destinations', () => {
    expect(allowsAutomaticProductPlacements('honsvakt-checklista-overlamning')).toBe(false);
  });
  it('preserves the existing catalog behavior on other guides', () => {
    expect(allowsAutomaticProductPlacements('foder-till-hons-guide')).toBe(true);
  });
});
