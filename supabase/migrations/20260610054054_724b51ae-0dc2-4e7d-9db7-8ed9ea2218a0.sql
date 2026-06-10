ALTER TABLE public.public_egg_sale_bookings
  ADD COLUMN IF NOT EXISTS pickup_reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_bookings_pickup_reminder
  ON public.public_egg_sale_bookings (pickup_slot_id)
  WHERE pickup_reminder_sent_at IS NULL AND status <> 'cancelled';