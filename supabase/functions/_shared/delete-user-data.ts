// Shared helper that wipes all rows belonging to a user from public tables,
// then deletes the auth user. Uses a service-role client.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// Tables keyed by user_id
const USER_ID_TABLES = [
  "chore_completions",
  "achievement_rewards",
  "health_logs",
  "egg_logs",
  "feed_records",
  "transactions",
  "hatchings",
  "daily_chores",
  "feedback",
  "reminder_settings",
  "coop_settings",
  "hens",
  "flocks",
  "egg_goals",
  "blog_comments",
  "community_comments",
  "community_reactions",
  "community_posts",
  "public_egg_sale_listings",
  "notification_reads",
  "user_notifications",
  "page_views",
  "click_events",
  "weather_advice_cache",
  "weather_alert_preferences",
  "weather_alerts_sent",
  "rate_limits",
  "farm_members",
  "user_roles",
  "profiles",
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

export async function deleteUserCompletely(userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabaseAdmin: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  for (const table of USER_ID_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq("user_id", userId);
    if (error) console.warn(`[delete-user] ${table} user_id:`, error.message);
  }

  for (const { table, filter } of SPECIAL_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().or(filter(userId));
    if (error) console.warn(`[delete-user] ${table} or:`, error.message);
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[delete-user] auth.admin.deleteUser:", deleteError);
    return { ok: false, error: deleteError.message };
  }
  return { ok: true };
}
