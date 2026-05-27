import React from 'react';

export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  return React.lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || '');
      const isChunkError = /Failed to fetch dynamically imported module|Loading chunk|ChunkLoadError|Importing a module script failed|error loading dynamically imported module/i.test(msg);
      const key = 'chunk_reload_attempted_v1';
      const alreadyReloaded = sessionStorage.getItem(key);

      if (isChunkError && !alreadyReloaded) {
        sessionStorage.setItem(key, Date.now().toString());
        window.location.reload();
        // Returnera en aldrig-resolvad promise så Suspense fortsätter visa
        // fallback tills reloaden faktiskt sker
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}
