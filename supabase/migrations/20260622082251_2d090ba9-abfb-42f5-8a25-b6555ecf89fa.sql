-- Agdas bod: Väntelista + abonnemang + notifieringskö (schema)
alter table public.egg_sale_waitlist
  add column if not exists pack_size integer,
  add column if not exists status text not null default 'waiting',
  add column if not exists offer_token uuid,
  add column if not exists offer_expires_at timestamptz,
  add column if not exists offered_packs integer,
  add column if not exists accepted_at timestamptz,
  add column if not exists expired_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists egg_sale_waitlist_offer_token_uidx
  on public.egg_sale_waitlist(offer_token)
  where offer_token is not null;
create index if not exists egg_sale_waitlist_queue_idx
  on public.egg_sale_waitlist(listing_id, status, created_at);

alter table public.egg_sale_subscriptions
  add column if not exists pickup_slot_id uuid references public.egg_sale_pickup_slots(id) on delete set null,
  add column if not exists preferred_weekday integer,
  add column if not exists paused_until date,
  add column if not exists skip_next boolean not null default false,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists last_error text,
  add column if not exists consecutive_failures integer not null default 0;

create index if not exists egg_sale_subscriptions_due_idx
  on public.egg_sale_subscriptions(status, next_run_at)
  where status = 'active';

create table if not exists public.egg_sale_notification_queue (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.public_egg_sale_bookings(id) on delete cascade,
  listing_id uuid references public.public_egg_sale_listings(id) on delete cascade,
  unique_key text not null unique,
  kind text not null,
  destination text,
  data jsonb not null default '{}'::jsonb,
  state text not null default 'pending',
  deliver_after timestamptz not null default now(),
  delivered_at timestamptz,
  attempts integer not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.egg_sale_notification_queue to authenticated;
grant all on public.egg_sale_notification_queue to service_role;

create index if not exists egg_sale_notification_queue_due_idx
  on public.egg_sale_notification_queue(state, deliver_after)
  where state = 'pending';

alter table public.egg_sale_notification_queue enable row level security;

drop policy if exists "seller can view own egg notifications" on public.egg_sale_notification_queue;
create policy "seller can view own egg notifications"
on public.egg_sale_notification_queue for select to authenticated
using (
  exists (
    select 1 from public.public_egg_sale_listings l
    where l.id = egg_sale_notification_queue.listing_id
      and l.user_id = auth.uid()
  )
);

drop policy if exists "service role full access notifications" on public.egg_sale_notification_queue;
create policy "service role full access notifications"
on public.egg_sale_notification_queue for all to service_role
using (true) with check (true);