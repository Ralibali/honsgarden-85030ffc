import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { isPwaRegistrationDisabled } from '@/lib/pwaUpdate';

const SW_READY_TIMEOUT_MS = 2500;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: { get_public_key: true },
    });
    if (error) return null;
    return (data as any)?.public_key ?? null;
  } catch {
    return null;
  }
}

async function getReadyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  const existing = await navigator.serviceWorker.getRegistration().catch(() => null);
  if (!existing) return null;

  return Promise.race<ServiceWorkerRegistration | null>([
    navigator.serviceWorker.ready,
    new Promise((resolve) => window.setTimeout(() => resolve(existing), SW_READY_TIMEOUT_MS)),
  ]).catch(() => existing);
}

export function usePushNotifications() {
  const { user } = useAuth();
  const supported = typeof window !== 'undefined'
    && window.isSecureContext
    && !isPwaRegistrationDisabled()
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supported) return;
    getReadyServiceWorker()
      .then((reg) => reg?.pushManager.getSubscription() ?? null)
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, [supported]);

  const enable = useCallback(async () => {
    if (!supported || !user?.id) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
      const reg = await getReadyServiceWorker();
      if (!reg) return false;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidKey = await fetchVapidPublicKey();
        if (!vapidKey) return false;
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      }
      const json = sub.toJSON();
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        endpoint: json.endpoint!,
        p256dh: json.keys?.p256dh!,
        auth: json.keys?.auth!,
        user_agent: navigator.userAgent,
      }, { onConflict: 'endpoint' });
      if (error) throw error;
      setEnabled(true);
      return true;
    } finally { setBusy(false); }
  }, [supported, user?.id]);

  const disable = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await getReadyServiceWorker();
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const ep = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', ep);
      }
      setEnabled(false);
    } finally { setBusy(false); }
  }, [supported]);

  const sendTest = useCallback(async () => {
    await supabase.functions.invoke('send-push', { body: { test: true } });
  }, []);

  return { supported, enabled, busy, enable, disable, sendTest };
}
