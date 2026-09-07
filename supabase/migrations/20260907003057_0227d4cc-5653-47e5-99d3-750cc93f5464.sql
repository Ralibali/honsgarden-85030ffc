CREATE TABLE public.digital_access_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.digital_orders(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'email',
  revoked boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX digital_access_tokens_order_idx ON public.digital_access_tokens (order_id);

GRANT ALL ON public.digital_access_tokens TO service_role;

ALTER TABLE public.digital_access_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "digital_access_tokens_admin_read" ON public.digital_access_tokens
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.digital_orders DROP COLUMN access_token_hash;