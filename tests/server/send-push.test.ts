import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Execute the shipped handler with provider/database boundaries replaced. This
// catches failures before authentication and before native delivery is reached.
const source = ts.transpileModule(readFileSync('supabase/functions/send-push/index.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function setup({ invalidKey = true, signedIn = false } = {}) {
  const env: Record<string, string> = {
    SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'server-key',
    SUPABASE_ANON_KEY: 'anon-key', VAPID_PUBLIC_KEY: 'configured-public', VAPID_PRIVATE_KEY: 'configured-private',
  };
  const webpush = {
    setVapidDetails: vi.fn(() => { if (invalidKey) throw new Error('Invalid VAPID key'); }),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  };
  const invoke = vi.fn().mockResolvedValue({ data: { sent: 2, failed: [] }, error: null });
  const subscriptions = [{ endpoint: 'https://push.example/device', p256dh: 'public', auth: 'secret' }];
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: signedIn ? { id: 'own-user' } : null } }) },
    from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: subscriptions, error: null }) }) }),
    functions: { invoke },
  };
  let handler: (request: Request) => Promise<Response>;
  const log = { error: vi.fn() };
  const mockRequire = (name: string) => {
    if (name === 'npm:web-push@3.6.7') return webpush;
    if (name === 'npm:@supabase/supabase-js@2.57.2') return { createClient: () => client };
    throw new Error(`Unexpected import: ${name}`);
  };
  new Function('require', 'Deno', 'console', 'exports', source)(mockRequire, {
    env: { get: (name: string) => env[name] },
    serve: (fn: typeof handler) => { handler = fn; },
  }, log, {});
  const request = (body: unknown, authorization?: string) => handler(new Request('https://example.test/send-push', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    body: JSON.stringify(body),
  }));
  return { request, webpush, invoke, client, log };
}

describe('remote push with invalid website credentials', () => {
  it('refuses an unauthenticated call with 401 without attempting delivery', async () => {
    const { request, webpush, invoke, log } = setup();
    expect((await request({ title: 'Test', body: 'Test' })).status).toBe(401);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(JSON.stringify(log.error.mock.calls)).not.toContain('configured-');
  });
  it('does not advertise an invalid public key to browsers', async () => {
    const { request } = setup();
    const response = await request({ get_public_key: true });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Web push unavailable' });
  });
  it('keeps authenticated scheduled native reminders working independently', async () => {
    const { request, webpush, invoke } = setup();
    const response = await request({ user_ids: ['target-user'], title: 'Reminder', body: 'Eggs', url: '/app' }, 'Bearer server-key');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sent: 2, web_sent: 0, native_sent: 2, native_failed: 0 });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith('send-push-notification', { body: {
      user_ids: ['target-user'], title: 'Reminder', body: 'Eggs', data: { url: '/app' },
    } });
  });
  it('reports unavailable for a signed-in browser test', async () => {
    const { request, invoke } = setup({ signedIn: true });
    expect((await request({ test: true }, 'Bearer user-token')).status).toBe(503);
    expect(invoke).not.toHaveBeenCalled();
  });
  it('preserves valid browser delivery and ignores client-supplied recipients', async () => {
    const { request, webpush, invoke, client } = setup({ invalidKey: false, signedIn: true });
    const response = await request({ test: true, user_ids: ['other-user'] }, 'Bearer user-token');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ sent: 1, web_sent: 1, native_sent: 0 });
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    expect(client.from().select().in).toHaveBeenCalledWith('user_id', ['own-user']);
    expect(invoke).not.toHaveBeenCalled();
  });
});
