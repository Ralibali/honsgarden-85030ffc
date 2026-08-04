
ALTER TABLE public.feedback 
  ADD COLUMN admin_reply text,
  ADD COLUMN admin_reply_at timestamptz;
