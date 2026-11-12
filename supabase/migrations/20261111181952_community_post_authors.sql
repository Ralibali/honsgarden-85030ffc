-- Authors can edit their text and remove their own posts. Pinning is moderation.
alter table public.community_posts enable row level security;
create policy "Authors update their posts" on public.community_posts
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Authors delete their posts" on public.community_posts
  for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.community_post_preserve_moderation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated' and not public.has_role((select auth.uid()), 'admin') then
    if (tg_op = 'INSERT' and new.is_pinned) or
       (tg_op = 'UPDATE' and (new.is_pinned is distinct from old.is_pinned
         or new.user_id is distinct from old.user_id or new.id is distinct from old.id
         or new.created_at is distinct from old.created_at)) then
      raise exception 'Du kan bara ändra innehållet i ditt eget inlägg.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.community_post_preserve_moderation() from public, anon, authenticated;
create trigger protect_community_post_metadata before insert or update on public.community_posts
  for each row execute function public.community_post_preserve_moderation();
