import { supabase } from "@/integrations/supabase/client";
export const linkedAppsEnabled =
  import.meta.env.VITE_UNIFIED_ACCOUNT_ENABLED === "true";
export const APP_ID = "hens" as const;
export async function linkedAppAction(
  action: string,
  extra: Record<string, unknown> = {},
) {
  const { data: { session } } = await supabase.auth.getSession();
  const response = await fetch(
    "https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/unified-account",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ app: APP_ID, action, ...extra }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      referrerPolicy: "no-referrer",
    },
  );
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error || "Kopplingen kunde inte nås. Försök igen.");
  }
  return data;
}
export function openLinkedDestination(raw: string) {
  const url = new URL(raw);
  if (
    url.protocol !== "https:" ||
    ![
      "honsgarden.se",
      "odlingsdagboken.com",
      "checkout.stripe.com",
      "billing.stripe.com",
    ].includes(url.hostname)
  ) throw new Error("Länken kunde inte kontrolleras.");
  window.location.assign(url.href);
}
export function pendingAccountLink() {
  try {
    return !!sessionStorage.getItem("pending_account_link");
  } catch {
    return false;
  }
}
