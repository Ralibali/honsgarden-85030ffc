
-- Remove admin SELECT policies from data tables (admin uses admin panel instead)
DROP POLICY IF EXISTS "Admins can view all egg logs" ON public.egg_logs;
DROP POLICY IF EXISTS "Admins can view all hens" ON public.hens;
DROP POLICY IF EXISTS "Admins can view all feed records" ON public.feed_records;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all health logs" ON public.health_logs;
DROP POLICY IF EXISTS "Admins can view all hatchings" ON public.hatchings;
DROP POLICY IF EXISTS "Admins can view all daily chores" ON public.daily_chores;
DROP POLICY IF EXISTS "Admins can view all chore completions" ON public.chore_completions;
DROP POLICY IF EXISTS "Admins can view all coop settings" ON public.coop_settings;
