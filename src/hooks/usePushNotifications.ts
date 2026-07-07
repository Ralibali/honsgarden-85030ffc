import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Registrerar enheten för native push (iOS/Android) via Capacitor
 * och sparar APNs/FCM-token i public.device_tokens.
 * Ingen effekt i webbläsare eller Lovable-preview.
 */
export function usePushNotifications(userId: string | null | undefined) {
  useEffect(() => {
    if (!userId) return;
    if (!Capacitor.isNativePlatform()) return;

    let cleanup: (() => void) | undefined;

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
          console.warn('[push] permission not granted:', status);
          return;
        }

        await PushNotifications.register();

        const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web';

        const regListener = await PushNotifications.addListener('registration', async (token) => {
          try {
            await supabase.from('device_tokens').upsert(
              {
                user_id: userId,
                token: token.value,
                platform,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'token' },
            );
          } catch (e) {
            console.error('[push] failed to save token', e);
          }
        });

        const errListener = await PushNotifications.addListener('registrationError', (err) => {
          console.error('[push] registrationError', err);
        });

        const recvListener = await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification) => {
            console.log('[push] received', notification);
          },
        );

        const actionListener = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            console.log('[push] action', action);
          },
        );

        cleanup = () => {
          regListener.remove();
          errListener.remove();
          recvListener.remove();
          actionListener.remove();
        };
      } catch (e) {
        console.error('[push] setup failed', e);
      }
    })();

    return () => {
      cleanup?.();
    };
  }, [userId]);
}
