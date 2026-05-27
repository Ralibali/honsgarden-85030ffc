import { lazy, type ComponentType } from "react";
import { forceFreshAppReload } from "@/lib/cacheRefresh";

/**
 * Wrapper kring React.lazy som hanterar fallet då en gammal flik försöker
 * hämta en JS-chunk vars hash inte längre finns efter en deploy.
 *
 * Standard React.lazy + Suspense ger en blank/laddande sida i det läget —
 * vilket var symtomen kunder rapporterade på /app/settings ("laddar kort,
 * sen händer ingenting"). Här gör vi en hård reload en gång per session
 * så användaren får den nya index.html med rätt chunk-hashar.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    const RELOAD_KEY = "honsgarden-chunk-reload";
    try {
      return await factory();
    } catch (err: any) {
      const message: string = err?.message || "";
      const name: string = err?.name || "";
      const isChunkError =
        name === "ChunkLoadError" ||
        /Loading chunk [\d]+ failed/i.test(message) ||
        /Failed to fetch dynamically imported module/i.test(message) ||
        /Importing a module script failed/i.test(message);

      if (isChunkError && typeof window !== "undefined") {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY);
        if (!alreadyReloaded) {
          sessionStorage.setItem(RELOAD_KEY, "1");
          void forceFreshAppReload("chunk-load-error");
          // Returnera en pending promise så Suspense fortsätter visa loader
          // tills reloaden slår igenom.
          return await new Promise<{ default: T }>(() => {});
        }
      }
      throw err;
    }
  });
}
