import { createContext, createElement, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { pushNotificationPath } from '@/lib/pushNotificationPath';
import { NATIVE_PUSH_SUSPEND, trackNativePushSave } from '@/lib/nativePushCleanup';
import { trackEvent } from '@/lib/analytics';

/**
 * SW -> klient: push-sw.js postar detta meddelande vid notificationclick så
 * att kedjan eligible → prompted → accepted → subscription → click går att
 * mäta även för klick (swarm I, full-chain instrumentering).
 */
const PUSH_CLICK_MESSAGE = 'honsgarden:push-notification-click';

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
 * - På native: registrerar efter användarens aktivering, sparar
 *   APNs/FCM-token i public.device_tokens.
 * - I webbläsare: exponerar enable/disable/sendTest för web push.
 */
function usePushNotificationsController() {
  const { user } = useAuth();
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  const webSupported = typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const supported = isNative || webSupported;

  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const nativeAllowedRef = useRef(false);
  const nativeTokenRef = useRef<string | null>(null);
  const nativeSetupRef = useRef<Promise<void>>(Promise.resolve());
  const nativeRegistrationRef = useRef<((ok: boolean) => void) | null>(null);

  // Native listeners must exist before registration can synchronously return a token.
  useEffect(() => {
    if (!isNative) return;
    setEnabled(false);
    nativeAllowedRef.current = false;
    nativeTokenRef.current = null;
    if (!user?.id) return;
    nativeAllowedRef.current = localStorage.getItem(`honsgarden_push_enabled_${user.id}`) === 'true';
    let cancelled = false;
    const listeners: Array<{ remove: () => Promise<void> }> = [];
    const userId = user.id;
    const suspend = (event: Event) => {
      if ((event as CustomEvent<{ userId: string }>).detail?.userId !== userId) return;
      nativeAllowedRef.current = false;
      nativeRegistrationRef.current?.(false);
      setEnabled(false);
    };
    window.addEventListener(NATIVE_PUSH_SUSPEND, suspend);
    nativeSetupRef.current = (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        const remember = async (listener: Promise<{ remove: () => Promise<void> }>) => {
          const handle = await listener;
          if (cancelled) await handle.remove();
          else listeners.push(handle);
        };
        await remember(PushNotifications.addListener('registration', async ({ value }) => {
          if (cancelled || !nativeAllowedRef.current) return;
          nativeTokenRef.current = value;
          const registrationId = crypto.randomUUID();
          // Persist before starting the request so interrupted logout can retry cleanup.
          localStorage.setItem('honsgarden_native_push', JSON.stringify({ userId, token: value, registrationId }));
          const operation = (async () => {
            const { data, error } = await supabase.rpc('register_native_push', {
              p_token: value, p_platform: Capacitor.getPlatform(), p_registration_id: registrationId,
            });
            if (cancelled || !nativeAllowedRef.current) {
              await supabase.from('device_tokens').delete().eq('user_id', userId).eq('token', value)
                .eq('device_info->>registration_id', registrationId);
              return false;
            }
            if (error || data !== true) throw new Error('Registration failed');
            return true;
          })();
          const saved = await trackNativePushSave(operation).catch(() => false);
          if (cancelled || !nativeAllowedRef.current) return;
          setEnabled(saved);
          if (saved) {
            localStorage.setItem('honsgarden_native_push', JSON.stringify({ userId, token: value, registrationId }));
            localStorage.setItem(`honsgarden_push_enabled_${userId}`, 'true');
          }
          nativeRegistrationRef.current?.(saved);
          if (!saved) console.warn('[push] Registration could not be saved');
        }));
        await remember(PushNotifications.addListener('registrationError', () => {
          if (cancelled) return;
          setEnabled(false);
          nativeRegistrationRef.current?.(false);
          console.warn('[push] Native registration failed');
        }));
        await remember(PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          if (cancelled || !nativeAllowedRef.current) return;
          trackEvent('Notification Clicked', { channel: 'push' });
          const path = pushNotificationPath(action.notification.data?.url ?? action.notification.data?.data?.url);
          if (path) {
            window.history.pushState(null, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }));
        if (cancelled) return;
        if (Capacitor.getPlatform() === 'android') await PushNotifications.createChannel({ id: 'honsgarden', name: 'Hönsgården', importance: 4, visibility: 0, sound: 'default' });
        const permission = await PushNotifications.checkPermissions();
        // The system prompt appears only after the user presses Enable.
        if (!cancelled && permission.receive === 'granted'
          && localStorage.getItem(`honsgarden_push_enabled_${userId}`) === 'true') {
          await PushNotifications.register();
        }
      } catch {
        if (!cancelled) setEnabled(false);
        console.warn('[push] Native setup failed');
      }
    })();
    return () => {
      cancelled = true;
      nativeAllowedRef.current = false;
      window.removeEventListener(NATIVE_PUSH_SUSPEND, suspend);
      nativeRegistrationRef.current?.(false);
      listeners.forEach((listener) => { void listener.remove(); });
    };
  }, [isNative, user?.id]);

  // --- Web (befintlig serviceworker-flöde) ---
  useEffect(() => {
    if (isNative || !webSupported) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setEnabled(!!sub))
      .catch(() => {});

    // Notisklick: SW postar PUSH_CLICK_MESSAGE efter focus/navigate.
    const onMessage = (event: MessageEvent) => {
      if ((event.data as { type?: string } | null)?.type === PUSH_CLICK_MESSAGE) {
        trackEvent('Notification Clicked', { channel: 'push' });
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [isNative, webSupported]);

  const enable = useCallback(async () => {
    trackEvent('Push Prompt Shown', { source: 'dashboard' });
    if (isNative) {
      if (!user?.id) return false;
      setBusy(true);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        await nativeSetupRef.current;
        const req = await PushNotifications.requestPermissions();
        trackEvent('Push Permission Result', { result: req.receive === 'granted' ? 'accepted' : 'denied' });
        if (req.receive !== 'granted') return false;
        nativeAllowedRef.current = true;
        const registered = new Promise<boolean>((resolve) => {
          nativeRegistrationRef.current = resolve;
          timer = setTimeout(() => resolve(false), 15_000);
        });
        await PushNotifications.register();
        const saved = await registered;
        if (saved) trackEvent('Push Subscription Created');
        return saved;
      } catch {
        return false;
      } finally {
        if (timer) clearTimeout(timer);
        nativeRegistrationRef.current = null;
        setBusy(false);
      }
    }
    if (!webSupported || !user?.id) {
      if (!webSupported) trackEvent('Push Permission Result', { result: 'unsupported' });
      return false;
    }
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      trackEvent('Push Permission Result', {
        result: perm === 'granted' ? 'accepted' : perm === 'denied' ? 'denied' : 'dismissed',
      });
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
      trackEvent('Push Subscription Created');
      return true;
    } finally { setBusy(false); }
  }, [isNative, webSupported, user?.id]);

  const disable = useCallback(async () => {
    if (isNative) {
      if (!user?.id) return;
      setBusy(true);
      nativeAllowedRef.current = false;
      localStorage.setItem(`honsgarden_push_enabled_${user.id}`, 'false');
      setEnabled(false);
      try {
        const { detachNativePush } = await import('@/lib/nativePushCleanup');
        await detachNativePush(user.id, nativeTokenRef.current);
        localStorage.setItem(`honsgarden_push_enabled_${user.id}`, 'false');
        nativeTokenRef.current = null;
        setEnabled(false);
      } finally { setBusy(false); }
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
    setBusy(true);
    try {
      if (isNative && !nativeTokenRef.current) throw new Error('Aktivera notiser på den här enheten först.');
      const { data, error } = await supabase.functions.invoke(isNative ? 'send-push-notification' : 'send-push', {
        body: isNative ? { device_token: nativeTokenRef.current, title: 'Testnotis från Hönsgården', body: 'Den här notisen skickades från servern.' } : { test: true },
      });
      if (error || data?.error || !(typeof data?.sent === 'number' && data.sent > 0)) {
        throw new Error('Servern kunde inte lämna över någon notis. Kontrollera inställningarna och försök igen.');
      }
    } finally {
      setBusy(false);
    }
  }, [isNative]);

  return { supported, enabled, busy, enable, disable, sendTest };
}


const PushNotificationsContext = createContext<ReturnType<typeof usePushNotificationsController> | null>(null);

/** One lifecycle for the whole signed-in app, including token rotation and notification taps. */
export function PushNotificationsProvider({ children }: { children: ReactNode }) {
  const value = usePushNotificationsController();
  return createElement(PushNotificationsContext.Provider, { value }, children);
}

export function usePushNotifications() {
  const value = useContext(PushNotificationsContext);
  if (!value) throw new Error('PushNotificationsProvider is required');
  return value;
}
