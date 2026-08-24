ALTER TABLE public.system_settings DISABLE TRIGGER trg_enforce_shop_launch_gate;
UPDATE public.system_settings SET value = 'false'::jsonb WHERE key = 'shop_public_enabled';
ALTER TABLE public.system_settings ENABLE TRIGGER trg_enforce_shop_launch_gate;