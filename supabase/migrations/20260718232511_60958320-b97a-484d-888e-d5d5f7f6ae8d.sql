
-- Revoke table-level SELECT from anon so we can grant per-column
REVOKE SELECT ON public.public_egg_sale_listings FROM anon;

-- Grant SELECT to anon on all columns EXCEPT manage_token, owner_email, contact_phone, submitted_ip
GRANT SELECT (
  id, user_id, slug, title, description, image_url, packs_available, eggs_per_pack,
  price_per_pack, location, pickup_info, contact_info, swish_number, swish_name,
  swish_message, p6_price, p12_price, p30_price, is_active, reserved_packs,
  sold_out_manually, created_at, updated_at, stock_packs, stock_source, auto_publish,
  regular_customer_threshold, latitude, longitude, listing_kind, verified_at,
  expires_at, theme, sections, price_tiers, reko_enabled, reko_group_name,
  reko_pickup_location, reko_next_pickup_at, reko_recurring_biweekly, reko_reminder_sent_for
) ON public.public_egg_sale_listings TO anon;
