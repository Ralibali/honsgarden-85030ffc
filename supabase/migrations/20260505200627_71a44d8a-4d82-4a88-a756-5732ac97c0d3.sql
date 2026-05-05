UPDATE public.profiles
SET is_lifetime_premium = false,
    subscription_status = 'premium',
    premium_expires_at = to_timestamp(1807106062),
    stripe_customer_id = 'cus_UIAOTX6QZ8W6Un'
WHERE user_id = '24558504-7cc2-4131-b342-3c8b2b4c59bf';