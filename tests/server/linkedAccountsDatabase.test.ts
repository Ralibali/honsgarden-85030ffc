// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { bundleAccess } from "../../supabase/functions/_shared/unifiedBilling";
let db: PGlite;
const h = "00000000-0000-4000-8000-000000000001",
  g = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);insert into auth.users values('${h}'),('${other}');`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../../supabase/migrations/20261007170754_unified_accounts_and_egg_orders.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
}, 30000);
afterAll(() => db?.close());
it("requires service authority, links both verified identities, and prevents ticket replay or remapping", async () => {
  await db.exec("set role authenticated");
  await expect(db.query("select mint_unified_ticket('hens',$1,'link')", [h]))
    .rejects.toThrow();
  await expect(db.query("select * from unified_accounts")).rejects.toThrow();
  await db.exec("reset role;set role service_role");
  const ticket = (await db.query<{ token: string }>(
    "select mint_unified_ticket('hens',$1,'link') token",
    [h],
  )).rows[0].token;
  await expect(
    db.query("select consume_unified_ticket($1,'hens','link',$2)", [ticket, h]),
  ).rejects.toThrow();
  const linked = (await db.query<{ result: { target_user_id: string } }>(
    "select consume_unified_ticket($1,'garden','link',$2) result",
    [ticket, g],
  )).rows[0].result;
  expect(linked.target_user_id).toBe(g);
  await expect(
    db.query("select consume_unified_ticket($1,'garden','link',$2)", [
      ticket,
      g,
    ]),
  ).rejects.toThrow();
  const otherTicket = (await db.query<{ token: string }>(
    "select mint_unified_ticket('hens',$1,'link') token",
    [other],
  )).rows[0].token;
  await expect(
    db.query("select consume_unified_ticket($1,'garden','link',$2)", [
      otherTicket,
      g,
    ]),
  ).rejects.toThrow();
  const login = (await db.query<{ token: string }>(
    "select mint_unified_ticket('garden',$1,'login') token",
    [g],
  )).rows[0].token;
  const target = (await db.query<{ result: { target_user_id: string } }>(
    "select consume_unified_ticket($1,'hens','login') result",
    [login],
  )).rows[0].result;
  expect(target.target_user_id).toBe(h);
  await expect(
    db.query("select consume_unified_ticket($1,'hens','login')", [login]),
  ).rejects.toThrow();
});
it("expired tickets cannot log in and old events cannot restore revoked Plus", async () => {
  const token = (await db.query<{ token: string }>(
    "select mint_unified_ticket('hens',$1,'login') token",
    [h],
  )).rows[0].token;
  await db.exec(
    "update unified_account_tickets set expires_at=now()-interval '1 second'",
  );
  await expect(
    db.query("select consume_unified_ticket($1,'garden','login')", [token]),
  ).rejects.toThrow();
  await db.query(
    "select apply_bundle_entitlement($1,true,'2030-01-01','2026-10-07T10:00:00Z')",
    [h],
  );
  await db.query(
    "select apply_bundle_entitlement($1,false,null,'2026-10-07T11:00:00Z')",
    [h],
  );
  await db.query(
    "select apply_bundle_entitlement($1,true,'2030-01-01','2026-10-07T10:30:00Z')",
    [h],
  );
  expect(
    (await db.query<{ active: boolean }>(
      "select active from bundle_entitlements",
    )).rows[0].active,
  ).toBe(false);
  await db.exec("reset role;set role authenticated");
  await expect(
    db.query("select apply_bundle_entitlement($1,true,'2030-01-01',now())", [
      h,
    ]),
  ).rejects.toThrow();
});
it("grants only the exact bundle price during a paid, active period", () => {
  const sub = {
    status: "active",
    items: {
      data: [{ price: { id: "bundle" }, current_period_end: 2000000000 }],
    },
  };
  expect(bundleAccess(sub, "bundle", 1000000000000).active).toBe(true);
  expect(bundleAccess(sub, undefined, 1000000000000).active).toBe(false);
  expect(bundleAccess(sub, "other", 1000000000000).active).toBe(false);
  expect(
    bundleAccess({ ...sub, status: "past_due" }, "bundle", 1000000000000)
      .active,
  ).toBe(false);
  expect(bundleAccess(sub, "bundle", 2100000000000).active).toBe(false);
});
