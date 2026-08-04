
-- Notifications sent by admins to all users
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  author_id uuid NOT NULL
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read notifications
CREATE POLICY "Authenticated users can read notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can delete
CREATE POLICY "Admins can delete notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Track which notifications each user has read
CREATE TABLE public.notification_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(notification_id, user_id)
);

ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own reads"
  ON public.notification_reads FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
