begin;
create table if not exists public.unified_accounts (
 id uuid primary key default gen_random_uuid(),
 hens_user_id uuid not null unique references auth.users(id) on delete cascade,
 garden_user_id uuid not null unique,
 stripe_customer_id text unique,
 stripe_subscription_id text unique,
 bundle_status text not null default 'none',
 active_until timestamptz,
 verified_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.unified_account_tickets (
 token_hash text primary key,
 source_app text not null check(source_app in ('hens','garden')),
 source_user_id uuid not null,
 kind text not null check(kind in ('link','login')),
 expires_at timestamptz not null default now()+interval '5 minutes',
 created_at timestamptz not null default now(),
 consumed_at timestamptz
);
create index if not exists unified_tickets_source on public.unified_account_tickets(source_app,source_user_id,created_at);
alter table public.unified_accounts enable row level security;
alter table public.unified_account_tickets enable row level security;
revoke all on public.unified_accounts,public.unified_account_tickets from public,anon,authenticated;
grant all on public.unified_accounts,public.unified_account_tickets to service_role;
create or replace function public.mint_unified_ticket(p_app text,p_user uuid,p_kind text) returns text
language plpgsql security definer set search_path='' as $$ declare token text;begin
 if p_app not in ('hens','garden') or p_kind not in ('link','login') or p_user is null then raise exception 'Ogiltig förfrågan';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_app||p_user::text,0));
 if (select count(*) from public.unified_account_tickets where source_app=p_app and source_user_id=p_user and created_at>now()-interval '1 hour')>=15 then raise exception 'Försök senare';end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 insert into public.unified_account_tickets(token_hash,source_app,source_user_id,kind) values(encode(sha256(convert_to(token,'UTF8')),'hex'),p_app,p_user,p_kind);
 return token;
end;$$;
create or replace function public.consume_unified_ticket(p_token text,p_app text,p_kind text,p_user uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$ declare t public.unified_account_tickets; account public.unified_accounts; h uuid;g uuid;begin
 if length(p_token)<>64 or p_app not in ('hens','garden') then raise exception 'Ogiltig länk';end if;
 select * into t from public.unified_account_tickets where token_hash=encode(sha256(convert_to(p_token,'UTF8')),'hex') for update;
 if not found or t.consumed_at is not null or t.expires_at<=now() or t.kind<>p_kind or t.source_app=p_app then raise exception 'Länken är ogiltig eller har gått ut';end if;
 if p_kind='link' then
  if p_user is null then raise exception 'Logga in först';end if;
  h:=case when p_app='hens' then p_user else t.source_user_id end;g:=case when p_app='garden' then p_user else t.source_user_id end;
  select * into account from public.unified_accounts where hens_user_id=h and garden_user_id=g;
  if not found then insert into public.unified_accounts(hens_user_id,garden_user_id) values(h,g) returning * into account;end if;
 else
  select * into account from public.unified_accounts where case when t.source_app='hens' then hens_user_id=t.source_user_id else garden_user_id=t.source_user_id end;
  if not found then raise exception 'Koppla kontona först';end if;
 end if;
 update public.unified_account_tickets set consumed_at=now() where token_hash=t.token_hash;
 return jsonb_build_object('account_id',account.id,'target_user_id',case when p_app='hens' then account.hens_user_id else account.garden_user_id end,'source_user_id',t.source_user_id,'source_app',t.source_app);
end;$$;
revoke all on function public.mint_unified_ticket(text,uuid,text),public.consume_unified_ticket(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.mint_unified_ticket(text,uuid,text),public.consume_unified_ticket(text,text,text,uuid) to service_role;
-- Independent entitlement: never replaces a trial, lifetime or App Store subscription.
create table if not exists public.bundle_entitlements (
 user_id uuid primary key references auth.users(id) on delete cascade,
 active_until timestamptz,
 verified_at timestamptz not null,
 active boolean not null default false
);
alter table public.bundle_entitlements enable row level security;
revoke all on public.bundle_entitlements from public,anon,authenticated;
grant all on public.bundle_entitlements to service_role;
create or replace function public.apply_bundle_entitlement(p_user uuid,p_active boolean,p_until timestamptz,p_observed timestamptz) returns void
language sql security definer set search_path='' as $$
 insert into public.bundle_entitlements(user_id,active,active_until,verified_at) values(p_user,p_active,p_until,p_observed)
 on conflict(user_id) do update set active=excluded.active,active_until=excluded.active_until,verified_at=excluded.verified_at
 where excluded.verified_at>=public.bundle_entitlements.verified_at;
$$;
revoke all on function public.apply_bundle_entitlement(uuid,boolean,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_bundle_entitlement(uuid,boolean,timestamptz,timestamptz) to service_role;
commit;
