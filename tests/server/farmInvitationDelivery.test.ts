// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, expect, it } from 'vitest';

const farmId = '00000000-0000-4000-8000-000000000001';
const ownerId = '00000000-0000-4000-8000-000000000002';
let db: PGlite;

beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE TABLE public.farm_members(farm_id uuid, user_id uuid, role text);
    CREATE TABLE public.farm_invitations(farm_id uuid, invited_by uuid, email text,
      role text, token text UNIQUE, status text DEFAULT 'pending', expires_at timestamptz DEFAULT now() + interval '7 days');
    CREATE TABLE public.test_mail_queue(id bigint GENERATED ALWAYS AS IDENTITY, payload jsonb);
    CREATE FUNCTION public.enqueue_email(queue_name text, payload jsonb) RETURNS bigint
      LANGUAGE plpgsql AS $$
      DECLARE queue_id bigint;
      BEGIN
        IF payload->>'simulate' = 'error' THEN RAISE EXCEPTION 'Queue unavailable'; END IF;
        IF payload->>'simulate' = 'null' THEN RETURN NULL; END IF;
        INSERT INTO public.test_mail_queue(payload) VALUES (payload) RETURNING id INTO queue_id;
        RETURN queue_id;
      END; $$;
  `);
  await db.query("INSERT INTO public.farm_members VALUES ($1, $2, 'owner')", [farmId, ownerId]);
  await db.exec(await readFile(new URL('../../supabase/migrations/20261125161000_queue_farm_invitation.sql', import.meta.url), 'utf8'));
}, 30000);
afterAll(() => db.close());

function invite(email: string, token: string, simulate?: 'error' | 'null') {
  return db.query<{queue_id: number}>('SELECT public.queue_farm_invitation($1,$2,$3,$4,$5,$6) AS queue_id',
    [farmId, ownerId, email, 'viewer', token, JSON.stringify({ to: email, simulate })]);
}

it.each(['error', 'null'] as const)('rolls back after %s, then queues one invitation on retry', async (failure) => {
  const email = failure + '@example.test';
  await expect(invite(email, failure + '-first', failure)).rejects.toThrow();
  expect((await db.query('SELECT id FROM public.test_mail_queue WHERE payload->>\'to\' = $1', [email])).rows).toHaveLength(0);
  expect((await db.query('SELECT token FROM public.farm_invitations WHERE email = $1', [email])).rows).toHaveLength(0);
  const queued = await invite(email, failure + '-retry');
  expect(Number(queued.rows[0].queue_id)).toBeGreaterThan(0);
  await expect(invite(email, failure + '-duplicate')).rejects.toThrow('active invitation');
  expect((await db.query('SELECT id FROM public.test_mail_queue WHERE payload->>\'to\' = $1', [email])).rows).toHaveLength(1);
  expect((await db.query('SELECT role FROM public.farm_invitations WHERE email = $1', [email])).rows).toEqual([{ role: 'viewer' }]);
});

it('allows a fresh invitation when a legacy pending link has expired', async () => {
  await invite('legacy@example.test', 'old');
  await db.query("UPDATE public.farm_invitations SET expires_at = now() - interval '1 day' WHERE token = 'old'");
  expect(Number((await invite('legacy@example.test', 'replacement')).rows[0].queue_id)).toBeGreaterThan(0);
});

it('exposes the mail queue operation only to the service role', async () => {
  const roles = await db.query<{ rolname: string; permitted: boolean }>(`
    SELECT rolname, has_function_privilege(rolname, 'public.queue_farm_invitation(uuid,uuid,text,text,text,jsonb)', 'EXECUTE') AS permitted
    FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') ORDER BY rolname`);
  expect(roles.rows).toEqual([
    { rolname: 'anon', permitted: false },
    { rolname: 'authenticated', permitted: false },
    { rolname: 'service_role', permitted: true },
  ]);
});
