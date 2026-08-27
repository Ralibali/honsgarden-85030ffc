import React from 'react';
import { isStandalonePwa, recoverStalePwaShell } from '@/lib/pwaUpdate';

// Component props are intentionally preserved through the imported module type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (err: unknown) {
      const msg = String(err instanceof Error ? err.message : '');
      const isChunkError = /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed|error loading dynamically imported module/i.test(msg);

      if (isChunkError) {
        const key = 'chunk_reload_attempted_v1';
        let attempts = 0;
        try {
          attempts = Number(sessionStorage.getItem(key) ?? '0') || 0;
          sessionStorage.setItem(key, String(attempts + 1));
        } catch {
          // sessionStorage kan vara blockerad (privat läge) – fortsätt ändå
        }

        // Första försöket: enkel reload. Andra försöket: rensa caches +
        // avregistrera service worker så en gammal shell inte kan låsa sidan vit.
        if (attempts === 0 && !isStandalonePwa()) {
          window.location.reload();
        } else if (attempts < 3) {
          void recoverStalePwaShell('chunk-load-error');
        } else {
          throw err;
        }

        // Returnera en aldrig-resolvad promise så Suspense fortsätter visa
        // fallback tills reloaden faktiskt sker
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }

  });
}
