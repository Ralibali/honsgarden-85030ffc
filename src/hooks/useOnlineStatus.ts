import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  syncQueue,
  getQueueLength,
  loadQueue,
  claimLegacyEntries,
} from "@/lib/offlineQueue";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

export function useOnlineStatus() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" || navigator.onLine
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [legacyCount, setLegacyCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    setPendingCount(userId ? getQueueLength(userId) : 0);
    setLegacyCount(userId ? getQueueLength() : 0);
  }, [userId]);
  const runSync = useCallback(async () => {
    if (!userId || !navigator.onLine) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const { synced, remaining, dropped } = await syncQueue(
        api.createEggRecord,
        userId
      );
      if (synced || dropped)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["eggs"] }),
          queryClient.invalidateQueries({ queryKey: ["streak"] }),
        ]);
      if (dropped)
        setSyncError(
          `${dropped} loggning${dropped === 1 ? "" : "ar"} kunde inte sparas (t.ex. borttagen höna) och togs bort från enheten.`
        );
      else if (remaining)
        setSyncError("Alla poster kunde inte synkas. De är kvar på enheten.");
    } catch {
      setSyncError("Kunde inte läsa eller synka äggloggningarna. Försök igen.");
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [userId, queryClient, refresh]);
  const claimLegacy = useCallback(async () => {
    if (!userId) return;
    try {
      await claimLegacyEntries(userId);
    } catch {
      setSyncError("Kunde inte koppla de äldre loggningarna. Försök igen.");
      return;
    }
    refresh();
    await runSync();
  }, [userId, refresh, runSync]);
  useEffect(() => {
    void loadQueue()
      .then(refresh)
      .catch(() =>
        setSyncError("Kunde inte läsa lokala loggningar. Försök igen.")
      );
    const online = () => {
      setIsOnline(true);
      void runSync();
    };
    const offline = () => setIsOnline(false);
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("honsgarden:queue-changed", refresh);
    void runSync();
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("honsgarden:queue-changed", refresh);
    };
  }, [refresh, runSync]);
  return {
    isOnline,
    pendingCount,
    legacyCount,
    syncing,
    syncError,
    retrySync: runSync,
    claimLegacy,
  };
}
