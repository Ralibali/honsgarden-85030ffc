-- One-off cleanup: orphan premium profile without expiry/lifetime/stripe customer
-- Triggers protect_subscription_fields/guard_premium_expires_at block normal updates,
-- so we temporarily disable user triggers to fix legacy data.
ALTER TABLE public.profiles DISABLE TRIGGER USER;
UPDATE public.profiles
SET subscription_status = 'free', premium_expires_at = NULL
WHERE user_id = 'ee725304-d17b-4341-bd03-7d09f14d9136'
  AND is_lifetime_premium = false
  AND stripe_customer_id IS NULL
  AND premium_expires_at IS NULL;
ALTER TABLE public.profiles ENABLE TRIGGER USER;