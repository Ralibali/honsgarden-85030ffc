-- Older invitations have no recorded role. Owners can promote members after acceptance.
ALTER TABLE public.farm_invitations
  ADD COLUMN role text NOT NULL DEFAULT 'viewer'
  CHECK (role IN ('viewer', 'editor'));
