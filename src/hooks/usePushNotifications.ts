import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

/**
 * Hook för både native push (Capacitor iOS/Android) och web push.
 * - På native: registrerar automatiskt när användaren är inloggad, sparar
 *   APNs/FCM-token i public.device_tokens.
 * - I webbläsare: exponerar enable/disable/sendTest för web push.
 */
export function usePushNotifications() {
  const { user } = useAuth();
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  const webSupported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const supported = isNative || webSupported;

  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  // --- Native (Capacitor) ---
  useEffect(() => {
    if (!isNative || !user?.id) return;
    let removeFns: Array<() => void> = [];
    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const perm = await PushNotifications.checkPermissions();
        let status = perm.receive;
        if (status === 'prompt' || status === 'prompt-with-rationale') {
          const req = await PushNotifications.requestPermissions();
          status = req.receive;
        }
        if (status !== 'granted') {
          setEnabled(false);
          return;
        }
        await PushNotifications.register();
        setEnabled(true);
        const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

        const reg = await PushNotifications.addListener('registration', async (token) => {
          try {
            await supabase.from('device_tokens' as any).upsert({
              user_id: user.id,
              token: token.value,
              platform,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'token' });
          } catch (e) {
            console.error('[push] save token failed', e);
          }
        });
        const err = await PushNotifications.addListener('registrationError', (e) =>
          console.error('[push] registrationError', e),
        );
        const recv = await PushNotifications.addListener('pushNotificationReceived', (n) =>
          console.log('[push] received', n),
        );
        const act = await PushNotifications.addListener('pushNotificationActionPerformed', (a) =>
          console.log('[push] action', a),
        );
        removeFns = [() => reg.remove(), () => err.remove(), () => recv.remove(), () => act.remove()];
      } catch (e) {
        console.error('[push] native setup failed', e);
      }
    })();
    return () => { removeFns.forEach((f) => f()); };
  }, [isNative, user?.id]);

  // --- Web (befintlig serviceworker-flöde) ---
  useEffect(() => {
    if (isNative || !webSupported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});
  }, [isNative, webSupported]);

  const enable = useCallback(async () => {
    if (isNative) {
      // På native försöker vi be om behörighet igen
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const req = await PushNotifications.requestPermissions();
        if (req.receive !== 'granted') return false;
        await PushNotifications.register();
        setEnabled(true);
        return true;
      } catch {
        return false;
      }
    }
    if (!webSupported || !user?.id) return false;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return false;
      const reg = await navigator.serviceWorker.ready;
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
  }, [isNative, webSupported, user?.id]);

  const disable = useCallback(async () => {
    if (isNative) {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        // Ta bort denna enhets tokens
        if (user?.id) {
          await supabase.from('device_tokens' as any).delete().eq('user_id', user.id);
        }
        await PushNotifications.removeAllListeners();
        setEnabled(false);
      } catch {}
      return;
    }
    if (!webSupported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const ep = sub.endpoint;
        await sub.unsubscribe();
        await supabase.from('push_subscriptions').delete().eq('endpoint', ep);
      }
      setEnabled(false);
    } finally { setBusy(false); }
  }, [isNative, webSupported, user?.id]);

  const sendTest = useCallback(async () => {
    if (isNative) {
      await supabase.functions.invoke('send-push-notification', {
        body: { title: 'Testnotis', body: 'Push fungerar 🎉' },
      });
      return;
    }
    await supabase.functions.invoke('send-push', { body: { test: true } });
  }, [isNative]);

  return { supported, enabled, busy, enable, disable, sendTest };
}
