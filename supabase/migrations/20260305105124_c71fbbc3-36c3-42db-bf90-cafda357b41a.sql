
-- Add referral_code column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Create referrals table to track who referred whom
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID NOT NULL,
  referred_user_id UUID NOT NULL,
  rewarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

-- Create achievement_rewards table to track which achievements have been rewarded
CREATE TABLE public.achievement_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  achievement_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_rewards ENABLE ROW LEVEL SECURITY;

-- RLS policies for referrals
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);
CREATE POLICY "Users can insert referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referred_user_id);

-- RLS policies for achievement_rewards
CREATE POLICY "Users manage own achievement rewards" ON public.achievement_rewards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Function to generate unique referral code from user id
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Generate a short unique code based on user_id
  NEW.referral_code := upper(substr(md5(NEW.user_id::text || now()::text), 1, 6));
  RETURN NEW;
END;
$$;

-- Trigger to auto-generate referral code on profile creation
CREATE TRIGGER set_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.referral_code IS NULL)
  EXECUTE FUNCTION public.generate_referral_code();

-- Function to grant premium days to a user
CREATE OR REPLACE FUNCTION public.grant_premium_days(_user_id UUID, _days INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_expires TIMESTAMP WITH TIME ZONE;
  new_expires TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT premium_expires_at INTO current_expires FROM public.profiles WHERE user_id = _user_id;
  
  -- If already premium and not expired, extend from current expiry
  IF current_expires IS NOT NULL AND current_expires > now() THEN
    new_expires := current_expires + (_days || ' days')::interval;
  ELSE
    new_expires := now() + (_days || ' days')::interval;
  END IF;
  
  UPDATE public.profiles 
  SET subscription_status = 'premium', premium_expires_at = new_expires
  WHERE user_id = _user_id;
END;
$$;

-- Function to process referral: grant both parties 7 days premium
CREATE OR REPLACE FUNCTION public.process_referral(_referral_code TEXT, _new_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  referrer_id UUID;
BEGIN
  -- Find who owns this referral code
  SELECT user_id INTO referrer_id FROM public.profiles WHERE referral_code = _referral_code;
  IF referrer_id IS NULL THEN RETURN false; END IF;
  IF referrer_id = _new_user_id THEN RETURN false; END IF;
  
  -- Check not already referred
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = _new_user_id) THEN RETURN false; END IF;
  
  -- Record referral
  INSERT INTO public.referrals (referrer_user_id, referred_user_id, rewarded) VALUES (referrer_id, _new_user_id, true);
  
  -- Save referred_by on profile
  UPDATE public.profiles SET referred_by = _referral_code WHERE user_id = _new_user_id;
  
  -- Grant 7 days to both
  PERFORM public.grant_premium_days(referrer_id, 7);
  PERFORM public.grant_premium_days(_new_user_id, 7);
  
  RETURN true;
END;
$$;
