
-- 1. Pickup slots
CREATE TABLE public.egg_sale_pickup_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.public_egg_sale_listings(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  max_bookings integer NOT NULL DEFAULT 5 CHECK (max_bookings > 0),
  current_bookings integer NOT NULL DEFAULT 0 CHECK (current_bookings >= 0),
  label text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_pickup_slots_listing ON public.egg_sale_pickup_slots(listing_id, starts_at);
GRANT SELECT ON public.egg_sale_pickup_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.egg_sale_pickup_slots TO authenticated;
GRANT ALL ON public.egg_sale_pickup_slots TO service_role;
ALTER TABLE public.egg_sale_pickup_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads active slots for active listings"
  ON public.egg_sale_pickup_slots FOR SELECT
  USING (is_active AND EXISTS (
    SELECT 1 FROM public.public_egg_sale_listings l
    WHERE l.id = listing_id AND l.is_active = true
  ));
CREATE POLICY "Sellers manage own slots"
  ON public.egg_sale_pickup_slots FOR ALL
  USING (auth.uid() = seller_user_id)
  WITH CHECK (auth.uid() = seller_user_id);

CREATE TRIGGER trg_pickup_slots_updated_at
  BEFORE UPDATE ON public.egg_sale_pickup_slots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Templates
CREATE TABLE public.egg_sale_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.egg_sale_templates TO authenticated;
GRANT ALL ON public.egg_sale_templates TO service_role;
ALTER TABLE public.egg_sale_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own templates"
  ON public.egg_sale_templates FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON public.egg_sale_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Cancel tokens
CREATE TABLE public.egg_sale_booking_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.public_egg_sale_bookings(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.egg_sale_booking_tokens TO anon;
GRANT SELECT, UPDATE ON public.egg_sale_booking_tokens TO authenticated;
GRANT ALL ON public.egg_sale_booking_tokens TO service_role;
ALTER TABLE public.egg_sale_booking_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read by token" ON public.egg_sale_booking_tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can mark used" ON public.egg_sale_booking_tokens FOR UPDATE USING (used_at IS NULL) WITH CHECK (true);

-- 4. Extend bookings
ALTER TABLE public.public_egg_sale_bookings
  ADD COLUMN IF NOT EXISTS pickup_slot_id uuid REFERENCES public.egg_sale_pickup_slots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pickup_person_name text,
  ADD COLUMN IF NOT EXISTS pickup_person_phone text,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid','refunded'));

-- 5. Slot counter triggers
CREATE OR REPLACE FUNCTION public.adjust_slot_count_on_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.pickup_slot_id IS NOT NULL AND NEW.status <> 'cancelled' THEN
    UPDATE public.egg_sale_pickup_slots
    SET current_bookings = current_bookings + 1
    WHERE id = NEW.pickup_slot_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'cancelled' AND NEW.status = 'cancelled' AND OLD.pickup_slot_id IS NOT NULL THEN
      UPDATE public.egg_sale_pickup_slots
      SET current_bookings = GREATEST(0, current_bookings - 1)
      WHERE id = OLD.pickup_slot_id;
    ELSIF OLD.status = 'cancelled' AND NEW.status <> 'cancelled' AND NEW.pickup_slot_id IS NOT NULL THEN
      UPDATE public.egg_sale_pickup_slots
      SET current_bookings = current_bookings + 1
      WHERE id = NEW.pickup_slot_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_adjust_slot_count_insert
  AFTER INSERT ON public.public_egg_sale_bookings
  FOR EACH ROW EXECUTE FUNCTION public.adjust_slot_count_on_booking();
CREATE TRIGGER trg_adjust_slot_count_update
  AFTER UPDATE OF status ON public.public_egg_sale_bookings
  FOR EACH ROW EXECUTE FUNCTION public.adjust_slot_count_on_booking();

-- 6. Auto-create cancel token on booking
CREATE OR REPLACE FUNCTION public.create_cancel_token_on_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.egg_sale_booking_tokens (booking_id)
  VALUES (NEW.id)
  ON CONFLICT (booking_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_create_cancel_token
  AFTER INSERT ON public.public_egg_sale_bookings
  FOR EACH ROW EXECUTE FUNCTION public.create_cancel_token_on_booking();

-- 7. Verified seller view (materialized as function for ad-hoc query)
CREATE OR REPLACE FUNCTION public.is_verified_egg_seller(_seller_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT COUNT(*) >= 3 AND AVG(rating) >= 4.0
    FROM public.egg_sale_reviews
    WHERE seller_user_id = _seller_id AND is_published = true
  ), false);
$$;
