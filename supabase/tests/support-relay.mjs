import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from 'npm:@electric-sql/pglite@0.5.8';
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated;
    create schema net; create schema vault;
    create table vault.decrypted_secrets(id uuid primary key,decrypted_secret text);
    create table net._http_response(id bigint primary key,status_code int,content text,error_msg text,timed_out boolean);
    create table net.requests(id bigserial primary key,url text,headers jsonb,body jsonb);
    create function net.http_post(url text,body jsonb,headers jsonb,timeout_milliseconds int) returns bigint language sql as
      'insert into net.requests(url,body,headers) values(url,body,headers) returning id';
    create table public.feedback(id uuid primary key,message text,status text,created_at timestamptz default now(),admin_reply text);
    grant insert,update,delete on public.feedback to authenticated;`);
  const migration = await readFile(new URL('../migrations/20261005172348_support_source_relay.sql',import.meta.url),'utf8');
  // pg_net is stubbed above; pg_cron is an installation prerequisite on Supabase.
  await db.exec(migration.replace(/^create extension[^;]+;\s*$/gm, '').replace(/^create trigger aurora_support_hub_capture[\s\S]*?capture\(\);/gm, ''));
  for (const table of ["feedback"]) assert(migration.includes('on public.'+table+'\nfor each row execute function support_hub_private.capture();'));
  const source='00000000-0000-4000-8000-000000000001', secret='00000000-0000-4000-8000-000000000002', id='00000000-0000-4000-8000-000000000003';
  await db.query(`insert into support_hub_private.sources(source_id,table_name,kind,label,field_map,token_secret_id,enabled) values($1,'feedback','feedback','Feedback','{"source_status":"status","source_reply":"admin_reply"}',$2,true)`,[source,secret]);
  await db.query('insert into vault.decrypted_secrets values($1,$2)',[secret,'test-only-token']);
  await db.exec(`create trigger support_relay after insert or update or delete on public.feedback for each row execute function support_hub_private.capture();`);
  await db.query(`insert into public.feedback(id,message,status) values($1,'Private message','new')`,[id]);
  let row=(await db.query('select * from support_hub_private.outbox')).rows[0];
  assert.equal(row.record.body,'Private message');
  assert.equal(row.record.source_status,'new');
  const initialRevision=BigInt(row.revision);
  await db.query(`update public.feedback set message='Changed message' where id=$1`,[id]);
  row=(await db.query('select * from support_hub_private.outbox')).rows[0];
  assert(BigInt(row.revision)>initialRevision);
  assert.equal(row.record.body,'Changed message');
  const beforeCount=(await db.query('select count(*)::int as n from net.requests')).rows[0].n;
  assert.equal(beforeCount,0,'customer write never makes a network request');
  await db.exec('select support_hub_private.flush()');
  row=(await db.query('select * from support_hub_private.outbox')).rows[0];
  assert(row.request_id);
  assert.equal(row.delivered_at,null,'request id is not a delivery acknowledgement');
  await db.query(`insert into net._http_response(id,status_code,content,timed_out) values($1,200,$2,false)`,[row.request_id,JSON.stringify({ok:true,acknowledged:[{event_id:'wrong-event',record_id:id,revision:String(row.revision),outcome:'created'}]})]);
  await db.exec('select support_hub_private.flush()');
  row=(await db.query('select * from support_hub_private.outbox')).rows[0];
  assert.equal(row.delivered_at,null,'unmatched acknowledgement must retry');
  assert(row.last_error);
  await db.exec(`update support_hub_private.outbox set retry_at=now(); select support_hub_private.flush();`);
  row=(await db.query('select * from support_hub_private.outbox')).rows[0];
  await db.query(`insert into net._http_response(id,status_code,content,timed_out) values($1,200,$2,false)`,[row.request_id,JSON.stringify({ok:true,acknowledged:[{event_id:row.event_id,record_id:id,revision:String(row.revision),outcome:'created'}]})]);
  await db.exec('select support_hub_private.flush()');
  row=(await db.query('select * from support_hub_private.outbox')).rows[0];
  assert(row.delivered_at);
  assert.equal(row.record,null,'purge duplicate message body after durable acknowledgement');
  await db.query('delete from public.feedback where id=$1',[id]);
  row=(await db.query('select * from support_hub_private.outbox')).rows[0];
  assert.equal(row.event_type,'deleted'); assert.equal(row.record,null); assert.equal(row.delivered_at,null);
  // Customer roles may write the original table, while the private queue stays unreadable.
  await db.exec('set role authenticated');
  await db.exec("insert into public.feedback(id,message,status) values('00000000-0000-4000-8000-000000000099','Authorized support write','new')");
  await db.exec('reset role');
  assert.equal((await db.query("select count(*)::int as n from support_hub_private.outbox where record_id='00000000-0000-4000-8000-000000000099'")).rows[0].n,1);
  for(const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query('select * from support_hub_private.outbox'),/permission denied/);
    await assert.rejects(db.query('select support_hub_private.flush()'),/permission denied/);
    await db.exec('reset role');
  }
  console.log('Support relay: enqueue/coalescing, acknowledgement, retry, deletion and role denial passed.');
} finally { await db.close(); }
