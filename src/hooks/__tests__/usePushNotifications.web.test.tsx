import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushNotificationsProvider, usePushNotifications } from '../usePushNotifications';

// Web push i webbläsaren. Appen har ingen cachande service worker, så det
// finns ingen registrering förrän användaren slår på notiser. Tidigare
// väntade hooken på navigator.serviceWorker.ready, som då aldrig löser sig.

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), upsert: vi.fn(), removed: [] as string[] }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  functions: { invoke: mocks.invoke },
  from: () => ({
    upsert: mocks.upsert,
    delete: () => ({ eq: async (_: string, endpoint: string) => { mocks.removed.push(endpoint); return { error: null }; } }),
  }),
} }));

const ENDPOINT = 'https://push.example.test/abc';

function browser(options: { registered?: boolean; registerFails?: boolean } = {}) {
  let subscription: { endpoint: string; toJSON: () => unknown; unsubscribe: () => Promise<boolean> } | null = null;
  const pushManager = {
    getSubscription: vi.fn(async () => subscription),
    subscribe: vi.fn(async () => {
      subscription = {
        endpoint: ENDPOINT,
        toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p256', auth: 'auth' } }),
        unsubscribe: async () => { subscription = null; return true; },
      };
      return subscription;
    }),
  };
  const registration = { active: { scriptURL: 'https://honsgarden.se/push-sw.js', state: 'activated' }, waiting: null, installing: null, pushManager };
  let current: typeof registration | undefined = options.registered ? registration : undefined;

  const serviceWorker = {
    // Löser sig aldrig utan registrering, precis som i en riktig webbläsare.
    get ready() { return current ? Promise.resolve(current) : new Promise(() => {}); },
    getRegistration: vi.fn(async () => current),
    register: vi.fn(async () => {
      if (options.registerFails) throw new Error('SecurityError');
      current = registration;
      return registration;
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('navigator', { serviceWorker, userAgent: 'test-agent' });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { requestPermission: vi.fn(async () => 'granted'), permission: 'default' });
  return { serviceWorker, pushManager };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.removed.length = 0;
  mocks.invoke.mockResolvedValue({ data: { public_key: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U' }, error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const render = () => renderHook(usePushNotifications, { wrapper: PushNotificationsProvider });

describe('web push', () => {
  it('registrerar push-workern, prenumererar och sparar när användaren slår på notiser', async () => {
    const { serviceWorker, pushManager } = browser();
    const { result } = render();
    expect(result.current.supported).toBe(true);
    // Att bara öppna appen registrerar ingenting.
    await waitFor(() => expect(serviceWorker.getRegistration).toHaveBeenCalled());
    expect(serviceWorker.register).not.toHaveBeenCalled();

    let ok = false;
    await act(async () => { ok = await result.current.enable(); });

    expect(ok).toBe(true);
    expect(serviceWorker.register).toHaveBeenCalledWith('/push-sw.js', { scope: '/', updateViaCache: 'none' });
    expect(pushManager.subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'owner', endpoint: ENDPOINT, p256dh: 'p256', auth: 'auth' }),
      { onConflict: 'endpoint' },
    );
    expect(result.current.enabled).toBe(true);
    expect(result.current.busy).toBe(false);
  });

  it('svarar nej och släpper knappen när workern inte går att registrera', async () => {
    const { pushManager } = browser({ registerFails: true });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = render();

    let ok = true;
    await act(async () => { ok = await result.current.enable(); });

    expect(ok).toBe(false);
    expect(pushManager.subscribe).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
    expect(result.current.busy).toBe(false);
    warn.mockRestore();
  });

  it('visar notiser som påslagna när webbläsaren redan har en prenumeration', async () => {
    const { pushManager, serviceWorker } = browser({ registered: true });
    await pushManager.subscribe();
    const { result } = render();
    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it('stänger av utan att hänga, även när ingen worker finns', async () => {
    browser();
    const { result } = render();
    await act(async () => { await result.current.disable(); });
    expect(result.current.enabled).toBe(false);
    expect(result.current.busy).toBe(false);
    expect(mocks.removed).toEqual([]);
  });

  it('säger upp prenumerationen och tar bort raden när användaren stänger av', async () => {
    browser();
    const { result } = render();
    await act(async () => { await result.current.enable(); });
    await act(async () => { await result.current.disable(); });
    expect(mocks.removed).toEqual([ENDPOINT]);
    expect(result.current.enabled).toBe(false);
  });
});
