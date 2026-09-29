import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import AffiliateProductStrip from '@/components/affiliate/AffiliateProductStrip';

const state = vi.hoisted(() => ({ tipsEnabled: true, useAffiliateProducts: vi.fn() }));
vi.mock('@/lib/featureFlags', () => ({ AFFILIATE_ENABLED: true }));
vi.mock('@/hooks/useCommerceTipsEnabled', () => ({ useCommerceTipsEnabled: () => state.tipsEnabled }));
vi.mock('@/hooks/useAffiliateProducts', () => ({ useAffiliateProducts: state.useAffiliateProducts }));
vi.mock('@/lib/affiliateTracking', () => ({ trackAffiliateClick: vi.fn() }));
vi.mock('@/hooks/useTracking', () => ({ trackClick: vi.fn() }));

const product = {
  id: 'feeder', name: 'Foderautomat', advertiser: 'bonden', category: 'foder',
  trackingUrl: 'https://example.test/feeder', imageUrl: '/placeholder.svg', price: '199 kr',
};

beforeEach(() => {
  state.useAffiliateProducts.mockReset();
  state.useAffiliateProducts.mockImplementation((enabled: boolean) => ({ data: enabled ? [product] : undefined, isLoading: false }));
});

describe('AffiliateProductStrip commerce tip opt-out', () => {
  it('shows products when the user allows product tips', () => {
    state.tipsEnabled = true;
    render(<AffiliateProductStrip category="foder" title="Foder & tillbehör" />);
    expect(screen.getByText('Foderautomat')).toBeInTheDocument();
    expect(state.useAffiliateProducts).toHaveBeenCalledWith(true);
  });

  it('renders nothing and skips the catalog fetch when the user has opted out', () => {
    state.tipsEnabled = false;
    const { container } = render(<AffiliateProductStrip category="foder" title="Foder & tillbehör" />);
    expect(container).toBeEmptyDOMElement();
    expect(state.useAffiliateProducts).toHaveBeenCalledWith(false);
  });

  it('is not placed on the health page', () => {
    const source = readFileSync(join(process.cwd(), 'src/pages/Health.tsx'), 'utf8');
    expect(source).not.toContain('AffiliateProductStrip');
  });
});
