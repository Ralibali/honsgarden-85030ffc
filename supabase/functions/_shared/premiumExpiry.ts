// Avgör om en användare med utgånget Plus fortfarande betalar via Stripe.
//
// Används av premium-expiry-cron innan någon nedgraderas. Reglerna för vilka
// prenumerationer som ger åtkomst är samma som i checkout, statuskontroll och
// webhook (stripeBilling.ts), så att nattjobbet inte säger emot dem.
//
// Modulen har inga externa beroenden och kan därför testas direkt i Vitest.
import { stripeAccessActive, stripePeriodEnd } from "./stripeBilling.ts";

type Subscription = Parameters<typeof stripeAccessActive>[0];

export interface StripeLookup {
  customers: {
    list(params: { email: string; limit: number }): Promise<{ data: Array<{ id: string }> }>;
  };
  subscriptions: {
    list(params: { customer: string; status: "all"; limit: number }): Promise<{ data: Subscription[] }>;
  };
}

export interface ExpiredProfile {
  email: string | null;
  stripe_customer_id?: string | null;
}

function isMissingCustomer(error: unknown): boolean {
  const e = error as { code?: string; statusCode?: number } | null;
  return e?.code === "resource_missing" || e?.statusCode === 404;
}

/**
 * Letar efter en prenumeration som ger åtkomst just nu.
 *
 * Kunden slås upp både via det sparade kund-id:t och via e-post. Bara e-post
 * räcker inte: den som bytt adress i appen, eller betalat med en annan adress
 * i Stripe Checkout, hittas då inte och skulle nedgraderas trots betalning.
 *
 * Returnerar slutdatumet för den längsta giltiga perioden, eller null när
 * ingen prenumeration ger åtkomst. Andra Stripe-fel än "kunden finns inte"
 * kastas vidare: vid osäkerhet ska anroparen låta användaren behålla Plus.
 */
export async function stripeEntitlement(
  stripe: StripeLookup,
  profile: ExpiredProfile,
  now = new Date(),
): Promise<{ entitled: boolean; periodEnd: string | null }> {
  const customerIds: string[] = [];
  if (profile.stripe_customer_id) customerIds.push(profile.stripe_customer_id);
  if (profile.email) {
    const byEmail = await stripe.customers.list({ email: profile.email, limit: 10 });
    for (const customer of byEmail.data) {
      if (!customerIds.includes(customer.id)) customerIds.push(customer.id);
    }
  }

  let entitled = false;
  let periodEnd: string | null = null;
  for (const customer of customerIds) {
    let subscriptions: Subscription[];
    try {
      subscriptions = (await stripe.subscriptions.list({ customer, status: "all", limit: 100 })).data;
    } catch (error) {
      // Ett sparat kund-id kan peka på en kund som raderats i Stripe.
      if (isMissingCustomer(error)) continue;
      throw error;
    }
    for (const subscription of subscriptions) {
      if (!stripeAccessActive(subscription, now)) continue;
      entitled = true;
      const end = stripePeriodEnd(subscription);
      if (end && (!periodEnd || end > periodEnd)) periodEnd = end;
    }
  }
  return { entitled, periodEnd };
}
