CREATE TABLE IF NOT EXISTS public.lifecycle_emails_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_key text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, email_key)
);

GRANT ALL ON public.lifecycle_emails_sent TO service_role;

ALTER TABLE public.lifecycle_emails_sent ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lifecycle_emails_user_key
  ON public.lifecycle_emails_sent (user_id, email_key);