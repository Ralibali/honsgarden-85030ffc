
-- ============================================================
-- 1. PROFILES: Förhindra privilege escalation
-- ============================================================
-- Ta bort den breda update-policyn
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Användare kan bara uppdatera sin egen profil OCH inte ändra prenumerationsfält
CREATE POLICY "Users can update own profile (safe fields)"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
);

-- Skydda känsliga fält via en BEFORE UPDATE trigger
CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tillåt service_role och admins att ändra allt
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Vanliga användare: tvinga tillbaka gamla värden för känsliga fält
  NEW.subscription_status := OLD.subscription_status;
  NEW.is_lifetime_premium := OLD.is_lifetime_premium;
  NEW.premium_expires_at := OLD.premium_expires_at;
  NEW.referral_code := OLD.referral_code;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_subscription_fields_trigger ON public.profiles;
CREATE TRIGGER protect_subscription_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_subscription_fields();

-- ============================================================
-- 2. USER_ROLES: Förhindra self-grant av admin
-- ============================================================
-- Restrictive policy: blockera ALL skrivning för icke-service-role
CREATE POLICY "Block user role writes"
ON public.user_roles
AS RESTRICTIVE
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Admins kan se alla roller (för admin-panelen)
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 3. HEN-IMAGES: Gör privat
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'hen-images';

-- Ta bort tidigare SELECT-policy (om någon)
DROP POLICY IF EXISTS "Users can list their own hen images" ON storage.objects;
DROP POLICY IF EXISTS "Hen images are publicly viewable" ON storage.objects;

-- Ägare och farmmedlemmar kan se bilden
CREATE POLICY "Hen images viewable by farm members"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hen-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR (storage.foldername(name))[1]::uuid IN (
      SELECT public.get_farm_user_ids(auth.uid())
    )
  )
);

-- ============================================================
-- 4. ACHIEVEMENT_REWARDS: Blockera skrivning
-- ============================================================
CREATE POLICY "Block achievement writes"
ON public.achievement_rewards
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Block achievement updates"
ON public.achievement_rewards
AS RESTRICTIVE
FOR UPDATE
TO public
USING (auth.role() = 'service_role');

CREATE POLICY "Block achievement deletes"
ON public.achievement_rewards
AS RESTRICTIVE
FOR DELETE
TO public
USING (auth.role() = 'service_role');

-- Tillåt service_role att hantera achievements
CREATE POLICY "Service role manages achievements"
ON public.achievement_rewards
FOR ALL
TO public
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- 5. ADMIN-LÄSPOLICYS för e-posttabeller
-- ============================================================
CREATE POLICY "Admins can read email send log"
ON public.email_send_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read suppressed emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read newsletter subscribers"
ON public.newsletter_subscribers
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- DELETE-policys (för rensning av gamla data)
CREATE POLICY "Service role can delete email log"
ON public.email_send_log
FOR DELETE
TO public
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete unsubscribe tokens"
ON public.email_unsubscribe_tokens
FOR DELETE
TO public
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can delete newsletter subscribers"
ON public.newsletter_subscribers
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- 6. FARM_INVITATIONS: Rensning av använda tokens
-- ============================================================
CREATE POLICY "Service role can delete used invitations"
ON public.farm_invitations
FOR DELETE
TO public
USING (auth.role() = 'service_role');

CREATE POLICY "Owners can delete own invitations"
ON public.farm_invitations
FOR DELETE
TO authenticated
USING (invited_by = auth.uid());

-- ============================================================
-- 7. Begränsa publika INSERT-policys (storlek + non-empty)
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert click events" ON public.click_events;
CREATE POLICY "Anyone can insert click events (limited)"
ON public.click_events
FOR INSERT
TO public
WITH CHECK (
  event_name IS NOT NULL
  AND length(event_name) <= 100
  AND (path IS NULL OR length(path) <= 500)
  AND (element_text IS NULL OR length(element_text) <= 500)
);

DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert page views (limited)"
ON public.page_views
FOR INSERT
TO public
WITH CHECK (
  path IS NOT NULL
  AND length(path) <= 500
  AND (referrer IS NULL OR length(referrer) <= 500)
  AND (user_agent IS NULL OR length(user_agent) <= 500)
);

DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe (validated)"
ON public.newsletter_subscribers
FOR INSERT
TO public
WITH CHECK (
  email IS NOT NULL
  AND length(email) <= 254
  AND email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);
