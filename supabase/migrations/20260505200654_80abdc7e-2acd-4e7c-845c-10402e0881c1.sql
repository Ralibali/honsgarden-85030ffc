UPDATE public.profiles
SET is_lifetime_premium = false,
    premium_expires_at = to_timestamp(1807106062)
WHERE id = 'd506351a-d3b6-4229-8d38-98123a548bdc';