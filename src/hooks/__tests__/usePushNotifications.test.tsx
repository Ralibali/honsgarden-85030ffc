import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PushNotificationsProvider, usePushNotifications } from '../usePushNotifications';
import { detachNativePush } from '@/lib/nativePushCleanup';

const mocks = vi.hoisted(() => {
  const listeners: Record<string, (value: any) => unknown> = {};
  return { listeners, rpc: vi.fn(), invoke: vi.fn(), deletion: vi.fn(), filters: [] as unknown[][],
    permission: vi.fn(), register: vi.fn(), unregister: vi.fn(), removeDelivered: vi.fn(), removeListener: vi.fn() };
});
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  rpc: mocks.rpc, functions: { invoke: mocks.invoke },
  from: () => ({ delete: () => {
    mocks.deletion();
    const query = {
      eq: (key: string, value: unknown) => { mocks.filters.push([key, value]); return query; },
      is: (key: string, value: unknown) => { mocks.filters.push([key, value]); return query; },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    };
    return query;
  } }),
} }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: {
  addListener: async (name: string, fn: (value: any) => unknown) => {
    mocks.listeners[name] = fn;
    return { remove: mocks.removeListener };
  },
  checkPermissions: async () => ({ receive: 'granted' }),
  requestPermissions: mocks.permission,
  register: mocks.register,
  unregister: mocks.unregister,
  removeAllDeliveredNotifications: mocks.removeDelivered,
  createChannel: vi.fn(),
} }));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.filters.length = 0;
  Object.keys(mocks.listeners).forEach(key => delete mocks.listeners[key]);
  vi.stubGlobal('crypto', { randomUUID: () => 'registration-1' });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.invoke.mockResolvedValue({ data: { sent: 1 }, error: null });
  mocks.permission.mockResolvedValue({ receive: 'granted' });
  mocks.unregister.mockResolvedValue(undefined);
  mocks.removeDelivered.mockResolvedValue(undefined);
  mocks.register.mockImplementation(async () => {
    expect(mocks.listeners.registration).toBeDefined();
    await mocks.listeners.registration({ value: 'device-token' });
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function setup() {
  const hook = renderHook(usePushNotifications, { wrapper: PushNotificationsProvider });
  await waitFor(() => expect(mocks.listeners.pushNotificationActionPerformed).toBeDefined());
  return hook;
}

describe('native push registration and delivery feedback', () => {
  it('does not request permission or register before the user enables notifications', async () => {
    const { result } = await setup();
    expect(mocks.permission).not.toHaveBeenCalled();
    expect(mocks.register).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
  });

  it('registers listeners first and enables only after server confirmation', async () => {
    const { result } = await setup();
    await act(async () => { expect(await result.current.enable()).toBe(true); });
    expect(mocks.rpc).toHaveBeenCalledWith('register_native_push', {
      p_token: 'device-token', p_platform: 'ios', p_registration_id: 'registration-1',
    });
    expect(result.current.enabled).toBe(true);
  });

  it('reports a failed database registration as disabled', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    const { result } = await setup();
    await act(async () => { expect(await result.current.enable()).toBe(false); });
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem('honsgarden_push_enabled_owner')).not.toBe('true');
  });

  it('does not treat zero accepted notifications as a successful test', async () => {
    const { result } = await setup();
    await act(async () => { await result.current.enable(); });
    mocks.invoke.mockResolvedValue({ data: { sent: 0, failed: ['unconfigured'] }, error: null });
    await act(async () => { await expect(result.current.sendTest()).rejects.toThrow('kunde inte'); });
    expect(mocks.invoke).toHaveBeenCalledWith('send-push-notification', expect.objectContaining({
      body: expect.objectContaining({ device_token: 'device-token' }),
    }));
  });

  it('disables only this device registration and keeps listeners for later enabling', async () => {
    const { result } = await setup();
    await act(async () => { await result.current.enable(); });
    await act(async () => { await result.current.disable(); });
    expect(mocks.filters).toEqual(expect.arrayContaining([
      ['user_id', 'owner'], ['token', 'device-token'], ['device_info->>registration_id', 'registration-1'],
    ]));
    expect(mocks.unregister).toHaveBeenCalledTimes(1);
    expect(mocks.removeListener).not.toHaveBeenCalled();
    expect(result.current.enabled).toBe(false);
    await act(async () => { await result.current.enable(); });
    expect(result.current.enabled).toBe(true);
  });

  it('prevents a registration completing during logout from enabling notifications again', async () => {
    let finishSave!: (result: unknown) => void;
    mocks.rpc.mockImplementation(() => new Promise(resolve => { finishSave = resolve; }));
    const { result } = await setup();
    let enabling!: Promise<boolean>;
    act(() => { enabling = result.current.enable(); });
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalled());
    let detaching!: Promise<void>;
    act(() => { detaching = detachNativePush('owner'); });
    await act(async () => {
      finishSave({ data: true, error: null });
      await detaching;
      expect(await enabling).toBe(false);
    });
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem('honsgarden_push_enabled_owner')).toBe('false');
    expect(localStorage.getItem('honsgarden_native_push')).toBeNull();
    expect(mocks.deletion).toHaveBeenCalled();
  });

  it('removes late listener registrations on unmount', async () => {
    const { unmount } = await setup();
    unmount();
    expect(mocks.removeListener).toHaveBeenCalledTimes(3);
  });
});
