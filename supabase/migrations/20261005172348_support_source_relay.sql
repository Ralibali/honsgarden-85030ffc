-- Additive support relay; private mappings and Vault credentials are configured separately.
create extension if not exists pg_net;
create extension if not exists pg_cron with schema pg_catalog;

-- Install only in an explicitly approved source database. Configure the six
-- non-secret mapping fields and a Vault secret separately, never in Git.
-- Source customer writes enqueue locally; network delivery happens after commit.
create schema if not exists support_hub_private;
revoke all on schema support_hub_private from public,anon,authenticated;

create table support_hub_private.sources (
  source_id uuid primary key,
  table_name text not null unique,
  kind text not null check(kind in ('support','feedback','email')),
  label text not null,
  field_map jsonb not null default '{}'::jsonb,
  exclude_demo boolean not null default true,
  token_secret_id uuid,
  enabled boolean not null default false,
  last_heartbeat_at timestamptz,
  heartbeat_request_id bigint,
  last_error text
);
create sequence support_hub_private.event_revision;
create table support_hub_private.outbox (
  source_id uuid not null references support_hub_private.sources(source_id),
  record_id text not null,
  revision bigint not null default nextval('support_hub_private.event_revision'),
  event_id uuid not null default gen_random_uuid(),
  event_type text not null check(event_type in ('upsert','deleted')),
  record jsonb,
  queued_at timestamptz not null default now(),
  request_id bigint,
  requested_at timestamptz,
  delivered_at timestamptz,
  attempts integer not null default 0,
  retry_at timestamptz not null default now(),
  last_error text,
  primary key(source_id,record_id)
);
create index support_hub_pending on support_hub_private.outbox(retry_at) where delivered_at is null;
alter table support_hub_private.sources enable row level security;
alter table support_hub_private.outbox enable row level security;
revoke all on all tables in schema support_hub_private from public,anon,authenticated;
revoke all on all sequences in schema support_hub_private from public,anon,authenticated;

create function support_hub_private.enqueue(p_table text,p_row jsonb,p_deleted boolean default false)
returns void language plpgsql security definer set search_path=pg_catalog,support_hub_private
as $$
declare s support_hub_private.sources%rowtype; item jsonb; field_name text; value text;
begin
  select * into s from support_hub_private.sources where table_name=p_table;
  if not found or p_row->>'id' is null then return; end if;
  if s.exclude_demo and coalesce((p_row->>'is_demo')::boolean,false) then return; end if;
  if not p_deleted then
    item := jsonb_build_object('kind',s.kind,'title',left(coalesce(nullif(p_row->>'subject',''),s.label),200),
      'body',left(coalesce(p_row->>'message',''),20000),'created_at',coalesce(p_row->>'created_at',now()::text));
    for field_name,value in select pairs.key,pairs.value from jsonb_each_text(s.field_map) pairs
    loop
      if field_name in ('requester_name','requester_email','requester_ref','source_status','source_priority','source_reply','updated_at') and p_row->>value is not null then
        item := item || jsonb_build_object(field_name,left(p_row->>value,case field_name when 'requester_name' then 160 when 'requester_email' then 320 when 'requester_ref' then 200 when 'source_status' then 100 when 'source_priority' then 100 when 'source_reply' then 20000 else 80 end));
      end if;
    end loop;
  end if;
  insert into support_hub_private.outbox(source_id,record_id,event_type,record)
    values(s.source_id,p_row->>'id',case when p_deleted then 'deleted' else 'upsert' end,item)
  on conflict(source_id,record_id) do update set
    revision=nextval('support_hub_private.event_revision'),event_id=gen_random_uuid(),
    event_type=excluded.event_type,record=excluded.record,queued_at=now(),
    request_id=null,requested_at=null,delivered_at=null,attempts=0,retry_at=now(),last_error=null;
end $$;

create function support_hub_private.capture()
returns trigger language plpgsql security definer set search_path=pg_catalog,support_hub_private
as $$
begin
  if TG_OP='DELETE' then perform support_hub_private.enqueue(TG_TABLE_NAME,to_jsonb(OLD),true); return OLD; end if;
  perform support_hub_private.enqueue(TG_TABLE_NAME,to_jsonb(NEW),false);
  return NEW;
end $$;

create function support_hub_private.flush()
returns jsonb language plpgsql security definer set search_path=pg_catalog,support_hub_private
as $$
declare s support_hub_private.sources%rowtype; e support_hub_private.outbox%rowtype;
  response record; ack jsonb; secret text; req bigint; pending integer; failed integer; sent integer:=0;
