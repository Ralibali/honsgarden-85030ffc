import { describe, expect, it } from 'vitest';
import { buildGrowthIntelligence } from '../growthIntelligence';

describe('growth intelligence', () => {
  it('builds mature D1/D7/D30 retention without penalising immature cohorts', () => {
    const result = buildGrowthIntelligence({
      now: '2026-08-30T12:00:00Z',
      observationStart: '2026-04-01T00:00:00Z',
      profiles: [
        { user_id: 'a', created_at: '2026-07-20T08:00:00Z', subscription_status: 'premium' },
        { user_id: 'b', created_at: '2026-08-10T08:00:00Z', subscription_status: 'free' },
        { user_id: 'c', created_at: '2026-05-01T08:00:00Z', subscription_status: 'free' },
        { user_id: 'd', created_at: '2026-08-28T08:00:00Z', subscription_status: 'free' },
      ],
      hens: [
        { user_id: 'a', created_at: '2026-07-20T09:00:00Z' },
        { user_id: 'b', created_at: '2026-08-10T09:00:00Z' },
        { user_id: 'c', created_at: '2026-05-01T09:00:00Z' },
      ],
      eggLogs: [
        { user_id: 'a', date: '2026-07-20', created_at: '2026-07-20T10:00:00Z' },
        { user_id: 'b', date: '2026-08-12', created_at: '2026-08-12T10:00:00Z' },
        { user_id: 'c', date: '2026-05-03', created_at: '2026-05-03T10:00:00Z' },
      ],
      choreCompletions: [],
      pageViews: [
        { user_id: 'a', path: '/app', created_at: '2026-07-21T09:00:00Z' },
        { user_id: 'a', path: '/app', created_at: '2026-07-27T09:00:00Z' },
        { user_id: 'a', path: '/app', created_at: '2026-08-18T09:00:00Z' },
        { user_id: 'a', path: '/app', created_at: '2026-08-30T09:00:00Z' },
        { user_id: 'b', path: '/app', created_at: '2026-08-11T09:00:00Z' },
        { user_id: 'b', path: '/app', created_at: '2026-08-17T09:00:00Z' },
        { user_id: 'b', path: '/app', created_at: '2026-08-29T09:00:00Z' },
        { user_id: 'c', path: '/app', created_at: '2026-05-02T09:00:00Z' },
        { user_id: 'c', path: '/app', created_at: '2026-05-08T09:00:00Z' },
        { user_id: 'c', path: '/app', created_at: '2026-05-29T09:00:00Z' },
        { user_id: 'c', path: '/app', created_at: '2026-07-01T09:00:00Z' },
        { user_id: 'd', path: '/app', created_at: '2026-08-29T09:00:00Z' },
      ],
    });

    expect(result.retention.d1).toEqual({ eligible: 3, retained: 3, pct: 100 });
    expect(result.retention.d7).toEqual({ eligible: 3, retained: 3, pct: 100 });
    expect(result.retention.d30).toEqual({ eligible: 2, retained: 2, pct: 100 });
    expect(result.summary.active7d).toBe(2);
    expect(result.summary.dormant30dPlus).toBe(1);
    expect(result.summary.neverActivated).toBe(1);
  });

  it('detects material changes only across completed weeks', () => {
    const profiles = Array.from({ length: 8 }, (_, index) => ({
      user_id: `u${index}`,
      created_at: '2026-04-01T08:00:00Z',
      subscription_status: 'free',
    }));

    const result = buildGrowthIntelligence({
      now: '2026-08-30T12:00:00Z',
      observationStart: '2026-04-01T00:00:00Z',
      profiles,
      hens: [],
      eggLogs: [],
      choreCompletions: [],
      pageViews: [
        ...profiles.map((profile) => ({ user_id: profile.user_id, path: '/app', created_at: '2026-08-12T10:00:00Z' })),
        ...profiles.slice(0, 2).map((profile) => ({ user_id: profile.user_id, path: '/app', created_at: '2026-08-19T10:00:00Z' })),
        ...profiles.map((profile) => ({ user_id: profile.user_id, path: '/app', created_at: '2026-08-29T10:00:00Z' })),
      ],
    });

    const activeAnomaly = result.anomalies.find((item) => item.metric === 'activeUsers');
    expect(activeAnomaly).toMatchObject({ before: 8, after: 2, deltaPct: -75, direction: 'down' });
  });

  it('correlates a code marker with pre/post activity but labels it as correlation', () => {
    const profiles = Array.from({ length: 6 }, (_, index) => ({
      user_id: `u${index}`,
      created_at: '2026-04-01T08:00:00Z',
      subscription_status: 'free',
    }));

    const result = buildGrowthIntelligence({
      now: '2026-08-30T12:00:00Z',
      observationStart: '2026-04-01T00:00:00Z',
      profiles,
      hens: [],
      eggLogs: [],
      choreCompletions: [],
      pageViews: [
        ...profiles.slice(0, 4).map((profile) => ({ user_id: profile.user_id, path: '/app', created_at: '2026-07-10T10:00:00Z' })),
        ...profiles.map((profile) => ({ user_id: profile.user_id, path: '/app', created_at: '2026-07-17T10:00:00Z' })),
      ],
      changes: [
        { id: 'abc', label: 'feat: bättre onboarding', occurred_at: '2026-07-15T12:00:00Z', source: 'github' },
      ],
    });

    expect(result.changeCorrelations[0]).toMatchObject({
      status: 'positive',
      activeUsersBefore: 4,
      activeUsersAfter: 6,
      deltaPct: 50,
      confounded: false,
    });
    expect(result.changeCorrelations[0].note).toContain('Korrelation');
  });
});
