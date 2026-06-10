import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { syncQueue, getQueue } from '@/lib/offlineQueue';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export function useOnlineStatus() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const [pendingCount, setPendingCount] = useState<number>(() => getQueue().length);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const refresh = () => setPendingCount(getQueue().length);
    const onOnline = () => {
      setIsOnline(true);
      void runSync();
    };
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('storage', refresh);
    // Custom event so the same tab can update without storage event
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
    if (getQueue().length === 0) return;
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
      setPendingCount(getQueue().length);
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
