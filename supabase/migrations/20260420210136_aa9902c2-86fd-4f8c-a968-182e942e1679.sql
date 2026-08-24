CREATE OR REPLACE VIEW public.advertiser_config
WITH (security_invoker = true)
AS
SELECT
  a.id,
  a.slug,
  a.name,
  a.pin_domain,
  a.adtraction_advertiser_id,
  (SELECT value FROM public.system_settings WHERE key = 'adtraction_partner_id') AS partner_id,
  a.base_url,
  a.commission_rate,
  a.is_active,
  format(
    'https://%s/t/t?a=%s&as=%s&t=2&tk=1',
    a.pin_domain,
    a.adtraction_advertiser_id,
    (SELECT value FROM public.system_settings WHERE key = 'adtraction_partner_id')
  ) AS base_tracking_url
FROM public.affiliate_advertisers a
WHERE a.is_active;