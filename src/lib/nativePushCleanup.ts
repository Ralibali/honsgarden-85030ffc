import { isNativePlatform } from '@/lib/nativePlatform';
import { supabase } from '@/integrations/supabase/client';

export const NATIVE_PUSH_SUSPEND = 'honsgarden:native-push-suspend';
const saves = new Set<Promise<unknown>>();

/** Logout waits for registrations already in flight before deleting the device. */
export function trackNativePushSave<T>(operation: Promise<T>): Promise<T> {
  saves.add(operation);
  void operation.finally(() => saves.delete(operation)).catch(() => {});
  return operation;
}

/** Remove this installation only, while the departing user's session is still available. */
export async function detachNativePush(userId: string, currentToken?: string | null): Promise<void> {
  if (!isNativePlatform()) return;
  window.dispatchEvent(new CustomEvent(NATIVE_PUSH_SUSPEND, { detail: { userId } }));
  localStorage.setItem(`honsgarden_push_enabled_${userId}`, 'false');
  let token = currentToken;
  let registrationId: string | null = null;
  try {
    const saved = JSON.parse(localStorage.getItem('honsgarden_native_push') || 'null');
    if (!token && saved?.userId === userId && typeof saved.token === 'string') token = saved.token;
    if (saved?.userId === userId && saved.token === token && typeof saved.registrationId === 'string') registrationId = saved.registrationId;
  } catch { /* No saved registration. */ }

  const { PushNotifications } = await import('@capacitor/push-notifications');
  const results = await Promise.allSettled([
    PushNotifications.unregister(),
    PushNotifications.removeAllDeliveredNotifications(),
    (async () => {
      await Promise.allSettled([...saves]);
      if (token) {
        const deletion = supabase.from('device_tokens').delete().eq('user_id', userId).eq('token', token);
        const { error } = await (registrationId ? deletion.eq('device_info->>registration_id', registrationId)
          : deletion.is('device_info->>registration_id', null));
        if (error) throw new Error('Device deregistration failed');
      }
    })(),
  ]);
  if (results.some(result => result.status === 'rejected')) {
    // Keep the saved record so this installation can retry cleanup.
    throw new Error('Kunde inte avregistrera enheten. Försök igen med internetanslutning.');
  }
  try {
    const saved = JSON.parse(localStorage.getItem('honsgarden_native_push') || 'null');
    if (saved?.userId === userId && (saved.registrationId ?? null) === registrationId) localStorage.removeItem('honsgarden_native_push');
  } catch { /* Do not remove another account's newer registration. */ }
}