begin
  -- Never overlap cron and an explicit retry; source mutations remain independent.
  if not pg_try_advisory_xact_lock(hashtext('aurora-support-hub-flush')) then return '{"busy":true}'::jsonb; end if;
  for e in select * from support_hub_private.outbox where delivered_at is null and request_id is not null for update skip locked
  loop
    select status_code,content,error_msg,timed_out into response from net._http_response where id=e.request_id;
    if found then
      ack:=null;
      if response.status_code between 200 and 299 and not coalesce(response.timed_out,false) then
        begin
          select a into ack from jsonb_array_elements((response.content::jsonb)->'acknowledged') a
          where a->>'event_id'=e.event_id::text and a->>'record_id'=e.record_id and a->>'revision'=e.revision::text
            and a->>'outcome' in ('created','updated','duplicate','stale') limit 1;
        exception when others then ack:=null; end;
      end if;
      if ack is not null then
        update support_hub_private.outbox set delivered_at=now(),record=null,request_id=null,last_error=null where source_id=e.source_id and record_id=e.record_id and revision=e.revision;
      else
        update support_hub_private.outbox set request_id=null,retry_at=now()+make_interval(secs=>least(3600,60*greatest(1,e.attempts))),last_error='Leveransen kvitterades inte. HTTP '||coalesce(response.status_code::text,'saknas') where source_id=e.source_id and record_id=e.record_id and revision=e.revision;
      end if;
    elsif e.requested_at < now()-interval '2 minutes' then
      update support_hub_private.outbox set request_id=null,retry_at=now()+interval '1 minute',last_error='Ingen kvittens inom två minuter.' where source_id=e.source_id and record_id=e.record_id and revision=e.revision;
    end if;
  end loop;
  for s in select * from support_hub_private.sources where enabled and token_secret_id is not null
  loop
    select decrypted_secret into secret from vault.decrypted_secrets where id=s.token_secret_id;
    if secret is null then update support_hub_private.sources set last_error='Anslutningsnyckel saknas.' where source_id=s.source_id; continue; end if;
    select count(*) filter(where delivered_at is null),count(*) filter(where delivered_at is null and last_error is not null)
      into pending,failed from support_hub_private.outbox where source_id=s.source_id;
    for e in select * from support_hub_private.outbox where source_id=s.source_id and delivered_at is null and request_id is null and retry_at<=now() order by revision limit 25 for update skip locked
    loop
      begin
        select net.http_post(url:='https://cyymcdqkpvcvwjoqxbco.supabase.co/functions/v1/support-ingest',
          headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),
          body:=jsonb_build_object('events',jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('event_id',e.event_id,'record_id',e.record_id,'revision',e.revision::text,'event_type',e.event_type,'record',e.record))),
            'heartbeat',jsonb_build_object('pending_count',pending,'failed_count',failed,'last_error',case when failed>0 then 'Leveranser väntar på nytt försök.' else null end)),timeout_milliseconds:=10000) into req;
        update support_hub_private.outbox set request_id=req,requested_at=now(),attempts=attempts+1 where source_id=e.source_id and record_id=e.record_id and revision=e.revision;
        sent:=sent+1;
      exception when others then
        update support_hub_private.outbox set retry_at=now()+interval '5 minutes',attempts=attempts+1,last_error='Leveransen kunde inte startas.' where source_id=e.source_id and record_id=e.record_id and revision=e.revision;
      end;
    end loop;
    -- Empty sources also prove connectivity; acknowledge heartbeat on the next tick.
    if s.heartbeat_request_id is not null then
      select status_code,content into response from net._http_response where id=s.heartbeat_request_id;
      if found then
        update support_hub_private.sources set last_heartbeat_at=case when response.status_code between 200 and 299 then now() else last_heartbeat_at end,
          last_error=case when response.status_code between 200 and 299 then null else 'Anslutningskontrollen misslyckades.' end,heartbeat_request_id=null where source_id=s.source_id;
      end if;
    end if;
    if s.last_heartbeat_at is null or s.last_heartbeat_at<now()-interval '10 minutes' then
      begin
        select net.http_post(url:='https://cyymcdqkpvcvwjoqxbco.supabase.co/functions/v1/support-ingest',
          headers:=jsonb_build_object('Authorization','Bearer '||secret,'Content-Type','application/json'),
          body:=jsonb_build_object('events','[]'::jsonb,'heartbeat',jsonb_build_object('pending_count',pending,'failed_count',failed,'last_error',case when failed>0 then 'Leveranser väntar på nytt försök.' else null end)),timeout_milliseconds:=10000) into req;
        update support_hub_private.sources set heartbeat_request_id=req where source_id=s.source_id;
      exception when others then update support_hub_private.sources set last_error='Anslutningskontrollen kunde inte startas.' where source_id=s.source_id; end;
    end if;
  end loop;
  -- Delivered queue entries contain no message body and are kept as tombstones.
  return jsonb_build_object('sent',sent);
end $$;
revoke all on all functions in schema support_hub_private from public,anon,authenticated;
-- Configure table-specific AFTER INSERT/UPDATE/DELETE triggers, backfill via
-- enqueue(table_name,to_jsonb(row)), then schedule flush() every minute.
-- Keep source tokens only in Vault. No customer messages are sent by this relay.


create trigger aurora_support_hub_capture after insert or update or delete on public.feedback
for each row execute function support_hub_private.capture();
