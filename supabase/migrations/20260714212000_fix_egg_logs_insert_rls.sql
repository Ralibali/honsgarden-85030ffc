-- Restore egg logging for authenticated users.
--
-- Farm-sharing policies may allow additional access, but every signed-in user
-- must always be able to create an egg log owned by their own auth account.
-- PostgreSQL combines permissive RLS policies with OR, so this does not widen
-- access to another user's rows.

ALTER TABLE public.egg_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "egg_logs_insert_own_user" ON public.egg_logs;

CREATE POLICY "egg_logs_insert_own_user"
ON public.egg_logs
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (user_id = (SELECT auth.uid()));
