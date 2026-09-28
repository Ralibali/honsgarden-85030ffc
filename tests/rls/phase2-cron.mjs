// deno run --no-config --allow-read --allow-env tests/rls/phase2-cron.mjs
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE || 'npm:@electric-sql/pglite@0.5.8');
const db = new PGlite();
await db.exec(`CREATE SCHEMA cron; CREATE TABLE cron.job(jobid bigint GENERATED ALWAYS AS IDENTITY, jobname text, schedule text, command text);
CREATE FUNCTION cron.unschedule(id bigint) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN DELETE FROM cron.job WHERE jobid=id; RETURN FOUND; END; $$;
CREATE FUNCTION cron.schedule(name text, schedule text, command text) RETURNS bigint LANGUAGE plpgsql AS $$ DECLARE id bigint; BEGIN INSERT INTO cron.job(jobname,schedule,command) VALUES(name,schedule,command) RETURNING jobid INTO id; RETURN id; END; $$;`);
const dir=new URL('../../supabase/migrations/',import.meta.url);
const file=(await readdir(dir)).find(f=>f.endsWith('_phase2_cron_auth.sql'));
const sql=await readFile(new URL(file,dir),'utf8');
await db.exec(sql); await db.exec(sql);
const { rows }=await db.query('SELECT * FROM cron.job');
assert.equal(rows.length,4);
for(const row of rows){
 assert.match(row.command,/'x-cron-secret'/);
 assert.match(row.command,/vault\.decrypted_secrets WHERE name = 'CRON_SECRET'/);
 assert.doesNotMatch(row.command,/apikey|Authorization|Bearer|eyJ/);
}
await db.close();
console.log('PASS phase 2: four rerunnable schedules, all credentials read from Vault');
