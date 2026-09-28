import { PGlite } from "npm:@electric-sql/pglite@0.5.8";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_setting('request.jwt.claim.role',true) $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(user_id uuid PRIMARY KEY,preferences jsonb DEFAULT '{}',premium_expires_at timestamptz,is_lifetime_premium boolean DEFAULT false,subscription_status text DEFAULT 'free',stripe_customer_id text);
GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role;
GRANT ALL ON public.profiles TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO authenticated,service_role;`,
);
await db.exec(
  await readFile(
    new URL(
      "../migrations/20260928072522_google_play_billing.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const id = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
for (const u of [id, other]) {
  await db.query("INSERT INTO auth.users VALUES ($1)", [u]);
  await db.query("INSERT INTO profiles(user_id) VALUES ($1)", [u]);
}
const future = (n) =>
  new Date(Math.floor(Date.now() / 1000) * 1000 + n * 86400000).toISOString();
const end = future(30),
  appleEnd = future(60),
  stripeEnd = future(90),
  gift = future(120);
let clock = Date.now();
const state = (active = true) => ({
  product_id: "honsgarden_plus",
  base_plan_id: "monthly",
  state: active ? "SUBSCRIPTION_STATE_ACTIVE" : "SUBSCRIPTION_STATE_EXPIRED",
  expires_at: end,
  active,
  acknowledged: true,
  test: false,
  observed_at: new Date(++clock).toISOString(),
});
const role = async (r) =>
  db.exec(
    `RESET ROLE; SET ROLE ${r}; SELECT set_config('request.jwt.claim.role','${r}',false);`,
  );
const google = async (s = state(), u = id) =>
  (await db.query("SELECT apply_google_play_purchase($1,$2,$3) result", [
    u,
    "test-token-123456",
    s,
  ])).rows[0].result;
const profile = async () =>
  (await db.query("SELECT * FROM profiles WHERE user_id=$1", [id])).rows[0];
await role("authenticated");
await assert.rejects(() => google(), /permission denied/);
await assert.rejects(
  () => db.query("SELECT * FROM google_play_purchases"),
  /permission denied/,
);
await db.query("UPDATE profiles SET preferences=$1 WHERE user_id=$2", [{
  theme: "blue",
  google_play: { verified: true, expires_at: end },
}, id]);
assert.deepEqual((await profile()).preferences, { theme: "blue" });
await role("service_role");
const first = state();
assert.equal((await google(first)).subscribed, true);
await assert.rejects(() => google(state(), other), /Purchase account mismatch/);
assert.equal(Date.parse((await profile()).premium_expires_at), Date.parse(end));
await google(state(false));
assert.equal((await profile()).subscription_status, "free");
await google(first);
assert.equal((await profile()).subscription_status, "free");
await google();
const apple = {
  verified: true,
  environment: "Production",
  product_id: "se.honsgarden.plus.monthly",
  original_transaction_id: "orig",
  transaction_id: "t1",
  signed_at: future(-1),
  expires_at: appleEnd,
  revoked_at: null,
};
const applyApple = async (s) =>
  db.query("SELECT apply_apple_iap_entitlement($1,$2)", [id, s]);
await applyApple(apple);
await google(state(false));
assert.equal(
  Date.parse((await profile()).premium_expires_at),
  Date.parse(appleEnd),
);
await applyApple({ ...apple, signed_at: future(1), revoked_at: future(1) });
assert.equal((await profile()).subscription_status, "free");
await google();
await applyApple({ ...apple, transaction_id: "t2", signed_at: future(2) });
const appleRefund = await applyApple({
  ...apple,
  transaction_id: "t2",
  signed_at: future(3),
  revoked_at: future(3),
});
assert.equal(appleRefund.rows[0].apply_apple_iap_entitlement.subscribed, true);
assert.equal(Date.parse((await profile()).premium_expires_at), Date.parse(end));
const stripe = async (active, offset) =>
  db.query("SELECT apply_stripe_plus_status($1,$2,$3,$4,$5)", [
    id,
    "cus_test",
    active,
    stripeEnd,
    future(offset),
  ]);
await stripe(true, 4);
await google(state(false));
assert.equal(
  Date.parse((await profile()).premium_expires_at),
  Date.parse(stripeEnd),
);
await stripe(false, 5);
assert.equal((await profile()).subscription_status, "free");
await google();
await stripe(true, 6);
await stripe(false, 7);
assert.equal(Date.parse((await profile()).premium_expires_at), Date.parse(end));
await applyApple({
  ...apple,
  original_transaction_id: "new-series",
  transaction_id: "t3",
  signed_at: future(8),
  expires_at: end,
});
await google(state(false));
assert.equal(Date.parse((await profile()).premium_expires_at), Date.parse(end));
await applyApple({
  ...apple,
  original_transaction_id: "new-series",
  transaction_id: "t3",
  signed_at: future(9),
  expires_at: end,
  revoked_at: future(9),
});
assert.equal((await profile()).subscription_status, "free");
await db.query("UPDATE profiles SET premium_expires_at=$1 WHERE user_id=$2", [
  gift,
  id,
]);
await google(state(false));
assert.equal(
  Date.parse((await profile()).premium_expires_at),
  Date.parse(gift),
);
await google();
await role("authenticated");
await db.query("UPDATE profiles SET preferences=$1 WHERE user_id=$2", [{
  theme: "red",
  google_play: { verified: true, expires_at: future(999) },
}, id]);
assert.equal(
  Date.parse((await profile()).preferences.google_play.expires_at),
  Date.parse(end),
);
assert.equal((await profile()).preferences.theme, "red");
await role("service_role");
await db.query(
  "UPDATE profiles SET is_lifetime_premium=true WHERE user_id=$1",
  [id],
);
await google(state(false));
assert.equal((await profile()).subscription_status, "premium");
assert.equal((await profile()).premium_expires_at, null);
console.log(
  "PASS Google billing: account ownership, RLS, client forgery, stale replay, refund, Apple/Stripe overlap in both directions, gifts, lifetime and preference preservation",
);
await db.close();
