-- Synced SaaS data for egg goals and egg sales

create table if not exists public.egg_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_goal integer not null default 0 check (daily_goal >= 0),
  weekly_goal integer not null default 0 check (weekly_goal >= 0),
  monthly_goal integer not null default 0 check (monthly_goal >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.egg_sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer text not null,
  eggs integer not null check (eggs > 0),
  amount numeric(10,2) not null default 0 check (amount >= 0),
  paid boolean not null default false,
  sale_date date not null default current_date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists egg_sales_user_date_idx on public.egg_sales(user_id, sale_date desc);

alter table public.egg_goals enable row level security;
alter table public.egg_sales enable row level security;

drop policy if exists "Users can read their own egg goals" on public.egg_goals;
create policy "Users can read their own egg goals" on public.egg_goals for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own egg goals" on public.egg_goals;
create policy "Users can insert their own egg goals" on public.egg_goals for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own egg goals" on public.egg_goals;
create policy "Users can update their own egg goals" on public.egg_goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own egg goals" on public.egg_goals;
create policy "Users can delete their own egg goals" on public.egg_goals for delete using (auth.uid() = user_id);

drop policy if exists "Users can read their own egg sales" on public.egg_sales;
create policy "Users can read their own egg sales" on public.egg_sales for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own egg sales" on public.egg_sales;
create policy "Users can insert their own egg sales" on public.egg_sales for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own egg sales" on public.egg_sales;
create policy "Users can update their own egg sales" on public.egg_sales for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own egg sales" on public.egg_sales;
create policy "Users can delete their own egg sales" on public.egg_sales for delete using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_egg_goals_updated_at on public.egg_goals;
create trigger set_egg_goals_updated_at before update on public.egg_goals for each row execute function public.set_updated_at();

drop trigger if exists set_egg_sales_updated_at on public.egg_sales;
create trigger set_egg_sales_updated_at before update on public.egg_sales for each row execute function public.set_updated_at();
