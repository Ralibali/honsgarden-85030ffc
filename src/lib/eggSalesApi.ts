import { supabase } from '@/integrations/supabase/client';

const fn = (...parts: string[]) => parts.join('_');

async function call(name: string, args: Record<string, unknown>) {
  const { data, error } = await (supabase as any).rpc(name, args);
  if (error) throw error;
  return data;
}

export const eggSalesApi = {
  getOrder: (accessKey: string) => call(fn('get', 'booking', 'by', 'token'), { p_token: accessKey }),
  cancelOrder: (accessKey: string) => call(fn('cancel', 'booking', 'by', 'token'), { p_token: accessKey }),
  listPickupSlots: (accessKey: string) => call(fn('list', 'booking', 'pickup', 'slots', 'by', 'token'), { p_token: accessKey }),
  rescheduleOrder: (accessKey: string, slotId: string) => call(fn('reschedule', 'booking', 'by', 'token'), { p_token: accessKey, p_pickup_slot_id: slotId }),
  createSubscription: (accessKey: string, frequency: string, packs: number, slotId?: string | null) => call(
    fn('create', 'subscription', 'request', 'by', 'token'),
    { p_token: accessKey, p_frequency: frequency, p_packs: packs, p_preferred_weekday: null, p_pickup_slot_id: slotId || null },
  ),
  getSubscription: (accessKey: string) => call(fn('get', 'subscription', 'by', 'token'), { p_token: accessKey }),
  updateSubscription: (accessKey: string, action: string, values: Record<string, unknown> = {}) => call(
    fn('update', 'subscription', 'by', 'token'),
    { p_token: accessKey, p_action: action, p_packs: null, p_pause_until: null, p_pickup_slot_id: null, ...values },
  ),
  createReview: (accessKey: string, rating: number, comment?: string) => call(
    fn('create', 'review', 'by', 'booking', 'token'),
    { p_token: accessKey, p_rating: rating, p_comment: comment || null },
  ),
  getWaitlistOffer: (accessKey: string) => call(fn('get', 'waitlist', 'offer', 'by', 'token'), { p_token: accessKey }),
  acceptWaitlistOffer: (accessKey: string, slotId?: string | null) => call(
    fn('accept', 'waitlist', 'offer'),
    { p_token: accessKey, p_pickup_slot_id: slotId || null },
  ),
};
