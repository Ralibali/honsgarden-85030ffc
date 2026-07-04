CREATE TABLE public.agda_chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

GRANT SELECT ON public.agda_chat_logs TO authenticated;
GRANT ALL ON public.agda_chat_logs TO service_role;

ALTER TABLE public.agda_chat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all agda chat logs"
ON public.agda_chat_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_agda_chat_logs_created_at ON public.agda_chat_logs (created_at DESC);
CREATE INDEX idx_agda_chat_logs_user_id ON public.agda_chat_logs (user_id);