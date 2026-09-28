// Native remote push through APNs and FCM HTTP v1.
// Kräver secrets: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY (P8-innehållet).
// Optional: APNS_ENV = "production" | "sandbox" (default: production)
import { googleAccessToken } from '../_shared/googleServiceAccount.ts';
import { deliverApns } from '../_shared/apnsDelivery.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface PushPayload {
  device_token?: string;
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
}

interface RegisteredDevice {
  token: string;
  platform: 'ios' | 'android';
  user_id: string;
  updated_at: string;
  device_info: Record<string, unknown> | null;
}

function base64UrlEncode(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

let cachedJwt: { token: string; expiresAt: number } | null = null;

async function getApnsJwt(keyId: string, teamId: string, privateKeyPem: string) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.expiresAt > now + 60) return cachedJwt.token;

  const header = { alg: 'ES256', kid: keyId };
  const claims = { iss: teamId, iat: now };
  const encoded = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(claims))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(encoded),
  );
  const token = `${encoded}.${base64UrlEncode(sig)}`;
  // APNs tillåter max 60 min. Vi cachar 50 min.
  cachedJwt = { token, expiresAt: now + 50 * 60 };
  return token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const isService = authHeader === `Bearer ${serviceKey}`;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = isService ? { data: { user: null } } : await userClient.auth.getUser();
    if (!isService && !userRes.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as PushPayload;
    if (typeof payload?.title !== 'string' || typeof payload?.body !== 'string' || !payload.title || !payload.body || payload.title.length > 200 || payload.body.length > 2000) {
      return new Response(JSON.stringify({ error: 'title and body required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // SECURITY: Never trust client-supplied user_id/user_ids. Only admins may
    // target other users; regular callers can only push to their own devices.
    const { data: isAdmin } = isService ? { data: true } : await admin.rpc('has_role', {
      _user_id: userRes.user!.id,
      _role: 'admin',
    });

    const requested = payload.user_ids ?? (payload.user_id ? [payload.user_id] : null);
    const targetIds = isAdmin && requested && requested.length > 0
      ? requested.slice(0, 200)
      : userRes.user ? [userRes.user.id] : [];
    if (!targetIds.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Revoked/expired sessions and legacy unbound registrations receive nothing.
    const { data: tokens, error: tokErr } = await admin.rpc('active_native_push_tokens', {
      p_user_ids: targetIds,
      p_token: typeof payload.device_token === 'string' ? payload.device_token : null,
    });
    if (tokErr) throw tokErr;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: 'no registered devices' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyId = Deno.env.get('APNS_KEY_ID');
    const teamId = Deno.env.get('APNS_TEAM_ID');
    const bundleId = Deno.env.get('APNS_BUNDLE_ID');
    const privateKey = Deno.env.get('APNS_PRIVATE_KEY');
    const env = Deno.env.get('APNS_ENV') ?? 'production';
    const apnsPayload = JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: payload.sound ?? 'default',
        badge: payload.badge,
      },
      data: payload.data ?? {},
      url: typeof payload.data?.url === 'string' ? payload.data.url : '/app',
    });

    let fcmAuthorization: ReturnType<typeof googleAccessToken> | undefined;
    let apnsAuthorization: Promise<string> | undefined;
    const results = await Promise.allSettled(
      tokens.map(async (t: RegisteredDevice) => {
        if (t.platform === 'android') {
          const credentials = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
          if (!credentials) throw new Error('FCM server configuration missing');
          fcmAuthorization ??= googleAccessToken(credentials, 'https://www.googleapis.com/auth/firebase.messaging');
          const access = await fcmAuthorization;
          const response = await fetch(`https://fcm.googleapis.com/v1/projects/${access.projectId}/messages:send`, {
            method: 'POST', signal: AbortSignal.timeout(15_000),
            headers: { Authorization: `Bearer ${access.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { token: t.token,
              notification: { title: payload.title, body: payload.body },
              data: { url: typeof payload.data?.url === 'string' ? payload.data.url : '/app' },
              android: { priority: 'high', notification: { channel_id: 'honsgarden', sound: 'default' } },
            } }),
          });
          if (!response.ok) {
            const result = await response.json().catch(() => null);
            if (result?.error?.details?.some((detail: { errorCode?: string }) => detail.errorCode === 'UNREGISTERED')) {
              await admin.from('device_tokens').delete().eq('token', t.token).eq('user_id', t.user_id).eq('updated_at', t.updated_at);
            }
            throw new Error(`FCM delivery failed (${response.status})`);
          }
          return true;
        }
        if (t.platform !== 'ios') throw new Error('Unsupported push platform');
        if (!keyId || !teamId || !bundleId || !privateKey) throw new Error('APNs server configuration missing');
        apnsAuthorization ??= getApnsJwt(keyId, teamId, privateKey);
        const jwt = await apnsAuthorization;
        const environment = t.device_info?.apns_environment ?? env;
        if (environment !== 'sandbox' && environment !== 'production') throw new Error('APNs environment invalid');
        const delivery = await deliverApns({ token: t.token, jwt, bundleId, payload: apnsPayload, environment });
        if (!delivery.accepted) {
          if (delivery.expired) {
            await admin.from('device_tokens').delete().eq('token', t.token).eq('user_id', t.user_id).eq('updated_at', t.updated_at);
          }
          throw new Error(`APNs delivery failed (${delivery.status})`);
        }
        if (t.device_info?.apns_environment !== delivery.environment) {
          await admin.from('device_tokens').update({ device_info: { ...t.device_info, apns_environment: delivery.environment } })
            .eq('token', t.token).eq('user_id', t.user_id).eq('updated_at', t.updated_at);
        }
        return true;
      }),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'unknown');

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[send-push-notification] error', e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
