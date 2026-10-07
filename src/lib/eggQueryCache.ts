import type { QueryClient } from '@tanstack/react-query';

/** Invalidate every view derived from egg logs after a save, correction or sync. */
export function invalidateEggQueries(client: QueryClient) {
  const keys = [
    'eggs', 'streak', 'stats-summary', 'stats-insights', 'hens-with-eggs',
    'flock-statistics', 'feed-stats-for-statistics', 'smart-feed-stats',
    'smart-hens-with-eggs', 'feed-stats',
  ];
  return Promise.all(keys.map(key => client.invalidateQueries({ queryKey: [key] })));
}
