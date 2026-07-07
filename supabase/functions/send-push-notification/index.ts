// Skickar native push till iOS-enheter via APNs (HTTP/2 JWT).
// Kräver secrets: APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY (P8-innehållet).
// Optional: APNS_ENV = "production" | "sandbox" (default: production)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface PushPayload {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
  sound?: string;
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

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload = (await req.json()) as PushPayload;
    if (!payload?.title || !payload?.body) {
      return new Response(JSON.stringify({ error: 'title and body required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const targetIds = payload.user_ids ?? (payload.user_id ? [payload.user_id] : [userRes.user.id]);

    const { data: tokens, error: tokErr } = await admin
      .from('device_tokens')
      .select('token, platform')
      .in('user_id', targetIds)
      .eq('platform', 'ios');
    if (tokErr) throw tokErr;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: 'no iOS tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keyId = Deno.env.get('APNS_KEY_ID');
    const teamId = Deno.env.get('APNS_TEAM_ID');
    const bundleId = Deno.env.get('APNS_BUNDLE_ID');
    const privateKey = Deno.env.get('APNS_PRIVATE_KEY');
    const env = Deno.env.get('APNS_ENV') ?? 'production';
    if (!keyId || !teamId || !bundleId || !privateKey) {
      return new Response(
        JSON.stringify({
          error:
            'APNS-secrets saknas (APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY)',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const jwt = await getApnsJwt(keyId, teamId, privateKey);
    const host =
      env === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';

    const apnsPayload = JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: payload.sound ?? 'default',
        badge: payload.badge,
      },
      data: payload.data ?? {},
    });

    const results = await Promise.allSettled(
      tokens.map(async (t) => {
        const res = await fetch(`https://${host}/3/device/${t.token}`, {
          method: 'POST',
          headers: {
            authorization: `bearer ${jwt}`,
            'apns-topic': bundleId,
            'apns-push-type': 'alert',
            'content-type': 'application/json',
          },
          body: apnsPayload,
        });
        if (!res.ok) {
          const txt = await res.text();
          // Ogiltiga tokens (410 / BadDeviceToken) städas bort
          if (res.status === 410 || txt.includes('BadDeviceToken')) {
            await admin.from('device_tokens').delete().eq('token', t.token);
          }
          throw new Error(`APNs ${res.status}: ${txt}`);
        }
        return t.token;
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
