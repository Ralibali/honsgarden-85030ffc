import { createHash, timingSafeEqual } from 'node:crypto';

function matchesSecret(value: string, expected: string): boolean {
  // Compare fixed-size digests so the comparison does not disclose matching prefixes.
  const actualDigest = createHash('sha256').update(value).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest) && expected.length > 0;
}

/** Only exact server credentials authorize a cron invocation. Never decode JWT claims here. */
export function isCronAuthorized(req: Request): boolean {
  const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.get('Authorization') ?? '')?.[1] ?? '';
  const cronMatches = matchesSecret(req.headers.get('x-cron-secret') ?? '', cronSecret);
  const serviceMatches = matchesSecret(bearer, serviceKey);
  return cronMatches || serviceMatches;
}
