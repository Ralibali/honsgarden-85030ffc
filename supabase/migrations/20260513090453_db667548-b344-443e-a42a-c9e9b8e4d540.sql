UPDATE public.profiles
SET subscription_status = 'premium',
    premium_expires_at = CASE
      WHEN premium_expires_at IS NOT NULL AND premium_expires_at > now()
        THEN premium_expires_at + interval '5 days'
      ELSE now() + interval '5 days'
    END
WHERE is_lifetime_premium = false
  AND (subscription_status IS DISTINCT FROM 'premium'
       OR premium_expires_at IS NULL
       OR premium_expires_at < now() + interval '5 days');