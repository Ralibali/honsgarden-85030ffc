-- Shared calendar-month quota for the five auxiliary AI endpoints.
CREATE TABLE IF NOT EXISTS public.ai_monthly_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month_start date NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count BETWEEN 0 AND 100),
  PRIMARY KEY (user_id, month_start)
);
ALTER TABLE public.ai_monthly_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ai_monthly_usage FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.ai_monthly_usage TO service_role;

CREATE OR REPLACE FUNCTION public.consume_ai_monthly_quota(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _month date := date_trunc('month', now() AT TIME ZONE 'UTC')::date;
  _count integer;
BEGIN
  INSERT INTO public.ai_monthly_usage(user_id, month_start, request_count)
  VALUES (_user_id, _month, 1)
  ON CONFLICT (user_id, month_start) DO UPDATE
    SET request_count = ai_monthly_usage.request_count + 1
    WHERE ai_monthly_usage.request_count < 100
  RETURNING request_count INTO _count;
  RETURN _count IS NOT NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_ai_monthly_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_monthly_quota(uuid) TO service_role;
