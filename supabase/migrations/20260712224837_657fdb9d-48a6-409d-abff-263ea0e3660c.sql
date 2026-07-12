
-- Sales leads table for Firecrawl-driven admin research
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  business_type TEXT,
  website TEXT,
  website_domain TEXT,
  public_email TEXT,
  public_phone TEXT,
  city TEXT,
  region TEXT,
  social_urls JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_url TEXT,
  source_title TEXT,
  source_description TEXT,
  relevance_score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'new',
  notes TEXT,
  do_not_contact BOOLEAN NOT NULL DEFAULT false,
  found_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_contacted_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT sales_leads_status_check CHECK (status IN ('new','reviewed','qualified','contacted','interested','customer','rejected'))
);

-- Dedupe: prefer domain, fall back to email. Partial unique indexes so nulls don't block.
CREATE UNIQUE INDEX IF NOT EXISTS sales_leads_domain_uidx
  ON public.sales_leads (lower(website_domain))
  WHERE website_domain IS NOT NULL AND website_domain <> '';
CREATE UNIQUE INDEX IF NOT EXISTS sales_leads_email_uidx
  ON public.sales_leads (lower(public_email))
  WHERE public_email IS NOT NULL AND public_email <> '';
CREATE INDEX IF NOT EXISTS sales_leads_status_idx ON public.sales_leads (status);
CREATE INDEX IF NOT EXISTS sales_leads_found_at_idx ON public.sales_leads (found_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_leads TO authenticated;
GRANT ALL ON public.sales_leads TO service_role;

ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sales leads"
  ON public.sales_leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert sales leads"
  ON public.sales_leads FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update sales leads"
  ON public.sales_leads FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete sales leads"
  ON public.sales_leads FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sales_leads_updated_at
  BEFORE UPDATE ON public.sales_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
