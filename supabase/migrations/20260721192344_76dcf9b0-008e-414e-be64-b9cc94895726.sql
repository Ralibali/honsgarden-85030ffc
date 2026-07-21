-- Extra butiksinställningar för lansering (företagsuppgifter + gate)
insert into public.system_settings (key, value, description) values
  ('shop_company_name', '""'::jsonb, 'Företagsnamn som visas i köpvillkoren'),
  ('shop_company_org_number', '""'::jsonb, 'Organisationsnummer'),
  ('shop_company_address', '""'::jsonb, 'Postadress till företaget'),
  ('shop_return_address', '""'::jsonb, 'Returadress för konsumentreturer'),
  ('shop_delivery_method', '"Postnord"'::jsonb, 'Fraktbolag som visas i villkor och produktsida'),
  ('shop_delivery_days_min', '1'::jsonb, 'Snabbaste leverans (arbetsdagar)'),
  ('shop_delivery_days_max', '3'::jsonb, 'Långsammaste leverans (arbetsdagar)'),
  ('shop_terms_reviewed_at', 'null'::jsonb, 'Tidstämpel för när admin godkänt villkoren')
on conflict (key) do nothing;