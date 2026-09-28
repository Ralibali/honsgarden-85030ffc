import { isNativePlatform } from '@/lib/nativePlatform';
import { supabase } from '@/integrations/supabase/client';

export const NATIVE_AUTH_REDIRECT = 'se.honsgarden.app://auth/callback';
export const NATIVE_RECOVERY_REDIRECT = 'se.honsgarden.app://auth/recovery';
const RECOVERY_MARKER = 'honsgarden_native_recovery';
let initialization: Promise<void> | undefined;
let exchanging = false;

export function parseNativeAuthCallback(raw: string): { code: string; recovery: boolean } | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'se.honsgarden.app:' || url.hostname !== 'auth' || url.username || url.password
      || url.port || !['/callback', '/recovery'].includes(url.pathname)) return null;
    if (url.searchParams.has('error')) throw new Error('Inloggningen avbröts eller kunde inte slutföras.');
    const codes = url.searchParams.getAll('code');
    if (codes.length !== 1 || !codes[0] || codes[0].length > 2048) return null;
    return { code: codes[0], recovery: url.pathname === '/recovery' };
  } catch (error) {
    if (error instanceof TypeError) return null;
    throw error;
  }
}

export function hasNativeRecoverySession(): boolean {
  if (!isNativePlatform()) return false;
  const started = Number(sessionStorage.getItem(RECOVERY_MARKER));
  return started > 0 && Date.now() - started < 10 * 60_000;
}

export function clearNativeRecoverySession(): void { sessionStorage.removeItem(RECOVERY_MARKER); }

export function initializeNativeAuth(): Promise<void> {
  if (!isNativePlatform()) return Promise.resolve();
  if (initialization) return initialization;
  initialization = (async () => {
    const { App } = await import('@capacitor/app');
    const { Browser } = await import('@capacitor/browser');
    const handleUrl = async (raw: string) => {
      if (exchanging) return;
      try {
        const callback = parseNativeAuthCallback(raw);
        if (!callback) return;
        exchanging = true;
        // Supabase checks the code against the verifier saved inside this app.
        const { data, error } = await supabase.auth.exchangeCodeForSession(callback.code);
        if (error || !data.session) throw new Error('Inloggningen kunde inte bekräftas. Försök igen.');
        if (callback.recovery) sessionStorage.setItem(RECOVERY_MARKER, String(Date.now()));
        await Browser.close().catch(() => {});
        window.history.replaceState(null, '', callback.recovery ? '/reset-password' : '/app');
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch {
        const { toast } = await import('@/hooks/use-toast');
        toast({ title: 'Inloggningen kunde inte slutföras', description: 'Försök igen eller använd e-post.', variant: 'destructive' });
      } finally { exchanging = false; }
    };
    await App.addListener('appUrlOpen', ({ url }) => { void handleUrl(url); });
    const launch = await App.getLaunchUrl();
    if (launch?.url) await handleUrl(launch.url);
  })();
  return initialization;
}

export async function signInWithNativeOAuth(provider: 'google' | 'apple'): Promise<void> {
  await initializeNativeAuth();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider,
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new Error('Inloggningen kunde inte öppnas. Försök igen.');
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: data.url, toolbarColor: '#244C38' });
}
