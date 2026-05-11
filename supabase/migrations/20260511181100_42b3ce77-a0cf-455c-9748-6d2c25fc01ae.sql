DO $$
DECLARE
  _uid uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    _uid,
    'authenticated',
    'authenticated',
    'info@auroramedia.se',
    crypt('bagarn', gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Aurora Media"}'::jsonb,
    false
  );

  INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    _uid,
    jsonb_build_object('sub', _uid::text, 'email', 'info@auroramedia.se', 'email_verified', true),
    'email',
    _uid::text,
    now(), now(), now()
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (_uid, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
    SET is_lifetime_premium = true,
        subscription_status = 'premium',
        premium_expires_at = NULL
  WHERE user_id = _uid;
END $$;