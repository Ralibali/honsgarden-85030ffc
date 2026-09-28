// deno run --no-config --allow-read --allow-env tests/rls/phase6-ai-quota.mjs
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || 'npm:@electric-sql/pglite@0.5.8');
const db = new PGlite();
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');`);
const dir=new URL('../../supabase/migrations/',import.meta.url);
const file=(await readdir(dir)).find(f=>f.endsWith('_phase6_ai_limits.sql'));
const sql=await readFile(new URL(file,dir),'utf8');
await db.exec(sql); await db.exec(sql);
const user='00000000-0000-0000-0000-000000000001';
const results=await Promise.all(Array.from({length:110},()=>db.query('SELECT consume_ai_monthly_quota($1) AS allowed',[user])));
assert.equal(results.filter(r=>r.rows[0].allowed).length,100);
assert.equal((await db.query('SELECT request_count FROM ai_monthly_usage')).rows[0].request_count,100);
assert.equal((await db.query("SELECT consume_ai_monthly_quota('00000000-0000-0000-0000-000000000002') AS allowed")).rows[0].allowed,true);
await db.exec("UPDATE ai_monthly_usage SET month_start=month_start-interval '1 month'");
assert.equal((await db.query('SELECT consume_ai_monthly_quota($1) AS allowed',[user])).rows[0].allowed,true);
for(const role of ['anon','authenticated']) {
 assert.equal((await db.query(`SELECT has_function_privilege('${role}','public.consume_ai_monthly_quota(uuid)','EXECUTE') AS allowed`)).rows[0].allowed,false);
 assert.equal((await db.query(`SELECT has_table_privilege('${role}','public.ai_monthly_usage','UPDATE') AS allowed`)).rows[0].allowed,false);
}
await db.close();
console.log('PASS phase 6: atomic 100-call cap, per-user/month isolation and service-only grants');
