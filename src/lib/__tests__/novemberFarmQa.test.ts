// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { placementRates } from '../../../supabase/functions/_shared/affiliateCtr';

describe('affiliate placement rates', () => {
  const exposure = { created_at: '2026-11-01T09:00:00Z', session_id: 's1', path: '/blogg/test',
    slug: 'test', section_title: 'Foder', product_id: 'p1', advertiser: 'merchant', source: 'product_box' };
  it('counts a placement once even with repeated clicks and ignores clicks without a preceding impression', () => {
    const events = [exposure, { ...exposure, session_id: 's2' }];
    const clicks = [exposure, exposure, { ...exposure, session_id: 's2', created_at: '2026-10-31T23:00:00Z' },
      { ...exposure, session_id: 'unseen' }, { ...exposure, section_title: 'Annan sektion' }];
    expect(placementRates(events, clicks, r => r.slug).get('test')).toBe(0.5);
    expect(placementRates([], clicks, r => r.slug).has('test')).toBe(false);
  });
});

it('allows authors to edit and delete their own posts and leaves moderation to admins', async () => {
  const db = new PGlite();
  const owner = '00000000-0000-4000-8000-000000000001';
  const other = '00000000-0000-4000-8000-000000000002';
  try {
    await db.exec(`create role authenticated; create role anon; create schema auth;
      create function auth.uid() returns uuid language sql stable as
        $$select current_setting('request.jwt.claim.sub', true)::uuid$$;
      grant usage on schema auth to authenticated;
      create function public.has_role(uuid, text) returns boolean language sql stable as $$select false$$;
      create table community_posts(id integer primary key, user_id uuid, content text, created_at timestamptz default now(), is_pinned boolean default false);
      insert into community_posts(id,user_id,content) values (1,'${owner}','min'),(2,'${other}','annan');
      grant select, update, insert, delete on community_posts to authenticated;
      create policy read_posts on community_posts for select to authenticated using (true);`);
    await db.exec(await readFile('supabase/migrations/20261111181952_community_post_authors.sql', 'utf8'));
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${owner}'`);
    expect((await db.query("update community_posts set content='ändrad' where id=1 returning content")).rows).toEqual([{content:'ändrad'}]);
    expect((await db.query("update community_posts set content='ändrad' where id=2 returning id")).rows).toEqual([]);
    await expect(db.query('update community_posts set is_pinned=true where id=1')).rejects.toThrow();
    await expect(db.query(`update community_posts set user_id='${other}' where id=1`)).rejects.toThrow();
    expect((await db.query('delete from community_posts where id=2 returning id')).rows).toEqual([]);
    expect((await db.query('delete from community_posts where id=1 returning id')).rows).toEqual([{id:1}]);
  } finally { await db.close(); }
});
