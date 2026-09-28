// deno run --no-config --allow-read --allow-env tests/rls/phase1-database.mjs
// Node can use PGLITE_MODULE=/absolute/path/to/pglite/dist/index.js.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || 'npm:@electric-sql/pglite@0.5.8');
const migrationDir = new URL('../../supabase/migrations/', import.meta.url);
const files = (await readdir(migrationDir)).sort();
async function original(name) {
  let definition;
  for (const file of files.filter(f => !f.includes('phase1_'))) {
    const text = await readFile(new URL(file, migrationDir), 'utf8');
    const pattern = new RegExp('CREATE(?: OR REPLACE)? FUNCTION (?:public\\.)?' + name + '\\s*\\(.*?\\bAS\\s+(\\$[\\w]*\\$).*?\\1\\s*;', 'gis');
    for (const match of text.matchAll(pattern)) definition = match[0];
  }
  assert.ok(definition, name);
  return definition;
}
const db = new PGlite();
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
CREATE TABLE user_roles(user_id uuid, role text, UNIQUE(user_id, role));
CREATE FUNCTION public.has_role(_uid uuid, _role text) RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=_uid AND role=_role) $$;
CREATE TABLE profiles(user_id uuid PRIMARY KEY, email text, display_name text, avatar_url text, subscription_status text DEFAULT 'free', premium_expires_at timestamptz, is_lifetime_premium boolean DEFAULT false, stripe_customer_id text, referral_code text, referred_by text, country_code text, language_code text, locale text, timezone text, currency_code text, measurement_system text, temperature_unit text, postal_code text, terms_accepted_at timestamptz);
CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
CREATE TABLE farm_members(farm_id uuid, user_id uuid, role text);
CREATE TABLE referrals(id uuid DEFAULT gen_random_uuid() PRIMARY KEY, referrer_user_id uuid, referred_user_id uuid UNIQUE, rewarded boolean, rewarded_at timestamptz, redeemed_at timestamptz);
CREATE TABLE achievement_rewards(user_id uuid, achievement_id text, granted_days integer DEFAULT 0, UNIQUE(user_id, achievement_id));
GRANT ALL ON public.profiles TO anon, authenticated, service_role;
`);
for (const name of ['get_farm_user_ids', 'get_user_farm_ids', 'get_farm_member_display_names', 'grant_premium_days', 'set_lifetime_premium', 'process_referral', 'grant_referral_reward_for_referred', 'claim_achievement_reward', 'protect_subscription_fields', 'handle_new_user']) await db.exec(await original(name));
await db.exec(await readFile(new URL('phase1-service-stubs.sql', import.meta.url), 'utf8'));
const migration = await readFile(new URL(files.find(f => f.endsWith('_phase1_database_permissions.sql')), migrationDir), 'utf8');
const columns = migration.match(/GRANT SELECT \(([\s\S]*?)\) ON public.public_egg_sale_listings TO authenticated/)[1].split(',').map(c => c.trim());
await db.exec(`CREATE TABLE public_egg_sale_listings(${columns.map(c => c + (c==='id'||c==='user_id' ? ' uuid' : ' text')).join(',')},owner_email text,contact_phone text,manage_token text,submitted_ip text);
GRANT SELECT ON public_egg_sale_listings TO anon, authenticated;
CREATE TRIGGER protect_subscription_fields_trigger BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION protect_subscription_fields();
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
ALTER TABLE farm_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON farm_members TO anon,authenticated;
CREATE POLICY members ON farm_members FOR SELECT USING(farm_id IN(SELECT get_user_farm_ids(auth.uid())));
`);
// Demonstrate the old reward bug under an ordinary JWT.
const owner='11111111-1111-4111-8111-111111111111', member='22222222-2222-4222-8222-222222222222', outsider='33333333-3333-4333-8333-333333333333';
await db.query("INSERT INTO profiles(user_id,referral_code) VALUES($1,'TEST'),($2,'OTHER'),($3,'THIRD')",[owner,member,outsider]);
const login = async (role, id='') => db.exec(`RESET ROLE; SET ROLE ${role}; SELECT set_config('request.jwt.claim.role','${role}',false),set_config('request.jwt.claim.sub','${id}',false);`);
await login('authenticated',owner);
await db.query("SELECT claim_achievement_reward('before', 'bronze')");
assert.equal((await db.query('SELECT subscription_status FROM profiles WHERE user_id=$1',[owner])).rows[0].subscription_status,'free');
await db.exec('RESET ROLE');
await db.exec(migration);
await db.exec(migration); // rerunnable
await db.exec(await readFile(new URL('phase1-privileges.sql', import.meta.url), 'utf8'));
await login('authenticated',owner);
await assert.rejects(()=>db.query('SELECT admin_grant_premium_days($1,7)',[owner]),/forbidden/);
await assert.rejects(()=>db.query('SELECT admin_set_lifetime_premium($1,true)',[owner]),/forbidden/);
await db.query("SELECT claim_achievement_reward('after','silver')");
assert.equal((await db.query('SELECT subscription_status FROM profiles WHERE user_id=$1',[owner])).rows[0].subscription_status,'premium');
const expires=(await db.query('SELECT premium_expires_at FROM profiles WHERE user_id=$1',[owner])).rows[0].premium_expires_at;
await db.query("UPDATE profiles SET premium_expires_at=now()+interval '999 days' WHERE user_id=$1",[owner]);
assert.deepEqual((await db.query('SELECT premium_expires_at FROM profiles WHERE user_id=$1',[owner])).rows[0].premium_expires_at,expires);
assert.notEqual((await db.query("SELECT current_setting('app.trusted_premium_grant',true) flag")).rows[0].flag,'on');
await db.exec('RESET ROLE');
await db.query("INSERT INTO farm_members VALUES($1,$1,'owner'),($1,$2,'editor')",[owner,member]);
await db.query('INSERT INTO public_egg_sale_listings(id,user_id,manage_token) VALUES($1,$1,$2)',[owner,'fixture-token']);
await login('authenticated',owner);
assert.equal((await db.query('SELECT * FROM farm_members')).rows.length,2);
assert.equal((await db.query('SELECT * FROM get_farm_user_ids($1)',[owner])).rows.length,2);
assert.equal((await db.query('SELECT * FROM get_farm_user_ids($1)',[outsider])).rows.length,0);
assert.equal((await db.query('SELECT * FROM get_user_farm_ids($1)',[member])).rows.length,0);
assert.equal((await db.query('SELECT * FROM get_my_listing_private($1)',[owner])).rows[0].manage_token,'fixture-token');
await assert.rejects(()=>db.query('SELECT manage_token FROM public_egg_sale_listings'),/permission denied/);
await login('authenticated',outsider);
await assert.rejects(()=>db.query('SELECT * FROM get_my_listing_private($1)',[owner]),/forbidden/);
await login('anon');
assert.equal((await db.query('SELECT * FROM farm_members')).rows.length,0);
await db.query("UPDATE profiles SET subscription_status='premium',premium_expires_at=now()+interval '7 days' WHERE user_id=$1",[outsider]);
assert.equal((await db.query('SELECT subscription_status FROM profiles WHERE user_id=$1',[outsider])).rows[0].subscription_status,'free');
// Signup metadata works without a session, and first-egg referral rewards persist with JWT.
await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.role','',false),set_config('request.jwt.claim.sub','',false)");
const newId='44444444-4444-4444-8444-444444444444';
await db.query('INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,$2,$3)',[newId,'fixture@example.test',{referral_code:'TEST'}]);
assert.equal((await db.query('SELECT referred_by FROM profiles WHERE user_id=$1',[newId])).rows[0].referred_by,'TEST');
await db.exec(await original('trigger_referral_on_first_egg'));
await db.exec('CREATE TABLE egg_logs(user_id uuid, id uuid DEFAULT gen_random_uuid()); CREATE TRIGGER referral_test AFTER INSERT ON egg_logs FOR EACH ROW EXECUTE FUNCTION trigger_referral_on_first_egg(); GRANT INSERT ON egg_logs TO authenticated;');
await login('authenticated',newId);
await db.query('INSERT INTO egg_logs(user_id) VALUES($1)',[newId]);
await db.exec('RESET ROLE');
assert.equal((await db.query('SELECT rewarded FROM referrals WHERE referred_user_id=$1',[newId])).rows[0].rewarded,true);
assert.ok(new Date((await db.query('SELECT premium_expires_at FROM profiles WHERE user_id=$1',[newId])).rows[0].premium_expires_at).getTime()>Date.now()+30*86400000);
await db.query("INSERT INTO user_roles VALUES($1,'admin')",[owner]);
await login('authenticated',owner);
await db.query('SELECT admin_set_lifetime_premium($1,true)',[member]);
assert.equal((await db.query('SELECT is_lifetime_premium FROM profiles WHERE user_id=$1',[member])).rows[0].is_lifetime_premium,true);
await db.close();
console.log('PASS phase 1: privileges, anon denial, policy scope, caller identity, listing privacy, signup, admin gates and JWT reward persistence');
