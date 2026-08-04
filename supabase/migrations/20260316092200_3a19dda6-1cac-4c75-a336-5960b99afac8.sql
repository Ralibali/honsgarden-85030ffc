
-- Step 1: Create tables first
CREATE TABLE public.farm_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.coop_settings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(farm_id, user_id)
);
ALTER TABLE public.farm_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.farm_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id uuid NOT NULL REFERENCES public.coop_settings(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
ALTER TABLE public.farm_invitations ENABLE ROW LEVEL SECURITY;

-- Step 2: Helper functions (now farm_members exists)
CREATE OR REPLACE FUNCTION public.get_user_farm_ids(_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT farm_id FROM public.farm_members WHERE user_id = _uid $$;

CREATE OR REPLACE FUNCTION public.get_farm_user_ids(_uid uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid
  UNION
  SELECT fm2.user_id
  FROM public.farm_members fm1
  JOIN public.farm_members fm2 ON fm1.farm_id = fm2.farm_id
  WHERE fm1.user_id = _uid AND fm2.user_id != _uid
$$;

-- Step 3: RLS on farm_members & farm_invitations
CREATE POLICY "Users can view their farm members" ON public.farm_members
  FOR SELECT USING (farm_id IN (SELECT public.get_user_farm_ids(auth.uid())));
CREATE POLICY "Farm owners can delete members" ON public.farm_members
  FOR DELETE USING (
    farm_id IN (SELECT public.get_user_farm_ids(auth.uid()))
    AND (role != 'owner' OR user_id = auth.uid())
  );

CREATE POLICY "Farm members can view invitations" ON public.farm_invitations
  FOR SELECT USING (farm_id IN (SELECT public.get_user_farm_ids(auth.uid())));
CREATE POLICY "Farm owners can insert invitations" ON public.farm_invitations
  FOR INSERT WITH CHECK (invited_by = auth.uid());
CREATE POLICY "Farm owners can update invitations" ON public.farm_invitations
  FOR UPDATE USING (invited_by = auth.uid());

-- Step 4: Trigger for auto-creating owner
CREATE OR REPLACE FUNCTION public.auto_create_farm_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.farm_members (farm_id, user_id, role)
  VALUES (NEW.id, NEW.user_id, 'owner')
  ON CONFLICT (farm_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_coop_settings_created
  AFTER INSERT ON public.coop_settings
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_farm_owner();

-- Step 5: Backfill existing coop_settings
INSERT INTO public.farm_members (farm_id, user_id, role)
SELECT id, user_id, 'owner' FROM public.coop_settings
ON CONFLICT DO NOTHING;

-- Step 6: Update RLS on all shared data tables
DROP POLICY IF EXISTS "Users manage own eggs" ON public.egg_logs;
CREATE POLICY "Users manage farm eggs" ON public.egg_logs FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users manage own hens" ON public.hens;
CREATE POLICY "Users manage farm hens" ON public.hens FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users manage own flocks" ON public.flocks;
CREATE POLICY "Users manage farm flocks" ON public.flocks FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users manage own feed" ON public.feed_records;
CREATE POLICY "Users manage farm feed" ON public.feed_records FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users manage own health logs" ON public.health_logs;
CREATE POLICY "Users manage farm health logs" ON public.health_logs FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users manage own hatchings" ON public.hatchings;
CREATE POLICY "Users manage farm hatchings" ON public.hatchings FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
CREATE POLICY "Users manage farm transactions" ON public.transactions FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users manage own chores" ON public.daily_chores;
CREATE POLICY "Users manage farm chores" ON public.daily_chores FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users manage own completions" ON public.chore_completions;
CREATE POLICY "Users manage farm completions" ON public.chore_completions FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));

DROP POLICY IF EXISTS "Users manage own coop" ON public.coop_settings;
CREATE POLICY "Users manage farm coop" ON public.coop_settings FOR ALL
  USING (user_id IN (SELECT public.get_farm_user_ids(auth.uid())))
  WITH CHECK (user_id IN (SELECT public.get_farm_user_ids(auth.uid())));
