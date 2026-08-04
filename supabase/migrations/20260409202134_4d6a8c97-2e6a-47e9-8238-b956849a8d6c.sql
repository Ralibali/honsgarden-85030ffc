CREATE TABLE public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  window_start timestamp with time zone NOT NULL DEFAULT date_trunc('minute', now()),
  request_count integer NOT NULL DEFAULT 1,
  UNIQUE (user_id, function_name, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.rate_limits
  FOR ALL USING (auth.role() = 'service_role'::text)
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_rate_limits_lookup ON public.rate_limits (user_id, function_name, window_start);

-- Auto-cleanup old rate limit entries (older than 1 hour)
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cleanup_rate_limits
  AFTER INSERT ON public.rate_limits
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_rate_limits();

-- Function to check and increment rate limit. Returns true if allowed.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _user_id uuid,
  _function_name text,
  _max_requests integer,
  _window_minutes integer DEFAULT 1
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _window timestamp with time zone;
  _count integer;
BEGIN
  _window := date_trunc('minute', now());
  -- For windows > 1 min, round down to nearest window
  IF _window_minutes > 1 THEN
    _window := to_timestamp(
      floor(extract(epoch from now()) / (_window_minutes * 60)) * (_window_minutes * 60)
    );
  END IF;

  INSERT INTO public.rate_limits (user_id, function_name, window_start, request_count)
  VALUES (_user_id, _function_name, _window, 1)
  ON CONFLICT (user_id, function_name, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO _count;

  RETURN _count <= _max_requests;
END;
$$;