import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { PremiumCheckoutError, startPremiumCheckout } from '@/lib/premiumCheckout';

const mockInvoke = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    auth: { refreshSession: (...args: unknown[]) => mockRefreshSession(...args) },
  },
}));

function httpFailure(status: number, body: unknown) {
  const response = new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
  return { data: null, error: new FunctionsHttpError(response) };
}

describe('Plus checkout authentication recovery', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    mockRefreshSession.mockReset().mockResolvedValue({
      data: { session: { access_token: 'refreshed-access-token' } }, error: null,
    });
  });

  it('preserves message-only gateway error bodies and safe status/code metadata', async () => {
    const failure = httpFailure(500, { code: 'BOOT_ERROR', message: 'Checkout backend unavailable' });
    mockInvoke.mockResolvedValue(failure);

    const error = await startPremiumCheckout('monthly').catch((error: unknown) => error);

    expect(error).toBeInstanceOf(PremiumCheckoutError);
    expect(error).toMatchObject({ message: 'Checkout backend unavailable', status: 500, code: 'BOOT_ERROR' });
    expect(error).not.toHaveProperty('context');
    expect(error).not.toHaveProperty('cause');
    expect(await failure.error.context.json()).toEqual({ code: 'BOOT_ERROR', message: 'Checkout backend unavailable' });
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it.each([503, 504])('shows a temporary-service message for a non-JSON HTTP %i response', async (status) => {
    const rawResponse = '<html>Internal gateway diagnostic: confidential details</html>';
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(rawResponse, {
        status, headers: { 'Content-Type': 'text/html', 'sb-error-code': 'IDLE_TIMEOUT' },
      })),
    });

    const error = await startPremiumCheckout('monthly').catch((error: unknown) => error);

    expect(error).toMatchObject({
      message: `Betalningstjänsten är tillfälligt otillgänglig (HTTP ${status}). Försök igen om en stund.`,
      status, code: 'IDLE_TIMEOUT',
    });
    expect(JSON.stringify(error)).not.toContain(rawResponse);
    expect(error).not.toHaveProperty('context');
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('shows a Swedish HTTP status fallback for a non-JSON checkout failure', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response('unstructured upstream diagnostic', {
        status: 500, headers: { 'sb-error-code': 'BOOT_ERROR' },
      })),
    });

    await expect(startPremiumCheckout('monthly')).rejects.toMatchObject({
      message: 'Betalningen kunde inte startas (HTTP 500). Försök igen.',
      status: 500, code: 'BOOT_ERROR',
    });
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('prefers the JSON error code and discards unstructured diagnostic headers', async () => {
    const response = new Response(JSON.stringify({ code: 'price_unavailable', message: 'Priset saknas.' }), {
      status: 400, headers: { 'sb-error-code': 'BOOT_ERROR' },
    });
    mockInvoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(response) });
    await expect(startPremiumCheckout('monthly')).rejects.toMatchObject({ code: 'price_unavailable' });

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(new Response('', {
        status: 400, headers: { 'sb-error-code': 'raw private diagnostic with spaces' },
      })),
    });
    await expect(startPremiumCheckout('monthly')).rejects.toMatchObject({
      message: 'Betalningen kunde inte startas (HTTP 400). Försök igen.', status: 400, code: undefined,
    });
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
  });

  it('refreshes after a gateway 401 and retries once with the refreshed bearer token', async () => {
    mockInvoke
      .mockResolvedValueOnce(httpFailure(401, { code: 401, message: 'Invalid JWT' }))
      .mockResolvedValueOnce({ data: { url: 'https://checkout.stripe.com/session' }, error: null });

    await expect(startPremiumCheckout('yearly')).resolves.toEqual({ url: 'https://checkout.stripe.com/session' });

    expect(mockRefreshSession).toHaveBeenCalledExactlyOnceWith();
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenNthCalledWith(1, 'create-checkout', { body: { plan: 'yearly' } });
    expect(mockInvoke).toHaveBeenNthCalledWith(2, 'create-checkout', {
      body: { plan: 'yearly' }, headers: { Authorization: 'Bearer refreshed-access-token' },
    });
  });

  it.each([
    { data: { session: null }, error: new Error('Refresh token rejected') },
    { data: { session: null }, error: null },
  ])('asks for login when refresh does not provide a session', async (refreshResult) => {
    mockInvoke.mockResolvedValue(httpFailure(401, { code: 401, message: 'Invalid JWT' }));
    mockRefreshSession.mockResolvedValue(refreshResult);

    await expect(startPremiumCheckout('monthly')).rejects.toMatchObject({
      message: expect.stringContaining('Logga in igen'), status: 401,
    });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('asks for login when the refresh request throws, without retrying checkout', async () => {
    mockInvoke.mockResolvedValue(httpFailure(401, { code: 401, message: 'Invalid JWT' }));
    mockRefreshSession.mockRejectedValue(new Error('Refresh unavailable'));

    await expect(startPremiumCheckout('monthly')).rejects.toThrow('Logga in igen');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('does not loop when the refreshed session also receives a 401', async () => {
    mockInvoke.mockResolvedValue(httpFailure(401, { code: 401, message: 'Invalid JWT' }));

    const error = await startPremiumCheckout('monthly').catch((error: unknown) => error);

    expect(error).toMatchObject({ message: expect.stringContaining('Logga in igen'), status: 401, code: 401 });
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(error)).not.toContain('refreshed-access-token');
  });

  it.each([400, 500])('never refreshes or retries an HTTP %i checkout failure', async (status) => {
    mockInvoke.mockResolvedValue(httpFailure(status, { error: 'price_unavailable', message: 'Priset är inte tillgängligt.' }));

    await expect(startPremiumCheckout('monthly')).rejects.toMatchObject({
      message: 'Priset är inte tillgängligt.', status,
    });
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('never refreshes or retries a network failure', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new FunctionsFetchError(new TypeError('Network failed')) });

    await expect(startPremiumCheckout('monthly')).rejects.toThrow('Failed to send a request to the Edge Function');
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('never treats a relay failure as a refreshable HTTP authentication response', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: new FunctionsRelayError(new Response('', { status: 401 })) });

    await expect(startPremiumCheckout('monthly')).rejects.toThrow('Relay Error invoking the Edge Function');
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it('passes an already subscribed response to the customer portal routing', async () => {
    const data = {
      error: 'already_subscribed', message: 'Du har redan en prenumeration.',
      portal_url: 'https://billing.stripe.com/session', subscription_status: 'active',
    };
    mockInvoke.mockResolvedValue({ data, error: null });

    await expect(startPremiumCheckout('monthly')).resolves.toEqual(data);
    expect(mockRefreshSession).not.toHaveBeenCalled();
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
