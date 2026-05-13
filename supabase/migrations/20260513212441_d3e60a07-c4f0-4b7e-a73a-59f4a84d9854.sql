
-- 1. Utöka roll-enum (CHECK constraint) till owner/editor/viewer
ALTER TABLE public.farm_members DROP CONSTRAINT IF EXISTS farm_members_role_check;
UPDATE public.farm_members SET role = 'editor' WHERE role = 'member';
ALTER TABLE public.farm_members
  ADD CONSTRAINT farm_members_role_check
  CHECK (role IN ('owner', 'editor', 'viewer'));

-- 2. Ändra default till 'editor' (så nya rader inte hamnar som 'member')
ALTER TABLE public.farm_members ALTER COLUMN role SET DEFAULT 'editor';

-- 3. Helper: kollar callerns roll i den farm där _owner_uid är medlem
CREATE OR REPLACE FUNCTION public.has_farm_role_for_owner(_owner_uid uuid, _required_role text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.farm_members caller
    JOIN public.farm_members owner_m ON owner_m.farm_id = caller.farm_id
    WHERE caller.user_id = auth.uid()
      AND owner_m.user_id = _owner_uid
      AND CASE caller.role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END
        >= CASE _required_role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END
  );
$$;

-- 4. Droppa befintliga ALL-policies på de 8 tabellerna
DROP POLICY IF EXISTS "Users manage farm hens" ON public.hens;
DROP POLICY IF EXISTS "Users manage farm eggs" ON public.egg_logs;
DROP POLICY IF EXISTS "Users manage farm breeding pairs" ON public.breeding_pairs;
DROP POLICY IF EXISTS "Users manage farm hatch sessions" ON public.hatch_sessions;
DROP POLICY IF EXISTS "Users manage farm health events" ON public.health_events;
DROP POLICY IF EXISTS "Users manage farm hen photos" ON public.hen_photos;
DROP POLICY IF EXISTS "Users manage farm inventory" ON public.inventory_items;
DROP POLICY IF EXISTS "Users manage farm inventory tx" ON public.inventory_transactions;

-- 5. hens — owner-only delete
CREATE POLICY "Farm viewers can read hens" ON public.hens
  FOR SELECT USING (public.has_farm_role_for_owner(user_id, 'viewer'));
CREATE POLICY "Farm editors can insert hens" ON public.hens
  FOR INSERT WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm editors can update hens" ON public.hens
  FOR UPDATE USING (public.has_farm_role_for_owner(user_id, 'editor'))
  WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm owners can delete hens" ON public.hens
  FOR DELETE USING (public.has_farm_role_for_owner(user_id, 'owner'));

-- 6. egg_logs
CREATE POLICY "Farm viewers can read egg_logs" ON public.egg_logs
  FOR SELECT USING (public.has_farm_role_for_owner(user_id, 'viewer'));
CREATE POLICY "Farm editors can insert egg_logs" ON public.egg_logs
  FOR INSERT WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm editors can update egg_logs" ON public.egg_logs
  FOR UPDATE USING (public.has_farm_role_for_owner(user_id, 'editor'))
  WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm owners can delete egg_logs" ON public.egg_logs
  FOR DELETE USING (public.has_farm_role_for_owner(user_id, 'owner'));

-- 7. breeding_pairs
CREATE POLICY "Farm viewers can read breeding_pairs" ON public.breeding_pairs
  FOR SELECT USING (public.has_farm_role_for_owner(user_id, 'viewer'));
CREATE POLICY "Farm editors can insert breeding_pairs" ON public.breeding_pairs
  FOR INSERT WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm editors can update breeding_pairs" ON public.breeding_pairs
  FOR UPDATE USING (public.has_farm_role_for_owner(user_id, 'editor'))
  WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm owners can delete breeding_pairs" ON public.breeding_pairs
  FOR DELETE USING (public.has_farm_role_for_owner(user_id, 'owner'));

-- 8. hatch_sessions
CREATE POLICY "Farm viewers can read hatch_sessions" ON public.hatch_sessions
  FOR SELECT USING (public.has_farm_role_for_owner(user_id, 'viewer'));
CREATE POLICY "Farm editors can insert hatch_sessions" ON public.hatch_sessions
  FOR INSERT WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm editors can update hatch_sessions" ON public.hatch_sessions
  FOR UPDATE USING (public.has_farm_role_for_owner(user_id, 'editor'))
  WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm owners can delete hatch_sessions" ON public.hatch_sessions
  FOR DELETE USING (public.has_farm_role_for_owner(user_id, 'owner'));

-- 9. health_events
CREATE POLICY "Farm viewers can read health_events" ON public.health_events
  FOR SELECT USING (public.has_farm_role_for_owner(user_id, 'viewer'));
CREATE POLICY "Farm editors can insert health_events" ON public.health_events
  FOR INSERT WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm editors can update health_events" ON public.health_events
  FOR UPDATE USING (public.has_farm_role_for_owner(user_id, 'editor'))
  WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm owners can delete health_events" ON public.health_events
  FOR DELETE USING (public.has_farm_role_for_owner(user_id, 'owner'));

-- 10. inventory_items
CREATE POLICY "Farm viewers can read inventory_items" ON public.inventory_items
  FOR SELECT USING (public.has_farm_role_for_owner(user_id, 'viewer'));
CREATE POLICY "Farm editors can insert inventory_items" ON public.inventory_items
  FOR INSERT WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm editors can update inventory_items" ON public.inventory_items
  FOR UPDATE USING (public.has_farm_role_for_owner(user_id, 'editor'))
  WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm owners can delete inventory_items" ON public.inventory_items
  FOR DELETE USING (public.has_farm_role_for_owner(user_id, 'owner'));

-- 11. hen_photos — editor får radera egna, owner allt
CREATE POLICY "Farm viewers can read hen_photos" ON public.hen_photos
  FOR SELECT USING (public.has_farm_role_for_owner(user_id, 'viewer'));
CREATE POLICY "Farm editors can insert hen_photos" ON public.hen_photos
  FOR INSERT WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm editors can update hen_photos" ON public.hen_photos
  FOR UPDATE USING (public.has_farm_role_for_owner(user_id, 'editor'))
  WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm members can delete hen_photos" ON public.hen_photos
  FOR DELETE USING (
    (public.has_farm_role_for_owner(user_id, 'editor') AND user_id = auth.uid())
    OR public.has_farm_role_for_owner(user_id, 'owner')
  );

-- 12. inventory_transactions — editor får radera egna, owner allt
CREATE POLICY "Farm viewers can read inventory_transactions" ON public.inventory_transactions
  FOR SELECT USING (public.has_farm_role_for_owner(user_id, 'viewer'));
CREATE POLICY "Farm editors can insert inventory_transactions" ON public.inventory_transactions
  FOR INSERT WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm editors can update inventory_transactions" ON public.inventory_transactions
  FOR UPDATE USING (public.has_farm_role_for_owner(user_id, 'editor'))
  WITH CHECK (public.has_farm_role_for_owner(user_id, 'editor'));
CREATE POLICY "Farm members can delete inventory_transactions" ON public.inventory_transactions
  FOR DELETE USING (
    (public.has_farm_role_for_owner(user_id, 'editor') AND user_id = auth.uid())
    OR public.has_farm_role_for_owner(user_id, 'owner')
  );
