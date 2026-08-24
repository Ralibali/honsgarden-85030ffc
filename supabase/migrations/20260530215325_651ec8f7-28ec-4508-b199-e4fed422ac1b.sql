create or replace function public.get_flock_benchmark()
returns table (
  user_eggs_per_hen numeric,
  national_avg_eggs_per_hen numeric,
  sample_flocks integer,
  user_percentile integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_window_start date := current_date - interval '30 days';
begin
  return query
  with active_hen_counts as (
    select user_id, count(*)::numeric as hens
    from hens
    where is_active = true and coalesce(hen_type,'hen') <> 'rooster'
    group by user_id
  ),
  egg_sums as (
    select user_id, sum(count)::numeric as eggs
    from egg_logs
    where date >= v_window_start
    group by user_id
  ),
  per_flock as (
    select e.user_id,
           (e.eggs / nullif(a.hens,0) / 30.0) as eggs_per_hen
    from egg_sums e
    join active_hen_counts a on a.user_id = e.user_id
    where a.hens > 0
  )
  select
    (select round(eggs_per_hen, 2) from per_flock where user_id = v_uid),
    round(avg(eggs_per_hen), 2),
    count(*)::int,
    (
      select round(100.0 * (count(*) filter (where pf2.eggs_per_hen <= me.eggs_per_hen))
                   / nullif(count(*),0))::int
      from per_flock pf2,
           (select eggs_per_hen from per_flock where user_id = v_uid) me
    )
  from per_flock;
end;
$$;

grant execute on function public.get_flock_benchmark() to authenticated;