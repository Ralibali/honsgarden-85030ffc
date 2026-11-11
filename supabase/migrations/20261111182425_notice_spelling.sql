-- Repair only the reported phrase. Existing notices keep their id and read status.
update public.notifications
set title = replace(title, 'Kraftiga hälsniningar', 'Kraftiga hälsningar'),
    message = replace(message, 'Kraftiga hälsniningar', 'Kraftiga hälsningar')
where title like '%Kraftiga hälsniningar%' or message like '%Kraftiga hälsniningar%';

create policy "Admins edit published notices" on public.notifications
for update to authenticated using (public.has_role((select auth.uid()), 'admin'))
with check (public.has_role((select auth.uid()), 'admin'));
