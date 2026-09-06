import { supabase } from '@/integrations/supabase/client';
import {
  checkoutBodyWithPlatform,
  refuseNativeIosStripeCheckout,
} from '@/lib/nativeStripeGuard';

export {
  NATIVE_IOS_PLUS_STRIPE_MESSAGE,
  NATIVE_IOS_SHOP_STRIPE_MESSAGE,
  checkoutBodyWithPlatform,
  refuseNativeIosStripeCheckout,
} from '@/lib/nativeStripeGuard';

/** Plus Stripe checkout. Refuses on native iOS; otherwise tags `platform` if needed. */
export async function invokeCreateCheckout(body: Record<string, unknown>) {
  refuseNativeIosStripeCheckout('plus');
  return supabase.functions.invoke('create-checkout', {
    body: checkoutBodyWithPlatform(body),
  });
}

/** Physical-goods shop checkout. No-ops as a thrown guard on native iOS. */
export async function invokeShopCheckout(body: Record<string, unknown>) {
  refuseNativeIosStripeCheckout('shop');
  return supabase.functions.invoke('shop-checkout', { body });
}
