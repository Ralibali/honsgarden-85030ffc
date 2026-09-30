import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type BillingPlan = 'monthly' | 'yearly';
type ErrorCode = string | number;

export type PremiumCheckoutData = {
  url?: string;
  error?: string;
  message?: string;
  portal_url?: string;
  subscription_status?: string;
};

export class PremiumCheckoutError extends Error {
  readonly status?: number;
  readonly code?: ErrorCode;

  constructor(message: string, status?: number, code?: ErrorCode) {
    super(message);
    this.name = 'PremiumCheckoutError';
    this.status = status;
    this.code = code;
  }
}

const LOGIN_MESSAGE = 'Din inloggning har gått ut. Logga in igen och försök skaffa Plus.';
const FALLBACK_MESSAGE = 'Betalningen kunde inte startas. Försök igen.';

function httpFallback(status: number): string {
  return status === 503 || status === 504
    ? `Betalningstjänsten är tillfälligt otillgänglig (HTTP ${status}). Försök igen om en stund.`
    : `Betalningen kunde inte startas (HTTP ${status}). Försök igen.`;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function normalizeData(body: Record<string, unknown>): PremiumCheckoutData {
  return {
    ...(typeof body.url === 'string' ? { url: body.url } : {}),
    ...(typeof body.error === 'string' ? { error: body.error } : {}),
    ...(typeof body.message === 'string' ? { message: body.message } : {}),
    ...(typeof body.portal_url === 'string' ? { portal_url: body.portal_url } : {}),
    ...(typeof body.subscription_status === 'string' ? { subscription_status: body.subscription_status } : {}),
  };
}

async function decodeResult(result: { data: unknown; error: unknown }) {
  const response = result.error instanceof FunctionsHttpError && result.error.context instanceof Response
    ? result.error.context : null;
  let body = asObject(result.data);
  if (response) {
    try {
      body = asObject(await response.clone().json());
    } catch {
      // Never show a raw gateway response, which may contain HTML or internal details.
    }
  }
  const headerCode = response?.headers.get('sb-error-code');
  const code = typeof body.code === 'string' || typeof body.code === 'number' ? body.code
    : headerCode && /^[A-Z][A-Z0-9_]{0,79}$/.test(headerCode) ? headerCode : undefined;
  return { data: normalizeData(body), error: result.error, status: response?.status, code };
}

/** Recover an expired login once; payment or network failures must never be retried automatically. */
export async function startPremiumCheckout(plan: BillingPlan): Promise<PremiumCheckoutData> {
  let result = await decodeResult(await supabase.functions.invoke('create-checkout', { body: { plan } }));

  if (result.status === 401) {
    let accessToken: string | undefined;
    try {
      const refreshed = await supabase.auth.refreshSession();
      if (!refreshed.error) accessToken = refreshed.data.session?.access_token;
    } catch {
      // A missing or rejected refresh token requires the customer to sign in again.
    }
    if (!accessToken) throw new PremiumCheckoutError(LOGIN_MESSAGE, 401, result.code);

    result = await decodeResult(await supabase.functions.invoke('create-checkout', {
      body: { plan },
      headers: { Authorization: `Bearer ${accessToken}` },
    }));
    if (result.status === 401) throw new PremiumCheckoutError(LOGIN_MESSAGE, 401, result.code);
  }

  if (result.data.error === 'already_subscribed' && result.data.portal_url) return result.data;
  if (result.error || result.data.error) {
    const sdkMessage = asObject(result.error).message;
    const fallback = result.status === undefined
      ? typeof sdkMessage === 'string' ? sdkMessage : FALLBACK_MESSAGE
      : httpFallback(result.status);
    throw new PremiumCheckoutError(
      result.data.message || result.data.error || fallback,
      result.status,
      result.code,
    );
  }
  return result.data;
}
