import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deliverApns } from '../../../supabase/functions/_shared/apnsDelivery';
const input = { token: 'test-device', jwt: 'test-jwt', bundleId: 'se.honsgarden.app', payload: '{}', environment: 'production' as const };
const response = (status: number, reason?: string) => new Response(reason ? JSON.stringify({ reason }) : null, { status });
// jsdom 20 lacks the timeout helper provided by the Deno server runtime.
beforeAll(() => vi.stubGlobal('AbortSignal', { timeout: () => new AbortController().signal }));
afterAll(() => vi.unstubAllGlobals());

describe('APNs delivery environments', () => {
  it('uses production first for a store build', async () => {
    const request = vi.fn().mockResolvedValue(response(200));
    expect(await deliverApns(input, request)).toEqual({ accepted: true, environment: 'production' });
    expect(request.mock.calls[0][0]).toContain('https://api.push.apple.com/');
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('learns the sandbox host only after the explicit wrong-token error', async () => {
    const request = vi.fn().mockResolvedValueOnce(response(400, 'BadDeviceToken')).mockResolvedValueOnce(response(200));
    expect(await deliverApns(input, request)).toEqual({ accepted: true, environment: 'sandbox' });
    expect(request.mock.calls[1][0]).toContain('https://api.sandbox.push.apple.com/');
  });
  it.each([403, 429, 500])('does not send again after status %s', async status => {
    const request = vi.fn().mockResolvedValue(response(status, 'ProviderError'));
    expect(await deliverApns(input, request)).toEqual({ accepted: false, expired: false, status });
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('prunes an explicitly expired token but keeps a token that might have the wrong environment', async () => {
    expect(await deliverApns(input, vi.fn().mockResolvedValue(response(410, 'Unregistered'))))
      .toEqual({ accepted: false, expired: true, status: 410 });
    expect(await deliverApns(input, vi.fn().mockResolvedValue(response(400, 'BadDeviceToken'))))
      .toEqual({ accepted: false, expired: false, status: 400 });
  });
});
