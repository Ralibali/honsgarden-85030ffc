import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardV3 from '../DashboardV3';

const state = vi.hoisted(() => ({
  user: { id: 'user', premium_type: 'free', subscription_status: 'free' },
  native: false, standalone: false,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => {} }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/lib/nativePlatform', () => ({ isNativePlatform: () => state.native }));
vi.mock('@/lib/pwaUpdate', () => ({ isStandalonePwa: () => state.standalone }));
vi.mock('@/lib/api', () => ({ api: {} }));
vi.mock('@tanstack/react-query', () => ({ useQuery: ({ queryKey }: { queryKey: string[] }) => ({ data:
  queryKey[0] === 'eggs' ? [{ id: 'egg', count: 5, date: '2026-09-23' }] :
    queryKey[0] === 'hens' ? [{ id: 'hen', name: 'Agda', is_active: true }] : [],
}) }));
vi.mock('@/lib/premiumInsights', () => ({ buildPremiumInsights: () => [{ id: 'best_layer_week' }] }));
vi.mock('@/components/dashboard/QuickEggLogCard', () => ({ default: () => null }));
vi.mock('@/components/dashboard/HenRaceCard', () => ({ default: () => null }));
vi.mock('@/components/dashboard/OnboardingChecklistCard', () => ({ default: () => null }));
vi.mock('@/components/TrialExpiryBanner', () => ({ default: () => null }));
vi.mock('@/components/diary/DiaryCard', () => ({ default: () => null }));
vi.mock('@/components/StreakFlame', () => ({ StreakFlame: () => <div>StreakFlame</div> }));
vi.mock('@/components/Achievements', () => ({ default: () => <div>Achievements</div>, buildAchievements: () => [] }));
vi.mock('@/components/AchievementNudge', () => ({ default: () => <div>AchievementNudge</div> }));
vi.mock('@/components/EggGoalsWidget', () => ({ default: () => <div>EggGoalsWidget</div> }));
vi.mock('@/components/CountUp', () => ({ CountUp: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock('@/components/DailySummaryModal', () => ({ DailySummaryModal: () => <div>DailySummaryModal</div> }));
vi.mock('@/components/dashboard/PremiumInsightsCard', () => ({ default: () => <div>PremiumInsightsCard</div> }));
vi.mock('@/components/SmartUpsellCard', () => ({ default: () => <div>SmartUpsellCard</div> }));
vi.mock('@/components/dashboard/YearReportPromoCard', () => ({ default: () => <div>YearReportPromoCard</div> }));
vi.mock('@/components/InstallAppCard', () => ({ default: () => <div>InstallAppCard</div> }));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-23T12:00:00'));
  state.user = { id: 'user', premium_type: 'free', subscription_status: 'free' };
  state.native = state.standalone = false;
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('DashboardV3 entitlement and environment gates', () => {
  it('shows progress and exactly one free upsell', () => {
    render(<DashboardV3 />);
    for (const text of ['StreakFlame', 'Achievements', 'AchievementNudge', 'EggGoalsWidget', 'DailySummaryModal', 'InstallAppCard', 'SmartUpsellCard']) expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByText('PremiumInsightsCard')).not.toBeInTheDocument();
    expect(screen.queryByText('YearReportPromoCard')).not.toBeInTheDocument();
  });
  it.each([0, 11])('uses only year promo in month %s', (month) => {
    vi.setSystemTime(new Date(2026, month, 23, 12));
    render(<DashboardV3 />);
    expect(screen.getByText('YearReportPromoCard')).toBeInTheDocument();
    expect(screen.queryByText('SmartUpsellCard')).not.toBeInTheDocument();
  });
  it('shows paid insights without either upsell', () => {
    state.user = { id: 'user', premium_type: 'paid', subscription_status: 'premium' };
    render(<DashboardV3 />);
    expect(screen.getByText('PremiumInsightsCard')).toBeInTheDocument();
    expect(screen.queryByText('SmartUpsellCard')).not.toBeInTheDocument();
    expect(screen.queryByText('YearReportPromoCard')).not.toBeInTheDocument();
  });
  it.each(['native', 'standalone'] as const)('hides install in %s', (platform) => {
    state[platform] = true;
    render(<DashboardV3 />);
    expect(screen.queryByText('InstallAppCard')).not.toBeInTheDocument();
  });
  it('keeps demo progress without prompts, summary or install', () => {
    render(<DashboardV3 demo />);
    expect(screen.getByText('EggGoalsWidget')).toBeInTheDocument();
    expect(screen.getByText('Achievements')).toBeInTheDocument();
    for (const text of ['SmartUpsellCard', 'YearReportPromoCard', 'DailySummaryModal', 'InstallAppCard']) expect(screen.queryByText(text)).not.toBeInTheDocument();
  });
});
