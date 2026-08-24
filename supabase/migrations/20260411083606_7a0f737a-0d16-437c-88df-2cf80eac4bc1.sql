
-- 1. Remove overly permissive farm member profile policy
DROP POLICY IF EXISTS "Farm members can view co-member profiles" ON public.profiles;

-- 2. Create a safe function for farm member display names only
CREATE OR REPLACE FUNCTION public.get_farm_member_display_names(_uid uuid)
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name
  FROM public.profiles p
  WHERE p.user_id IN (SELECT get_farm_user_ids(_uid))
    AND p.user_id != _uid
$$;

-- 3. Fix functions missing search_path
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pgmq.send(queue_name, payload); $$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT msg_id, read_ct, message FROM pgmq.read(queue_name, vt, batch_size); $$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT pgmq.delete(queue_name, message_id); $$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
END;
$$;

-- 4. Remove notifications from realtime publication (use DO block to handle if not present)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE public.notifications;
EXCEPTION WHEN undefined_object THEN
  NULL;
END;
$$;

-- 5. Restrict farm_invitations SELECT to only the inviter (hide tokens from other members)
DROP POLICY IF EXISTS "Farm members can view invitations" ON public.farm_invitations;
CREATE POLICY "Inviters can view own invitations"
ON public.farm_invitations
FOR SELECT
USING (invited_by = auth.uid());

-- 6. Add restrictive policy on email_unsubscribe_tokens for extra protection
CREATE POLICY "Deny non-service access"
ON public.email_unsubscribe_tokens
AS RESTRICTIVE
FOR ALL
USING (auth.role() = 'service_role'::text)
WITH CHECK (auth.role() = 'service_role'::text);
