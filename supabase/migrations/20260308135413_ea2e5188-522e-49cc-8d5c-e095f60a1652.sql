
-- Page views tracking
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL,
  referrer text,
  user_agent text,
  session_id text,
  user_id uuid,
  country text,
  device_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Click events tracking
CREATE TABLE public.click_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  element_id text,
  element_text text,
  path text,
  session_id text,
  user_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous tracking)
CREATE POLICY "Anyone can insert page views" ON public.page_views FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read page views" ON public.page_views FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can insert click events" ON public.click_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read click events" ON public.click_events FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- Indexes for fast queries
CREATE INDEX idx_page_views_path ON public.page_views(path);
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at);
CREATE INDEX idx_click_events_event_name ON public.click_events(event_name);
CREATE INDEX idx_click_events_created_at ON public.click_events(created_at);
