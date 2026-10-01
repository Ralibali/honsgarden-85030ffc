import { supabase } from '@/integrations/supabase/client';

type ExportQuery = { select(columns: '*'): ExportQuery; eq(column: 'user_id', value: string): ExportQuery; order(column: string): ExportQuery; range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: unknown }> };
const exportClient = supabase as unknown as { from(table: string): ExportQuery };

const OWN_TABLES = [
  {
    "table": "achievement_rewards",
    "order": "id"
  },
  {
    "table": "affiliate_clicks",
    "order": "id"
  },
  {
    "table": "affiliate_impressions",
    "order": "id"
  },
  {
    "table": "agda_chat_logs",
    "order": "id"
  },
  {
    "table": "backup_exports",
    "order": "id"
  },
  {
    "table": "blog_comments",
    "order": "id"
  },
  {
    "table": "breeding_pairs",
    "order": "id"
  },
  {
    "table": "chore_completions",
    "order": "id"
  },
  {
    "table": "click_events",
    "order": "id"
  },
  {
    "table": "client_error_logs",
    "order": "id"
  },
  {
    "table": "community_comments",
    "order": "id"
  },
  {
    "table": "community_posts",
    "order": "id"
  },
  {
    "table": "community_reactions",
    "order": "id"
  },
  {
    "table": "coop_settings",
    "order": "id"
  },
  {
    "table": "daily_chores",
    "order": "id"
  },
  {
    "table": "device_tokens",
    "order": "id"
  },
  {
    "table": "egg_goals",
    "order": "id"
  },
  {
    "table": "egg_logs",
    "order": "id"
  },
  {
    "table": "egg_sale_templates",
    "order": "id"
  },
  {
    "table": "egg_sales",
    "order": "id"
  },
  {
    "table": "farm_members",
    "order": "id"
  },
  {
    "table": "feed_records",
    "order": "id"
  },
  {
    "table": "feedback",
    "order": "id"
  },
  {
    "table": "flocks",
    "order": "id"
  },
  {
    "table": "generated_reports",
    "order": "id"
  },
  {
    "table": "google_play_purchases",
    "order": "user_id"
  },
  {
    "table": "hatch_sessions",
    "order": "id"
  },
  {
    "table": "hatchings",
    "order": "id"
  },
  {
    "table": "health_events",
    "order": "id"
  },
  {
    "table": "health_logs",
    "order": "id"
  },
  {
    "table": "health_schedules",
    "order": "id"
  },
  {
    "table": "hen_photos",
    "order": "id"
  },
  {
    "table": "hens",
    "order": "id"
  },
  {
    "table": "inventory_items",
    "order": "id"
  },
  {
    "table": "inventory_transactions",
    "order": "id"
  },
  {
    "table": "lifecycle_emails_sent",
    "order": "id"
  },
  {
    "table": "marketplace_alerts",
    "order": "id"
  },
  {
    "table": "marketplace_favorites",
    "order": "id"
  },
  {
    "table": "marketplace_listings",
    "order": "id"
  },
  {
    "table": "notification_reads",
    "order": "id"
  },
  {
    "table": "page_views",
    "order": "id"
  },
  {
    "table": "profiles",
    "order": "id"
  },
  {
    "table": "public_egg_sale_listings",
    "order": "id"
  },
  {
    "table": "push_subscriptions",
    "order": "id"
  },
  {
    "table": "rate_limits",
    "order": "id"
  },
  {
    "table": "reminder_settings",
    "order": "id"
  },
  {
    "table": "reminders",
    "order": "id"
  },
  {
    "table": "shop_orders",
    "order": "id"
  },
  {
    "table": "transactions",
    "order": "id"
  },
  {
    "table": "user_notifications",
    "order": "id"
  },
  {
    "table": "user_roles",
    "order": "id"
  },
  {
    "table": "weather_advice_cache",
    "order": "id"
  },
  {
    "table": "weather_alert_preferences",
    "order": "id"
  },
  {
    "table": "weather_alerts_sent",
    "order": "id"
  }
] as const;

/** Download only the signed-in person's rows through the ordinary RLS-protected client. */
export async function downloadAccountData() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Logga in för att hämta dina uppgifter.');
  const sections: Record<string, unknown[]> = {};
  const unavailable: string[] = [];
  for (const { table, order } of OWN_TABLES) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await exportClient.from(table).select('*').eq('user_id', user.id).order(order).range(offset, offset + 499);
      if (error) { unavailable.push(table); break; }
      rows.push(...(data ?? []));
      if (!data || data.length < 500) break;
    }
    sections[table] = rows;
  }
  const output = { exported_at: new Date().toISOString(), account: { id: user.id, email: user.email, created_at: user.created_at, user_metadata: user.user_metadata }, sections, unavailable,
    note: 'Exporten innehåller uppgifter som ditt konto kan läsa. Kontakta verksamheten för registerutdrag som även omfattar leverantörsdata, interna loggar och uppgifter i andra system.' };
  const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = 'mina-personuppgifter.json'; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { unavailable };
}
