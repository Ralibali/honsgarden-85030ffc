import { deleteAccountPhotos } from './account-storage-deletion.ts';
// Shared helper that wipes all rows belonging to a user from public tables,
// then deletes the auth user. Uses a service-role client.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tables keyed by user_id
// Current user-owned tables, children before parents. Merchant payment records remain subject to legal retention.
const USER_ID_TABLES = [
  "achievement_rewards",
  "affiliate_clicks",
  "affiliate_impressions",
  "agda_chat_logs",
  "backup_exports",
  "blog_comments",
  "chore_completions",
  "click_events",
  "client_error_logs",
  "community_reactions",
  "device_tokens",
  "egg_goals",
  "egg_logs",
  "egg_sale_templates",
  "egg_sales",
  "farm_members",
  "feed_records",
  "feedback",
  "generated_reports",
  "hatchings",
  "health_events",
  "health_logs",
  "health_schedules",
  "hen_photos",
  "inventory_transactions",
  "lifecycle_emails_sent",
  "marketplace_alerts",
  "marketplace_favorites",
  "notification_reads",
  "page_views",
  "profiles",
  "public_egg_sale_listings",
  "push_subscriptions",
  "rate_limits",
  "reminder_settings",
  "reminders",
  "transactions",
  "user_notifications",
  "user_roles",
  "weather_advice_cache",
  "weather_alert_preferences",
  "weather_alerts_sent",
  "community_comments",
  "coop_settings",
  "daily_chores",
  "inventory_items",
  "marketplace_listings",
  "community_posts",
  "breeding_pairs",
  "flocks",
  "hatch_sessions",
  "hens",
];

// Tables keyed by other user-ish columns
const SPECIAL_TABLES: Array<{ table: string; filter: (uid: string) => string }> = [
  { table: "referrals", filter: (uid) => `referrer_user_id.eq.${uid},referred_user_id.eq.${uid}` },
  { table: "egg_sale_review_tokens", filter: (uid) => `seller_user_id.eq.${uid}` },
  { table: "egg_sale_reviews", filter: (uid) => `seller_user_id.eq.${uid}` },
  { table: "egg_sale_waitlist", filter: (uid) => `seller_user_id.eq.${uid}` },
  { table: "public_egg_sale_bookings", filter: (uid) => `seller_user_id.eq.${uid}` },
  { table: "community_reports", filter: (uid) => `reported_by.eq.${uid}` },
  { table: "farm_invitations", filter: (uid) => `invited_by.eq.${uid}` },
];

const LOGO_URL = "https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png";

async function sendGoodbyeEmail(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<void> {
  try {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const email = authUser?.user?.email;
    if (!email) return;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("display_name")
      .eq("user_id", userId)
      .maybeSingle();

    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const displayName = escapeHtml(profile?.display_name || email.split("@")[0]);

    const html = `
<div style="font-family: 'Inter', Arial, sans-serif; max-width: 540px; padding: 36px 28px; background: #ffffff;">
  <img src="${LOGO_URL}" width="140" alt="Hönsgården" style="margin: 0 0 28px;" />
  <h1 style="font-family: 'Young Serif', Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 20px;">
    Begäran om kontoradering
  </h1>
  <p style="font-size: 15px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;">
    Hej <strong>${displayName}</strong>,
  </p>
  <p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;">
    Vi har tagit emot din begäran om att avsluta ditt Hönsgården-konto. Raderingen bekräftas i appen när den har slutförts.
  </p>
  <p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;">
    Uppgifter som behöver bevaras enligt lag kan finnas kvar. Kontakta oss om du behöver hjälp med ett registerutdrag eller din begäran.
  </p>
  <p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 24px;">
    Tack för tiden du var med oss. Du är alltid välkommen tillbaka 🐔
  </p>
  <p style="font-size: 12px; color: #999; margin: 32px 0 0; line-height: 1.5;">
    Har du frågor? Svara på detta mejl eller kontakta oss på info@auroramedia.se.
  </p>
</div>`;

    await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        run_id: crypto.randomUUID(),
        to: email,
        from: "Hönsgården <noreply@notify.honsgarden.se>",
        sender_domain: "notify.honsgarden.se",
        subject: "Din begäran om kontoradering i Hönsgården",
        html,
        text: `Hej ${displayName}, vi har tagit emot din begäran om kontoradering. Raderingen bekräftas i appen när den har slutförts. Tack för tiden du var med oss.`,
        purpose: "transactional",
        label: "account-deleted",
        message_id: `account-deleted-${userId}-${Date.now()}`,
        queued_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[delete-user] sendGoodbyeEmail failed:", err);
  }
}

export async function deleteUserCompletely(userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabaseAdmin: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    for (const bucket of ['hen-images', 'hen-photos', 'egg-sale-images', 'community-images', 'reports', 'backups']) {
      await deleteAccountPhotos(supabaseAdmin.storage.from(bucket), userId);
    }
  } catch (error) {
    console.error('[delete-user] storage cleanup failed');
    return { ok: false, error: 'Kunde inte ta bort kontots filer. Försök igen eller kontakta support.' };
  }

  // Skicka bekräftelsemejl INNAN vi raderar (vi behöver email-adressen)
  await sendGoodbyeEmail(supabaseAdmin, userId);

  const deleteErrors: string[] = [];

  for (const table of USER_ID_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) {
      console.error(`[delete-user] ${table} user_id:`, error.message);
      deleteErrors.push(`${table}: ${error.message}`);
    }
  }

  for (const { table, filter } of SPECIAL_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().or(filter(userId));
    if (error) {
      console.error(`[delete-user] ${table} or:`, error.message);
      deleteErrors.push(`${table}: ${error.message}`);
    }
  }

  if (deleteErrors.length > 0) {
    return { ok: false, error: deleteErrors.slice(0, 3).join("; ") };
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[delete-user] auth.admin.deleteUser:", deleteError);
    return { ok: false, error: deleteError.message };
  }
  return { ok: true };
}
