import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/** All pages are needed: Supabase defaults to at most 1,000 returned rows. */
export async function confirmedNewsletterEmails(client: SupabaseClient): Promise<Set<string>> {
  const emails = new Set<string>();
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client.from("newsletter_subscribers")
      .select("email").not("confirmed_at", "is", null)
      .order("id").range(offset, offset + 999);
    if (error) throw new Error("Kunde inte kontrollera bekräftade nyhetsbrevsadresser");
    for (const row of data ?? []) emails.add(row.email.trim().toLowerCase());
    if (!data || data.length < 1000) return emails;
  }
}

export function requiresNewsletterConfirmation(payload: { label?: string; purpose?: string }): boolean {
  if (payload.label === "newsletter-confirmation") return false;
  return payload.purpose === "marketing" || payload.label?.startsWith("newsletter") === true
    || ["day-2-activation", "trial_day5", "trial_day7", "trial_day10"].includes(payload.label ?? "");
}
