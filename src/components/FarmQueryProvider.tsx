import React from 'react';
import { QueryCache, QueryClient, QueryClientProvider, defaultShouldDehydrateQuery } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

type Props = { accountId?: string; children: React.ReactNode };

export default function FarmQueryProvider(props: Props) {
  return <AccountCache key={props.accountId ?? 'public'} {...props} />;
}

const PERSISTED_KEYS = new Set(['eggs', 'hens', 'flocks']);
const FARM_QUERIES = ['eggs', 'hens', 'flocks', 'transactions', 'feed-records', 'stats-summary',
  'feed-stats-for-statistics', 'stats-insights', 'hens-with-eggs', 'flock-statistics', 'breeding-values'];

function AccountCache({ accountId, children }: Props) {
  const [client] = React.useState(() => {
    const client = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          const key = String(query.queryKey[0]);
          if (FARM_QUERIES.includes(key)) {
            void import('@/lib/errorLogger').then(({ logClientError }) =>
              logClientError(error, { context: { source: 'farm-query', query: key } }));
          }
        },
      }),
      defaultOptions: {
        queries: { staleTime: 60_000, refetchOnWindowFocus: false, retry: 1, gcTime: 86_400_000 },
      },
    });
    // Let bounded farm reads report an offline error when there is no cached data.
    for (const key of FARM_QUERIES) client.setQueryDefaults([key], { networkMode: 'always', retry: false });
    return client;
  });
  const [persister] = React.useState(() => {
    try {
      localStorage.removeItem('honsgarden_rq_cache_v1');
      if (accountId) return createSyncStoragePersister({ storage: localStorage, key: `honsgarden_rq_cache_v2:${accountId}` });
    } catch { /* A blocked storage area must not prevent online use. */ }
  });
  if (!persister) return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return (
    <PersistQueryClientProvider client={client} persistOptions={{
      persister, maxAge: 86_400_000,
      dehydrateOptions: { shouldDehydrateQuery: q =>
        defaultShouldDehydrateQuery(q) && PERSISTED_KEYS.has(String(q.queryKey[0])) },
    }}>
      {children}
    </PersistQueryClientProvider>
  );
}
