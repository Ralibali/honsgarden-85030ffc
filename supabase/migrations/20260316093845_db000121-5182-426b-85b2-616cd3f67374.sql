
-- Allow farm members to see each other's profiles
CREATE POLICY "Farm members can view co-member profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (SELECT public.get_farm_user_ids(auth.uid()))
);
