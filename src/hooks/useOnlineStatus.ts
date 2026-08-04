import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { syncQueue, getQueueLength, loadQueue } from '@/lib/offlineQueue';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export function useOnlineStatus() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState<number>(() => getQueueLength());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = () => setPendingCount(getQueueLength());
    // Ensure the IDB-backed queue is loaded before reading its length.
    void loadQueue().then(refresh);

    const onOnline = () => {
      setIsOnline(true);
      void runSync();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('storage', refresh);
    window.addEventListener('honsgarden:queue-changed', refresh);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('honsgarden:queue-changed', refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSync = async () => {
    if (!isAuthenticated || typeof navigator === 'undefined' || !navigator.onLine) return;
    await loadQueue();
    if (getQueueLength() === 0) return;
    setSyncing(true);
    try {
      const { synced } = await syncQueue(api.createEggRecord);
      if (synced > 0) {
        await queryClient.invalidateQueries({ queryKey: ['eggs'] });
        await queryClient.invalidateQueries({ queryKey: ['streak'] });
      }
    } catch (err) {
      console.error('queue sync failed', err);
    } finally {
      setSyncing(false);
      setPendingCount(getQueueLength());
    }
  };

  // Initial sync on mount (if authed + online)
  useEffect(() => {
    if (isAuthenticated && isOnline) {
      void runSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return { isOnline, pendingCount, syncing };
}
