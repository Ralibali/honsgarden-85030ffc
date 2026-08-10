CREATE OR REPLACE FUNCTION public.has_farm_role_for_owner(_owner_uid uuid, _required_role text DEFAULT 'viewer'::text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Always allow full access to your own data, even without a farm/coop row
    (_owner_uid IS NOT NULL AND _owner_uid = auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.farm_members caller
      JOIN public.farm_members owner_m ON owner_m.farm_id = caller.farm_id
      WHERE caller.user_id = auth.uid()
        AND owner_m.user_id = _owner_uid
        AND CASE caller.role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END
          >= CASE _required_role WHEN 'owner' THEN 3 WHEN 'editor' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END
    );
$$;