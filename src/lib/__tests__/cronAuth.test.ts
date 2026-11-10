import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cronRequestAllowed } from '../../../supabase/functions/_shared/cronAuth';

const secrets = { cronSecret: 'cron-secret-value', serviceRoleKey: 'service-role-key-value' };
const headers = (init: Record<string, string>) => new Headers(init);
const b64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
/** En token med rätt projekt-ref och roll men utan giltig signatur. */
const forgedJwt = (role: string) =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'supabase', ref: 'sikbymtrbhrofysgkqsj', role })}.signatur`;

describe('cronRequestAllowed', () => {
  it('släpper in rätt cron-hemlighet och service role-nyckeln', () => {
    expect(cronRequestAllowed(headers({ 'x-cron-secret': 'cron-secret-value' }), secrets)).toBe(true);
    expect(cronRequestAllowed(headers({ authorization: 'Bearer service-role-key-value' }), secrets)).toBe(true);
    expect(cronRequestAllowed(headers({ Authorization: 'bearer  service-role-key-value ' }), secrets)).toBe(true);
  });

  it('nekar projektets publika anon-nyckel och egenskrivna token', () => {
    for (const role of ['anon', 'service_role', 'authenticated']) {
      expect(cronRequestAllowed(headers({ authorization: `Bearer ${forgedJwt(role)}` }), secrets)).toBe(false);
    }
  });

  it('nekar fel, tomma och saknade uppgifter', () => {
    expect(cronRequestAllowed(headers({}), secrets)).toBe(false);
    expect(cronRequestAllowed(headers({ 'x-cron-secret': 'cron-secret-valuX' }), secrets)).toBe(false);
    expect(cronRequestAllowed(headers({ 'x-cron-secret': 'cron-secret-value-och-mer' }), secrets)).toBe(false);
    expect(cronRequestAllowed(headers({ authorization: 'Bearer cron-secret-value' }), secrets)).toBe(false);
    expect(cronRequestAllowed(headers({ 'x-cron-secret': 'service-role-key-value' }), secrets)).toBe(false);
  });

  it('låter aldrig en tom hemlighet i miljön matcha en tom rubrik', () => {
    for (const empty of [{}, { cronSecret: '', serviceRoleKey: '' }, { cronSecret: null, serviceRoleKey: undefined }]) {
      expect(cronRequestAllowed(headers({}), empty)).toBe(false);
      expect(cronRequestAllowed(headers({ 'x-cron-secret': '', authorization: 'Bearer ' }), empty)).toBe(false);
    }
  });
});

describe('funktioner som pg_cron anropar', () => {
  it.each(['premium-expiry-cron', 'subscription-health-check'])(
    '%s litar inte på innehållet i en osignerad JWT',
    (name) => {
      const source = readFileSync(`supabase/functions/${name}/index.ts`, 'utf8');
      expect(source).toContain('cronRequestAllowed(req.headers');
      expect(source).not.toMatch(/atob\(/);
      expect(source).not.toMatch(/role === "anon"/);
    },
  );
});
