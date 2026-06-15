import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

// ==================== TYPES ====================

type Hen = Tables<'hens'>;
type HenInsert = Omit<TablesInsert<'hens'>, 'user_id' | 'id' | 'created_at' | 'updated_at'>;
type HenUpdate = Omit<TablesUpdate<'hens'>, 'user_id' | 'id' | 'created_at' | 'updated_at'>;

type EggLog = Tables<'egg_logs'>;

type FeedRecord = Tables<'feed_records'>;
type FeedRecordInsert = Omit<TablesInsert<'feed_records'>, 'user_id' | 'id' | 'created_at'>;

type Hatching = Tables<'hatchings'>;
type HatchingInsert = Omit<TablesInsert<'hatchings'>, 'user_id' | 'id' | 'created_at' | 'updated_at'>;
type HatchingUpdate = Omit<TablesUpdate<'hatchings'>, 'user_id' | 'id' | 'created_at' | 'updated_at'>;

type Transaction = Tables<'transactions'>;
type TransactionInsert = Omit<TablesInsert<'transactions'>, 'user_id' | 'id' | 'created_at'>;

type HealthLog = Tables<'health_logs'>;
type HealthLogInsert = Omit<TablesInsert<'health_logs'>, 'user_id' | 'id' | 'created_at'>;

type Feedback = Tables<'feedback'>;
type FeedbackInsert = Omit<TablesInsert<'feedback'>, 'user_id' | 'id' | 'created_at'>;

type CoopSettings = Tables<'coop_settings'>;
type CoopSettingsUpdate = Omit<TablesUpdate<'coop_settings'>, 'user_id' | 'id' | 'created_at' | 'updated_at'>;

type Flock = Tables<'flocks'>;
type FlockInsert = Omit<TablesInsert<'flocks'>, 'user_id' | 'id' | 'created_at' | 'updated_at'>;
type FlockUpdate = Omit<TablesUpdate<'flocks'>, 'user_id' | 'id' | 'created_at' | 'updated_at'>;

type ReminderSettings = Tables<'reminder_settings'>;
type ReminderSettingsUpdate = Omit<TablesUpdate<'reminder_settings'>, 'user_id' | 'id' | 'created_at' | 'updated_at'>;

type Profile = Tables<'profiles'>;

interface ProductivityAlert {
  type: string;
  message: string;
}

interface DailyChoreWithCompletion extends Tables<'daily_chores'> {
  completed: boolean;
}

interface HenWithEggTotal extends Hen {
  total_eggs: number;
}

interface HenWithHealthScore extends Hen {
  health_score: number;
}

interface HenProfile extends Hen {
  health_logs: HealthLog[];
}

interface FlockStat {
  id: string;
  name: string;
  total_eggs: number;
  week_eggs: number;
  month_eggs: number;
  week_change: number | null;
  active_hens: number;
  avg_per_day: number;
}

interface AdminUserProfile extends Profile {
  coop_name: string | null;
}

interface AdminFeedbackItem extends Feedback {
  profile: Pick<Profile, 'user_id' | 'display_name' | 'email'> | null;
  sender_label: string;
}

// Helper to get current user id
async function getUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

// ==================== HENS ====================

export async function getHens(): Promise<Hen[]> {
  await getUserId();
  const { data, error } = await supabase.from('hens').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createHen(henData: HenInsert): Promise<Hen> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('hens').insert({ ...henData, user_id: userId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateHen(id: string, henData: HenUpdate): Promise<Hen> {
  const { data, error } = await supabase.from('hens').update(henData).eq('id', id).select().maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;

  const { data: currentHen, error: fetchError } = await supabase.from('hens').select('*').eq('id', id).maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!currentHen) throw new Error('Hönan kunde inte uppdateras.');
  return currentHen;
}

export async function deleteHen(id: string): Promise<void> {
  const { error } = await supabase.from('hens').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getHenProfile(id: string): Promise<HenProfile> {
  await getUserId();
  const { data: hen, error } = await supabase.from('hens').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  const { data: healthLogs } = await supabase.from('health_logs').select('*').eq('hen_id', id).order('date', { ascending: false });
  return { ...hen, health_logs: healthLogs || [] };
}

// ==================== EGGS ====================

export async function getEggs(): Promise<EggLog[]> {
  await getUserId();
  const { data, error } = await supabase.from('egg_logs').select('*').order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createEggRecord(record: { date: string; count: number; notes?: string; hen_id?: string; flock_id?: string; weather?: Record<string, unknown> | null; client_id?: string }): Promise<EggLog> {
  const userId = await getUserId();
  const insertData: TablesInsert<'egg_logs'> = { date: record.date, count: record.count, user_id: userId };
  if (record.notes) insertData.notes = record.notes;
  if (record.hen_id) insertData.hen_id = record.hen_id;
  if (record.flock_id) insertData.flock_id = record.flock_id;
  if (record.weather) (insertData as any).weather = record.weather;
  if (record.client_id) (insertData as any).client_id = record.client_id;
  const { data, error } = await supabase.from('egg_logs').insert(insertData).select().single();
  if (error) {
    // Unique violation on (user_id, client_id) — already inserted, treat as success and return existing row.
    if ((error as any).code === '23505' && record.client_id) {
      const { data: existing } = await (supabase
        .from('egg_logs') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('client_id', record.client_id)
        .maybeSingle();
      if (existing) return existing as EggLog;
    }
    throw new Error(error.message);
  }
  return data;
}



// Snapshot today's weather (current temp + weathercode) for an egg log.
// Returns null silently on any failure – this is "best effort" enrichment.
export async function fetchEggLogWeatherSnapshot(date: string): Promise<Record<string, unknown> | null> {
  try {
    const coop = await supabase.from('coop_settings').select('latitude, longitude').limit(1).maybeSingle();
    let lat = (coop.data as any)?.latitude;
    let lon = (coop.data as any)?.longitude;
    if ((!lat || !lon) && typeof navigator !== 'undefined' && navigator.geolocation) {
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { timeout: 3000, maximumAge: 60 * 60 * 1000 });
      });
      if (pos) { lat = pos.coords.latitude; lon = pos.coords.longitude; }
    }
    if (!lat || !lon) return null;
    const isToday = date === new Date().toISOString().split('T')[0];
    const url = isToday
      ? `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=1`
      : `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${date}&end_date=${date}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode,wind_speed_10m_max&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: any = await res.json();
    return {
      lat, lon,
      current: json.current ?? null,
      daily: json.daily ?? null,
      captured_at: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function deleteEggRecord(id: string): Promise<void> {
  const { error } = await supabase.from('egg_logs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ==================== FEED ====================

export async function getFeedRecords(): Promise<FeedRecord[]> {
  await getUserId();
  const { data, error } = await supabase.from('feed_records').select('*').order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFeedRecord(record: FeedRecordInsert): Promise<FeedRecord> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('feed_records').insert({ ...record, user_id: userId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFeedRecord(id: string): Promise<void> {
  const { error } = await supabase.from('feed_records').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getFeedInventory() {
  await getUserId();
  const { data, error } = await supabase.from('feed_records').select('*').order('date', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  const totalKg = (data || []).reduce((sum, r) => sum + (r.amount_kg || 0), 0);
  return { total_kg: totalKg, records: data ?? [] };
}

export async function getFeedStatistics() {
  await getUserId();
  const [feedRes, eggRes] = await Promise.all([
    supabase.from('feed_records').select('*').order('date', { ascending: false }),
    supabase.from('egg_logs').select('count'),
  ]);
  if (feedRes.error) throw new Error(feedRes.error.message);
  const feed = feedRes.data || [];
  const totalCost = feed.reduce((sum, r) => sum + (r.cost || 0), 0);
  const totalKg = feed.reduce((sum, r) => sum + (r.amount_kg || 0), 0);
  const totalEggs = (eggRes.data || []).reduce((sum, r) => sum + r.count, 0);
  const costPerEgg = totalEggs > 0 ? totalCost / totalEggs : 0;
  return { total_cost: totalCost, total_kg: totalKg, record_count: feed.length, cost_per_egg: costPerEgg };
}

// ==================== HATCHING ====================

export async function getHatchings(): Promise<Hatching[]> {
  await getUserId();
  const { data, error } = await supabase.from('hatchings').select('*').order('start_date', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createHatching(record: HatchingInsert): Promise<Hatching> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('hatchings').insert({ ...record, user_id: userId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateHatching(id: string, record: HatchingUpdate): Promise<Hatching> {
  const { data, error } = await supabase.from('hatchings').update(record).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteHatching(id: string): Promise<void> {
  const { error } = await supabase.from('hatchings').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getHatchingAlerts() {
  await getUserId();
  const { data, error } = await supabase.from('hatchings').select('*').eq('status', 'incubating');
  if (error) throw new Error(error.message);
  const today = new Date();
  return (data || []).filter(h => {
    if (!h.expected_hatch_date) return false;
    const diff = Math.ceil((new Date(h.expected_hatch_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff <= 3 && diff >= 0;
  }).map(h => ({ ...h, days_remaining: Math.ceil((new Date(h.expected_hatch_date!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) }));
}

// ==================== TRANSACTIONS ====================

export async function getTransactions(): Promise<Transaction[]> {
  await getUserId();
  const { data, error } = await supabase.from('transactions').select('*').order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createTransaction(record: TransactionInsert): Promise<Transaction> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('transactions').insert({ ...record, user_id: userId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ==================== HEALTH LOGS ====================

export async function getHealthLogs(): Promise<HealthLog[]> {
  await getUserId();
  const { data, error } = await supabase.from('health_logs').select('*').order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createHealthLog(record: HealthLogInsert): Promise<HealthLog> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('health_logs').insert({ ...record, user_id: userId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getHenHealthLogs(henId: string): Promise<HealthLog[]> {
  const { data, error } = await supabase.from('health_logs').select('*').eq('hen_id', henId).order('date', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ==================== FEEDBACK ====================

export async function submitFeedback(feedbackData: FeedbackInsert): Promise<Feedback> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('feedback').insert({ ...feedbackData, user_id: userId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getUserFeedback(): Promise<Feedback[]> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('feedback').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ==================== DAILY CHORES ====================

export async function getDailyChores(): Promise<DailyChoreWithCompletion[]> {
  await getUserId();
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: chores, error } = await supabase
    .from('daily_chores')
    .select('*')
    .order('sort_order');
  if (error) throw new Error(error.message);

  const { data: completions } = await supabase
    .from('chore_completions')
    .select('chore_id')
    .eq('completed_date', today);

  const completedIds = new Set((completions || []).map(c => c.chore_id));
  return (chores || []).map(c => ({ ...c, completed: completedIds.has(c.id) }));
}

export async function completeChore(choreId: string): Promise<void> {
  const userId = await getUserId();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { error } = await supabase.from('chore_completions').insert({ chore_id: choreId, user_id: userId, completed_date: today });
  if (error) throw new Error(error.message);

  const { data: chore } = await supabase.from('daily_chores').select('recurrence, next_due_at').eq('id', choreId).single();
  if (chore && chore.recurrence && chore.recurrence !== 'none' && chore.next_due_at) {
    const current = new Date(chore.next_due_at);
    const next = new Date(current);
    if (chore.recurrence === 'daily') next.setDate(next.getDate() + 1);
    else if (chore.recurrence === 'weekly') next.setDate(next.getDate() + 7);
    else if (chore.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
    await supabase.from('daily_chores').update({ next_due_at: next.toISOString() }).eq('id', choreId);
  }
}

export async function uncompleteChore(choreId: string): Promise<void> {
  await getUserId();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { error } = await supabase.from('chore_completions').delete().eq('chore_id', choreId).eq('completed_date', today);
  if (error) throw new Error(error.message);
}

export async function createChore(title: string, description?: string, options?: { recurrence?: string; next_due_at?: string; reminder_enabled?: boolean; reminder_hours_before?: number }) {
  const userId = await getUserId();
  const { data, error } = await supabase
    .from('daily_chores')
    .insert({
      title,
      description: description || null,
      user_id: userId,
      is_default: false,
      recurrence: options?.recurrence || 'none',
      next_due_at: options?.next_due_at || null,
      reminder_enabled: options?.reminder_enabled || false,
      reminder_hours_before: options?.reminder_hours_before || 24,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateChore(choreId: string, updates: { recurrence?: string; next_due_at?: string | null; reminder_enabled?: boolean; reminder_hours_before?: number }): Promise<void> {
  const { error } = await supabase.from('daily_chores').update(updates).eq('id', choreId);
  if (error) throw new Error(error.message);
}

export async function deleteChore(choreId: string): Promise<void> {
  await getUserId();
  const { error } = await supabase.from('daily_chores').delete().eq('id', choreId);
  if (error) throw new Error(error.message);
}

// ==================== COOP SETTINGS ====================

export async function getCoopSettings(): Promise<CoopSettings> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('coop_settings').select('*').limit(1).maybeSingle();
  if (error && error.code !== 'PGRST116') throw new Error(error.message);
  if (data) return data;
  const { data: newData, error: insertError } = await supabase
    .from('coop_settings')
    .insert({ user_id: userId })
    .select()
    .single();
  if (insertError) throw new Error(insertError.message);
  return newData;
}

export async function updateCoopSettings(settings: CoopSettingsUpdate): Promise<CoopSettings> {
  const userId = await getUserId();

  // Hitta befintlig rad för aktuell användare (RLS gör att vi bara ser egna/gårdens rader)
  const { data: existing, error: selectError } = await supabase
    .from('coop_settings')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();
  if (selectError) throw new Error(selectError.message);

  if (existing?.id) {
    const { data, error } = await supabase
      .from('coop_settings')
      .update(settings)
      .eq('id', existing.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('Kunde inte uppdatera inställningarna. Försök igen.');
    return data;
  }

  // Ingen rad än – skapa en ny för användaren
  const { data, error } = await supabase
    .from('coop_settings')
    .insert({ ...settings, user_id: userId })
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('Kunde inte spara inställningarna. Försök igen.');
  return data;
}

// ==================== FLOCKS ====================

export async function getFlocks(): Promise<Flock[]> {
  await getUserId();
  const { data, error } = await supabase.from('flocks').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getOrCreateDefaultFlock(): Promise<Flock> {
  const userId = await getUserId();
  const { data: existing } = await supabase.from('flocks').select('*').eq('name', 'Min flock').maybeSingle();
  if (existing) return existing;
  const { data, error } = await supabase.from('flocks').insert({ name: 'Min flock', description: 'Standardflock', user_id: userId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function createFlock(flockData: FlockInsert): Promise<Flock> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('flocks').insert({ ...flockData, user_id: userId }).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateFlock(id: string, flockData: FlockUpdate): Promise<Flock> {
  const { data, error } = await supabase.from('flocks').update(flockData).eq('id', id).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteFlock(id: string): Promise<void> {
  const { error } = await supabase.from('flocks').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ==================== REMINDER SETTINGS ====================

export async function getReminderSettings(): Promise<ReminderSettings> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('reminder_settings').select('*').eq('user_id', userId).single();
  if (error && error.code === 'PGRST116') {
    const { data: newData, error: insertError } = await supabase
      .from('reminder_settings')
      .insert({ user_id: userId })
      .select()
      .single();
    if (insertError) throw new Error(insertError.message);
    return newData;
  }
  if (error) throw new Error(error.message);
  return data;
}

export async function updateReminderSettings(settings: ReminderSettingsUpdate): Promise<ReminderSettings> {
  const userId = await getUserId();
  const { data, error } = await supabase.from('reminder_settings').update(settings).eq('user_id', userId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

// ==================== STATISTICS (computed client-side) ====================

export async function getTodayStats() {
  await getUserId();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [eggs, hens, feed] = await Promise.all([
    supabase.from('egg_logs').select('count').eq('date', today),
    // Endast vuxna värphöns räknas i "antal höns" som statistiken jämför mot.
    supabase.from('hens').select('id').eq('is_active', true).eq('hen_type', 'hen'),
    supabase.from('feed_records').select('amount_kg, cost').eq('date', today),
  ]);
  const eggCount = (eggs.data || []).reduce((s, r) => s + r.count, 0);
  const henCount = (hens.data || []).length;
  const feedKg = (feed.data || []).reduce((s, r) => s + (r.amount_kg || 0), 0);
  const feedCost = (feed.data || []).reduce((s, r) => s + (r.cost || 0), 0);
  return { eggs: eggCount, hens: henCount, feed_kg: feedKg, feed_cost: feedCost, date: today };
}

export async function getMonthStats(year: number, month: number) {
  await getUserId();
  const start = format(startOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
  const end = format(endOfMonth(new Date(year, month - 1)), 'yyyy-MM-dd');
  const { data: eggs } = await supabase.from('egg_logs').select('*').gte('date', start).lte('date', end).order('date');
  const { data: feed } = await supabase.from('feed_records').select('*').gte('date', start).lte('date', end);
  const { data: txns } = await supabase.from('transactions').select('*').gte('date', start).lte('date', end);
  return {
    eggs: eggs || [],
    feed: feed || [],
    transactions: txns || [],
    total_eggs: (eggs || []).reduce((s, r) => s + r.count, 0),
    total_feed_cost: (feed || []).reduce((s, r) => s + (r.cost || 0), 0),
  };
}

export async function getYearStats(year: number) {
  await getUserId();
  const start = format(startOfYear(new Date(year, 0)), 'yyyy-MM-dd');
  const end = format(endOfYear(new Date(year, 0)), 'yyyy-MM-dd');
  const { data: eggs } = await supabase.from('egg_logs').select('*').gte('date', start).lte('date', end);
  const { data: txns } = await supabase.from('transactions').select('*').gte('date', start).lte('date', end);
  return {
    total_eggs: (eggs || []).reduce((s, r) => s + r.count, 0),
    transactions: txns || [],
    monthly_eggs: eggs || [],
  };
}

export async function getSummaryStats() {
  await getUserId();
  const [eggsRes, hensRes, txnsRes] = await Promise.all([
    supabase.from('egg_logs').select('count, date'),
    supabase.from('hens').select('id').eq('is_active', true).eq('hen_type', 'hen'),
    supabase.from('transactions').select('amount, type'),
  ]);
  const eggs = eggsRes.data || [];
  const totalEggs = eggs.reduce((s, r) => s + r.count, 0);
  const activeHens = (hensRes.data || []).length;
  const income = (txnsRes.data || []).filter(t => t.type === 'income').reduce((s, r) => s + r.amount, 0);
  const expense = (txnsRes.data || []).filter(t => t.type === 'expense').reduce((s, r) => s + r.amount, 0);

  const dailyCounts: Record<string, number> = {};
  eggs.forEach(e => { dailyCounts[e.date] = (dailyCounts[e.date] || 0) + e.count; });
  const days = Object.keys(dailyCounts);
  const avgPerDay = days.length > 0 ? totalEggs / days.length : 0;
  const bestDayEntry = days.length > 0 ? days.reduce((best, d) => dailyCounts[d] > dailyCounts[best] ? d : best, days[0]) : null;
  const bestDay = bestDayEntry ? `${dailyCounts[bestDayEntry]} (${new Date(bestDayEntry).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })})` : '–';
  const productivity = activeHens > 0 && days.length > 0 ? (avgPerDay / activeHens) * 100 : 0;

  return {
    total_eggs: totalEggs,
    active_hens: activeHens,
    total_income: income,
    total_expense: expense,
    profit: income - expense,
    avg_per_day: avgPerDay,
    best_day: bestDay,
    productivity,
  };
}

export async function getYesterdaySummary() {
  await getUserId();
  const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  const { data: eggs } = await supabase.from('egg_logs').select('count').eq('date', yesterday);
  const eggCount = (eggs || []).reduce((s, r) => s + r.count, 0);
  return { date: yesterday, eggs: eggCount };
}

export async function getFarmToday() {
  await getUserId();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [eggs, hens, chores] = await Promise.all([
    supabase.from('egg_logs').select('count').eq('date', today),
    supabase.from('hens').select('id, name').eq('is_active', true).eq('hen_type', 'hen'),
    getDailyChores(),
  ]);
  return {
    eggs_today: (eggs.data || []).reduce((s, r) => s + r.count, 0),
    active_hens: (hens.data || []).length,
    chores_completed: chores.filter(c => c.completed).length,
    chores_total: chores.length,
  };
}

// ==================== WEATHER (direct API) ====================

export async function getWeather(lat = 59.33, lon = 18.07) {
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weathercode&timezone=auto`);
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

// ==================== AI (via edge function) ====================

export async function getDailyTip() {
  const { data, error } = await supabase.functions.invoke('get-daily-tip');
  if (error) throw new Error(error.message);
  return data;
}

export type CoachAdvice = {
  title: string;
  text: string;
  type: 'pepp' | 'påminnelse' | 'varning' | 'tips';
  cta?: { label: string; path: string };
};

export type CoachResponse = {
  intro?: string | null;
  advices: CoachAdvice[];
};

export async function getDashboardCoach(context: Record<string, unknown>): Promise<CoachResponse> {
  const { data, error } = await supabase.functions.invoke('dashboard-coach', { body: context });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || !Array.isArray((data as { advices?: unknown }).advices)) {
    throw new Error('Invalid coach response');
  }
  return data as CoachResponse;
}

// ==================== DEVIATION ALERTS ====================

export type DeviationAlertLevel = 'info' | 'tips' | 'viktigt';

export type DeviationAlert = {
  key: string;
  title: string;
  text: string;
  level: DeviationAlertLevel;
  cta?: { label: string; path: string };
};

export type DeviationAlertResponse = {
  intro?: string | null;
  alerts: DeviationAlert[];
};

export async function getDashboardAlerts(context: Record<string, unknown>): Promise<DeviationAlertResponse> {
  const { data, error } = await supabase.functions.invoke('dashboard-alerts', { body: context });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || !Array.isArray((data as { alerts?: unknown }).alerts)) {
    throw new Error('Invalid alerts response');
  }
  return data as DeviationAlertResponse;
}

// ==================== HEALTH NOTE HELPER ====================

export type HealthNoteHelperContext = {
  noteText: string;
  henName?: string;
  henBreed?: string | null;
  henAgeYears?: number | null;
  recentNotes?: { date: string; description: string }[];
};

export type HealthNoteHelperResponse = {
  observe_title: string;
  observe_text: string;
  checklist: string[];
  improved_note: string;
  next_steps: { title: string; text: string }[];
};

export async function getHealthNoteHelp(ctx: HealthNoteHelperContext): Promise<HealthNoteHelperResponse> {
  const { data, error } = await supabase.functions.invoke('health-note-helper', { body: ctx });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || typeof (data as { observe_text?: unknown }).observe_text !== 'string') {
    throw new Error('Invalid helper response');
  }
  return data as HealthNoteHelperResponse;
}

// ==================== PREMIUM ====================

export async function getPremiumStatus() {
  const { data, error } = await supabase.functions.invoke('check-subscription');
  if (error) throw new Error(error.message);
  return { is_premium: data?.subscribed ?? false, status: data?.subscribed ? 'premium' : 'free', subscription_end: data?.subscription_end };
}

export async function createCheckoutSession(sessionData: { priceId: string }): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke('create-checkout', { body: sessionData });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelSubscription(): Promise<{ url: string }> {
  const { data, error } = await supabase.functions.invoke('customer-portal');
  if (error) throw new Error(error.message);
  return data;
}

// ==================== HEN ANALYTICS (computed) ====================

export async function getHenHealthScores(): Promise<HenWithHealthScore[]> {
  const hens = await getHens();
  const healthLogs = await getHealthLogs();
  return hens.map(hen => {
    const henLogs = healthLogs.filter(l => l.hen_id === hen.id);
    const recentIssues = henLogs.filter(l => {
      const d = new Date(l.date);
      return (Date.now() - d.getTime()) < 30 * 24 * 60 * 60 * 1000;
    }).length;
    return { ...hen, health_score: Math.max(0, 100 - recentIssues * 20) };
  });
}

export async function getProductivityAlerts(): Promise<ProductivityAlert[]> {
  const eggs = await getEggs();
  const hens = await getHens();
  // Endast vuxna värphöns räknas – unghöns/tuppar ska inte dra ner snittet.
  const activeHens = hens.filter(h => h.is_active && (h.hen_type ?? 'hen') === 'hen').length;
  if (activeHens === 0) return [];
  const last7 = eggs.filter(e => {
    const d = new Date(e.date);
    return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
  });
  const avgPerDay = last7.reduce((s, r) => s + r.count, 0) / 7;
  const alerts: ProductivityAlert[] = [];
  if (avgPerDay < activeHens * 0.3) {
    alerts.push({ type: 'low_production', message: 'Äggproduktionen är ovanligt låg senaste veckan.' });
  }
  return alerts;
}

// ==================== STREAK (unified – based on egg_logs) ====================

export async function getStreak() {
  const eggs = await getEggs();
  const streak = calculateStreakFromEggs(eggs);
  return { current_streak: streak, last_activity: eggs[0]?.date ?? null };
}

export async function touchStreak() {
  const eggs = await getEggs();
  return { current_streak: calculateStreakFromEggs(eggs) };
}

function calculateStreakFromEggs(eggs: EggLog[]): number {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const hasEggs = eggs.some(e => e.date === dateStr && e.count > 0);
    if (hasEggs) streak++;
    else if (i > 0) break;
    else continue;
  }
  return streak;
}

// ==================== STATISTICS INSIGHTS (real) ====================

export async function getStatisticsInsights() {
  await getUserId();
  const [eggsRes, txnsRes, feedRes, hensRes] = await Promise.all([
    supabase.from('egg_logs').select('count, date, hen_id'),
    supabase.from('transactions').select('amount, type, date'),
    supabase.from('feed_records').select('cost, amount_kg, date'),
    supabase.from('hens').select('id, name, is_active, hen_type'),
  ]);

  const eggs = eggsRes.data || [];
  const txns = txnsRes.data || [];
  const feed = feedRes.data || [];
  // Exkludera tuppar och unghöns från statistik-snitt (unghöns har ännu inte börjat värpa).
  const hens = (hensRes.data || []).filter(h => (h.hen_type ?? 'hen') === 'hen');

  const tips: string[] = [];

  const totalEggs = eggs.reduce((s, r) => s + r.count, 0);
  const totalIncome = txns.filter(t => t.type === 'income').reduce((s, r) => s + r.amount, 0);
  const revenuePerEgg = totalEggs > 0 ? totalIncome / totalEggs : 0;

  const now = new Date();
  const thisWeekEggs = eggs.filter(e => {
    const diff = (now.getTime() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  }).reduce((s, r) => s + r.count, 0);
  const lastWeekEggs = eggs.filter(e => {
    const diff = (now.getTime() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24);
    return diff > 7 && diff <= 14;
  }).reduce((s, r) => s + r.count, 0);

  if (lastWeekEggs > 0) {
    const change = Math.round(((thisWeekEggs - lastWeekEggs) / lastWeekEggs) * 100);
    if (change > 10) tips.push(`Äggproduktionen ökade med ${change}% jämfört med förra veckan – bra jobbat! 🎉`);
    else if (change < -10) tips.push(`Äggproduktionen minskade med ${Math.abs(change)}% jämfört med förra veckan. Kontrollera foder och ljus.`);
    else tips.push(`Äggproduktionen är stabil jämfört med förra veckan.`);
  }

  const activeHens = hens.filter(h => h.is_active).length;
  if (activeHens > 0 && totalEggs > 0) {
    const dailyCounts: Record<string, number> = {};
    eggs.forEach(e => { dailyCounts[e.date] = (dailyCounts[e.date] || 0) + e.count; });
    const avgPerDay = Object.keys(dailyCounts).length > 0 ? totalEggs / Object.keys(dailyCounts).length : 0;
    const rate = (avgPerDay / activeHens) * 100;
    if (rate > 70) tips.push(`Produktiviteten är ${Math.round(rate)}% – dina hönor presterar utmärkt! 🏆`);
    else if (rate < 40) tips.push(`Produktiviteten är ${Math.round(rate)}% – det kan vara ruggning, ålder eller foderkvalitet.`);
  }

  const totalFeedCost = feed.reduce((s, r) => s + (r.cost || 0), 0);
  if (totalFeedCost > 0 && totalEggs > 0) {
    const costPerEgg = totalFeedCost / totalEggs;
    tips.push(`Foderkostnad per ägg: ${costPerEgg.toFixed(2)} kr. ${costPerEgg > 5 ? 'Överväg att jämföra fodertyper.' : 'Det är en bra kostnad!'}`);
  }

  if (eggs.some(e => e.hen_id)) {
    const henCounts: Record<string, number> = {};
    eggs.filter(e => e.hen_id).forEach(e => { henCounts[e.hen_id!] = (henCounts[e.hen_id!] || 0) + e.count; });
    const topId = Object.entries(henCounts).sort(([, a], [, b]) => b - a)[0];
    if (topId) {
      const topHen = hens.find(h => h.id === topId[0]);
      if (topHen) tips.push(`${topHen.name} är din bästa värpare med ${topId[1]} ägg totalt! 🐔`);
    }
  }

  if (tips.length === 0) {
    tips.push('Samla mer data för att se detaljerade insikter om din hönsgård.');
  }

  return { tips, revenue_per_egg: revenuePerEgg };
}

/** Get hens with computed egg totals from egg_logs */
export async function getHensWithEggTotals(): Promise<HenWithEggTotal[]> {
  await getUserId();
  const [hensRes, eggsRes] = await Promise.all([
    supabase.from('hens').select('*').order('created_at', { ascending: false }),
    supabase.from('egg_logs').select('hen_id, count'),
  ]);
  if (hensRes.error) throw new Error(hensRes.error.message);
  const hens = hensRes.data || [];
  const eggs = eggsRes.data || [];

  const henEggCounts: Record<string, number> = {};
  eggs.filter(e => e.hen_id).forEach(e => {
    henEggCounts[e.hen_id!] = (henEggCounts[e.hen_id!] || 0) + e.count;
  });

  return hens.map(hen => ({
    ...hen,
    total_eggs: henEggCounts[hen.id] || 0,
  }));
}




/** Flock statistics – egg totals, weekly/monthly breakdown per flock */
export async function getFlockStatistics(): Promise<{ flocks: FlockStat[]; unassigned_eggs: number }> {
  await getUserId();
  const [flocksRes, eggsRes, hensRes] = await Promise.all([
    supabase.from('flocks').select('*'),
    supabase.from('egg_logs').select('count, date, flock_id, hen_id'),
    supabase.from('hens').select('id, name, flock_id, is_active, hen_type'),
  ]);

  const flocks = flocksRes.data || [];
  const eggs = eggsRes.data || [];
  const hens = hensRes.data || [];
  const now = new Date();

  const flockStats: FlockStat[] = flocks.map(flock => {
    const directEggs = eggs.filter(e => e.flock_id === flock.id);
    const flockHenIds = new Set(hens.filter(h => h.flock_id === flock.id).map(h => h.id));
    const henEggs = eggs.filter(e => !e.flock_id && e.hen_id && flockHenIds.has(e.hen_id));
    const allFlockEggs = [...directEggs, ...henEggs];

    const totalEggs = allFlockEggs.reduce((s, e) => s + e.count, 0);

    const weekEggs = allFlockEggs.filter(e => {
      const diff = (now.getTime() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7;
    }).reduce((s, e) => s + e.count, 0);

    const monthEggs = allFlockEggs.filter(e => {
      const diff = (now.getTime() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 30;
    }).reduce((s, e) => s + e.count, 0);

    const prevWeekEggs = allFlockEggs.filter(e => {
      const diff = (now.getTime() - new Date(e.date).getTime()) / (1000 * 60 * 60 * 24);
      return diff > 7 && diff <= 14;
    }).reduce((s, e) => s + e.count, 0);

    const weekChange = prevWeekEggs > 0 ? Math.round(((weekEggs - prevWeekEggs) / prevWeekEggs) * 100) : null;

    const activeHensCount = hens.filter(h => h.flock_id === flock.id && h.is_active && (h.hen_type ?? 'hen') === 'hen').length;
    const dailyCounts: Record<string, number> = {};
    allFlockEggs.forEach(e => { dailyCounts[e.date] = (dailyCounts[e.date] || 0) + e.count; });
    const daysCount = Object.keys(dailyCounts).length;
    const avgPerDay = daysCount > 0 ? totalEggs / daysCount : 0;

    return {
      id: flock.id,
      name: flock.name,
      total_eggs: totalEggs,
      week_eggs: weekEggs,
      month_eggs: monthEggs,
      week_change: weekChange,
      active_hens: activeHensCount,
      avg_per_day: Math.round(avgPerDay * 10) / 10,
    };
  });

  const allFlockHenIds = new Set(hens.filter(h => h.flock_id).map(h => h.id));
  const unassigned = eggs.filter(e => !e.flock_id && (!e.hen_id || !allFlockHenIds.has(e.hen_id)));
  const unassignedTotal = unassigned.reduce((s, e) => s + e.count, 0);

  return { flocks: flockStats.sort((a, b) => b.total_eggs - a.total_eggs), unassigned_eggs: unassignedTotal };
}




// ==================== ADMIN ====================

export async function adminCheck() {
  const userId = await getUserId();
  const { data } = await supabase.rpc('has_role', { _user_id: userId, _role: 'admin' });
  return { is_admin: !!data };
}

export async function adminStats() {
  const [profiles, eggs, hens] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact' }),
    supabase.from('egg_logs').select('id', { count: 'exact' }),
    supabase.from('hens').select('id', { count: 'exact' }),
  ]);
  return { user_count: profiles.count || 0, egg_records: eggs.count || 0, hen_count: hens.count || 0 };
}

export async function adminUsers(): Promise<AdminUserProfile[]> {
  const [profilesRes, coopsRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    supabase.from('coop_settings').select('user_id, coop_name'),
  ]);
  if (profilesRes.error) throw new Error(profilesRes.error.message);
  const coopMap = new Map((coopsRes.data || []).map(c => [c.user_id, c.coop_name]));
  return (profilesRes.data || []).map(p => ({ ...p, coop_name: coopMap.get(p.user_id) || null }));
}

export async function adminFeedback(): Promise<AdminFeedbackItem[]> {
  const { data: feedbackData, error } = await supabase.from('feedback').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const userIds = [...new Set((feedbackData || []).map(f => f.user_id).filter(Boolean))];
  if (!userIds.length) return (feedbackData || []).map(f => ({ ...f, profile: null, sender_label: `Användare ${String(f.user_id).slice(0, 8)}` }));

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, display_name, email')
    .in('user_id', userIds);

  if (profilesError) {
    return (feedbackData || []).map(f => ({
      ...f,
      profile: null,
      sender_label: `Användare ${String(f.user_id).slice(0, 8)}`,
    }));
  }

  const profileMap: Record<string, Pick<Profile, 'user_id' | 'display_name' | 'email'>> = {};
  (profiles || []).forEach(p => { profileMap[p.user_id] = p; });

  return (feedbackData || []).map(f => ({
    ...f,
    profile: profileMap[f.user_id] || null,
    sender_label: profileMap[f.user_id]?.display_name || `Användare ${String(f.user_id).slice(0, 8)}`,
  }));
}

export async function adminReplyFeedback(feedbackId: string, userId: string, replyMessage: string) {
  const { data: profile } = await supabase.from('profiles').select('email, display_name').eq('user_id', userId).single();
  if (!profile?.email) throw new Error('Användaren har ingen e-postadress');
  
  const { error } = await supabase.functions.invoke('reply-feedback', {
    body: { feedback_id: feedbackId, to: profile.email, display_name: profile.display_name, message: replyMessage, user_id: userId },
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function adminUpdateFeedbackStatus(feedbackId: string, statusData: TablesUpdate<'feedback'>) {
  const { data, error } = await supabase.from('feedback').update(statusData).eq('id', feedbackId).select().single();
  if (error) throw new Error(error.message);
  return data;
}

export async function adminSubscriptions(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function adminDeleteUser(userId: string) {
  const { data, error } = await supabase.functions.invoke('admin-delete-user', {
    body: { user_id: userId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data ?? {};
}

export async function adminUpdateSubscription(userId: string, data: { is_premium: boolean; days?: string }) {
  if (!data.is_premium) {
    // Ta bort både premium och livstidsflagga
    await supabase.rpc('set_lifetime_premium', { _user_id: userId, _is_lifetime: false });
    const { error } = await supabase.from('profiles').update({
      subscription_status: 'free',
      premium_expires_at: null,
    }).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return {};
  }

  const selectedDays = data.days ?? '7';

  if (selectedDays === 'lifetime') {
    const { error } = await supabase.rpc('set_lifetime_premium', { _user_id: userId, _is_lifetime: true });
    if (error) throw new Error(error.message);
    return {};
  }

  // Tidsbegränsad premium – ta bort ev. livstidsflagga först, lägg sedan till dagar
  await supabase.rpc('set_lifetime_premium', { _user_id: userId, _is_lifetime: false });
  const days = Number(selectedDays);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
  const { error } = await supabase.rpc('grant_premium_days', { _user_id: userId, _days: safeDays });
  if (error) throw new Error(error.message);
  return {};
}

export async function adminAcceptTerms() {
  const userId = await getUserId();
  const { error } = await supabase.from('profiles').update({ terms_accepted_at: new Date().toISOString() }).eq('user_id', userId);
  if (error) throw new Error(error.message);
  return {};
}

// ==================== EGG GOALS ====================

export type EggGoal = Tables<'egg_goals'>;

async function getEggGoals(): Promise<EggGoal[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('egg_goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

async function upsertEggGoal(goal: { period: string; target_count: number; is_active?: boolean; id?: string }): Promise<EggGoal> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  if (goal.id) {
    const { data, error } = await supabase
      .from('egg_goals')
      .update({ target_count: goal.target_count, period: goal.period, is_active: goal.is_active ?? true })
      .eq('id', goal.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from('egg_goals')
    .insert({ user_id: user.id, period: goal.period, target_count: goal.target_count })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteEggGoal(id: string): Promise<void> {
  const { error } = await supabase.from('egg_goals').delete().eq('id', id);
  if (error) throw error;
}

// ==================== AGE ANALYTICS ====================

export interface AgeBucket {
  key: string;
  label: string;
  count: number;
}

export interface AgeCurvePoint {
  ageMonths: number;
  layingRatePct: number;
  henDays: number;
  eggs: number;
}

export interface AgeAnalytics {
  ageBuckets: AgeBucket[];
  totalActive: number;
  knownAge: number;
  over3yPct: number;
  curve: AgeCurvePoint[];
  attributedEggs: number;
}

export async function getAgeAnalytics(): Promise<AgeAnalytics> {
  const [hens, eggs] = await Promise.all([getHens(), getEggs()]);

  const now = new Date();
  const monthsBetween = (a: Date, b: Date) =>
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) +
    (b.getDate() >= a.getDate() ? 0 : -1);

  const activeLaying = (hens as any[]).filter(
    (h) => h.is_active && (h.hen_type ?? 'hen') === 'hen',
  );

  const buckets: AgeBucket[] = [
    { key: '0-6m', label: '0–6 mån', count: 0 },
    { key: '6-12m', label: '6–12 mån', count: 0 },
    { key: '1-2y', label: '1–2 år', count: 0 },
    { key: '2-3y', label: '2–3 år', count: 0 },
    { key: '3y+', label: '3+ år', count: 0 },
    { key: 'unknown', label: 'Okänd ålder', count: 0 },
  ];

  let over3 = 0;
  let knownAge = 0;
  for (const h of activeLaying) {
    if (!h.birth_date) {
      buckets[5].count += 1;
      continue;
    }
    const bd = new Date(h.birth_date);
    if (isNaN(bd.getTime())) {
      buckets[5].count += 1;
      continue;
    }
    knownAge += 1;
    const m = monthsBetween(bd, now);
    if (m < 6) buckets[0].count += 1;
    else if (m < 12) buckets[1].count += 1;
    else if (m < 24) buckets[2].count += 1;
    else if (m < 36) buckets[3].count += 1;
    else {
      buckets[4].count += 1;
      over3 += 1;
    }
  }

  const over3yPct = activeLaying.length > 0 ? (over3 / activeLaying.length) * 100 : 0;

  // Värpkurva: per åldersmånad (0–36) räkna ägg och höns-dagar.
  // Vi approximerar höns-dagar per åldersbucket via att räkna antalet
  // unika (hen, dag)-kombinationer i kurvan: använd alla egg_logs med
  // hen_id satt, och bygg upp en exponering = för varje höna räkna
  // antalet dagar i datasetet hon var aktiv per åldersmånad.
  const henById = new Map<string, any>();
  for (const h of hens as any[]) henById.set(h.id, h);

  const eggsByBucket = new Map<number, number>();
  let attributed = 0;
  for (const e of eggs as any[]) {
    if (!e.hen_id) continue;
    const h = henById.get(e.hen_id);
    if (!h || !h.birth_date) continue;
    const bd = new Date(h.birth_date);
    const ed = new Date(e.date);
    if (isNaN(bd.getTime()) || isNaN(ed.getTime())) continue;
    const m = monthsBetween(bd, ed);
    if (m < 0 || m > 60) continue;
    eggsByBucket.set(m, (eggsByBucket.get(m) || 0) + (e.count || 0));
    attributed += e.count || 0;
  }

  // Höns-dagar per åldersmånad: för varje attribuerande höna (med
  // birth_date), räkna antal dagar mellan max(created_at, birth_date)
  // och min(now, death_date) och fördela över åldersmånader.
  const DAY_MS = 24 * 60 * 60 * 1000;
  const daysByBucket = new Map<number, number>();
  for (const h of hens as any[]) {
    if (!h.birth_date) continue;
    if ((h.hen_type ?? 'hen') === 'rooster') continue;
    const bd = new Date(h.birth_date);
    const created = h.created_at ? new Date(h.created_at) : bd;
    const start = created > bd ? created : bd;
    const end = h.death_date ? new Date(h.death_date) : now;
    if (end <= start) continue;
    // Walk day by day (cap at ~5 years = 1825 iterations per hen)
    const totalDays = Math.min(2000, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start.getTime() + i * DAY_MS);
      const m = monthsBetween(bd, d);
      if (m < 0 || m > 60) continue;
      daysByBucket.set(m, (daysByBucket.get(m) || 0) + 1);
    }
  }

  const curve: AgeCurvePoint[] = [];
  for (let m = 0; m <= 36; m++) {
    const eCount = eggsByBucket.get(m) || 0;
    const dCount = daysByBucket.get(m) || 0;
    if (dCount === 0) continue;
    curve.push({
      ageMonths: m,
      henDays: dCount,
      eggs: eCount,
      layingRatePct: (eCount / dCount) * 100,
    });
  }

  return {
    ageBuckets: buckets,
    totalActive: activeLaying.length,
    knownAge,
    over3yPct,
    curve,
    attributedEggs: attributed,
  };
}

// Legacy compatibility: export as api object for existing imports

export const api = {
  getHens, createHen, updateHen, deleteHen, getHenProfile,
  getHenHealthScores, getProductivityAlerts,
  getHensWithEggTotals,
  getEggs, createEggRecord, deleteEggRecord, fetchEggLogWeatherSnapshot,
  getFeedRecords, createFeedRecord, deleteFeedRecord, getFeedInventory, getFeedStatistics,
  getHatchings, createHatching, updateHatching, deleteHatching, getHatchingAlerts,
  getTransactions, createTransaction, deleteTransaction,
  getHealthLogs, createHealthLog, getHenHealthLogs,
  submitFeedback, getUserFeedback,
  getDailyChores, completeChore, uncompleteChore, createChore, deleteChore, updateChore,
  getCoopSettings, updateCoopSettings,
  getFlocks, getOrCreateDefaultFlock, createFlock, updateFlock, deleteFlock,
  getReminderSettings, updateReminderSettings,
  getTodayStats, getMonthStats, getYearStats, getSummaryStats,
  getStatisticsInsights,
  getYesterdaySummary, getFarmToday,
  getWeather,
  getDailyTip,
  getPremiumStatus, createCheckoutSession, cancelSubscription,
  getStreak, touchStreak,
  getFlockStatistics,

  getEggGoals, upsertEggGoal, deleteEggGoal,
  adminCheck, adminStats, adminUsers, adminSubscriptions,
  adminFeedback, adminUpdateFeedbackStatus, adminReplyFeedback, adminDeleteUser, adminUpdateSubscription,
  adminAcceptTerms,
  getDashboardCoach,
  getDashboardAlerts,
  getHealthNoteHelp,
  getAgeAnalytics,
  getFlockSurvival,
  getFeedEfficiencyTrend,
  getHatchStatistics,
  getProductionForecast,
  getDaylightTempAnalysis,
  getProductionControlData,
  getDecomposition,
  getHenConsistency,
  getBreedingValues,
  getCohortAnalysis,
  getCorrelationMatrix,
};







// ==================== PRODUCTION FORECAST ====================

export interface ForecastDailyPoint {
  date: string; // YYYY-MM-DD
  label: string;
  actual: number | null;
  forecast: number | null;
}

export interface ProductionForecast {
  hasEnoughData: boolean;
  daysWithData: number;
  avgPerDay: number | null;
  slopePerDay: number | null;
  next7Total: number | null;
  next30Total: number | null;
  series: ForecastDailyPoint[];
  todayKey: string;
  goal: {
    targetCount: number;
    period: string;
    progressEggs: number;
    reachOnDate: string | null;
    reachOnLabel: string | null;
    daysToReach: number | null;
  } | null;
}

export async function getProductionForecast(): Promise<ProductionForecast> {
  const [eggsRes, goalsRes] = await Promise.all([
    supabase.from('egg_logs').select('date, count'),
    supabase.from('egg_goals').select('target_count, period, is_active').eq('is_active', true).limit(1),
  ]);

  const eggs = (eggsRes.data ?? []) as { date: string; count: number | null }[];
  const goalRow = (goalsRes.data ?? [])[0] as
    | { target_count: number; period: string; is_active: boolean }
    | undefined;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });

  // Aggregate per day
  const byDay = new Map<string, number>();
  for (const e of eggs) {
    if (!e.date) continue;
    const d = new Date(e.date);
    if (isNaN(d.getTime())) continue;
    const k = dayKey(d);
    byDay.set(k, (byDay.get(k) || 0) + (Number(e.count) || 0));
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = dayKey(today);

  if (byDay.size < 14) {
    return {
      hasEnoughData: false,
      daysWithData: byDay.size,
      avgPerDay: null,
      slopePerDay: null,
      next7Total: null,
      next30Total: null,
      series: [],
      todayKey,
      goal: null,
    };
  }

  // Last 28 days for trend fit (include zero days)
  const fitStart = new Date(today.getTime() - 27 * DAY_MS);
  const fitDays: { x: number; y: number; date: Date; key: string }[] = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(fitStart.getTime() + i * DAY_MS);
    const k = dayKey(d);
    fitDays.push({ x: i, y: byDay.get(k) || 0, date: d, key: k });
  }

  // Least squares y = a + b*x
  const n = fitDays.length;
  const sumX = fitDays.reduce((s, p) => s + p.x, 0);
  const sumY = fitDays.reduce((s, p) => s + p.y, 0);
  const sumXY = fitDays.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = fitDays.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  const b = denom !== 0 ? (n * sumXY - sumX * sumY) / denom : 0;
  const a = (sumY - b * sumX) / n;

  const predict = (x: number) => Math.max(0, a + b * x);

  // Future totals (next7, next30) starting tomorrow (x = 28..)
  let next7 = 0;
  for (let i = 0; i < 7; i++) next7 += predict(28 + i);
  let next30 = 0;
  for (let i = 0; i < 30; i++) next30 += predict(28 + i);

  const avgPerDay = sumY / n;

  // Build series: last 30 days actual + 14 days forecast
  const series: ForecastDailyPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    const k = dayKey(d);
    series.push({
      date: k,
      label: fmt.format(d),
      actual: byDay.get(k) || 0,
      forecast: null,
    });
  }
  // Today: show both for chart continuity
  const lastActual = series[series.length - 1];
  lastActual.forecast = lastActual.actual;
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today.getTime() + i * DAY_MS);
    const k = dayKey(d);
    series.push({
      date: k,
      label: fmt.format(d),
      actual: null,
      forecast: Math.round(predict(28 + i - 1) * 10) / 10,
    });
  }

  // Goal: how many eggs already logged in the goal's period, and when target is reached
  let goal: ProductionForecast['goal'] = null;
  if (goalRow && goalRow.target_count > 0) {
    const period = (goalRow.period || 'monthly').toLowerCase();
    let periodStart = new Date(today);
    if (period === 'weekly') {
      // ISO-ish: start on Monday
      const dow = (today.getDay() + 6) % 7;
      periodStart = new Date(today.getTime() - dow * DAY_MS);
    } else if (period === 'yearly') {
      periodStart = new Date(today.getFullYear(), 0, 1);
    } else {
      // monthly default
      periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    let progress = 0;
    for (const [k, v] of byDay.entries()) {
      const d = new Date(k);
      if (d >= periodStart && d <= today) progress += v;
    }
    const remaining = Math.max(0, goalRow.target_count - progress);
    let reachOnDate: string | null = null;
    let reachOnLabel: string | null = null;
    let daysToReach: number | null = null;
    if (remaining === 0) {
      reachOnDate = todayKey;
      reachOnLabel = fmt.format(today);
      daysToReach = 0;
    } else if (avgPerDay > 0) {
      // Cumulative forecast from tomorrow
      let cum = 0;
      for (let i = 1; i <= 365; i++) {
        cum += predict(28 + i - 1);
        if (cum >= remaining) {
          const d = new Date(today.getTime() + i * DAY_MS);
          reachOnDate = dayKey(d);
          reachOnLabel = fmt.format(d);
          daysToReach = i;
          break;
        }
      }
    }
    goal = {
      targetCount: goalRow.target_count,
      period,
      progressEggs: progress,
      reachOnDate,
      reachOnLabel,
      daysToReach,
    };
  }

  return {
    hasEnoughData: true,
    daysWithData: byDay.size,
    avgPerDay,
    slopePerDay: b,
    next7Total: Math.round(next7),
    next30Total: Math.round(next30),
    series,
    todayKey,
    goal,
  };
}


// ==================== HATCH STATISTICS ====================

export interface HatchSessionPoint {
  id: string;
  name: string;
  setDate: string;
  label: string;
  hatchRatePct: number | null;
  eggsSet: number;
  eggsHatched: number | null;
}

export interface HatchStatistics {
  fertilityRatePct: number | null;
  hatchRatePct: number | null;
  hatchOfFertilePct: number | null;
  survival7dPct: number | null;
  totalCompleted: number;
  sessions: HatchSessionPoint[];
}

// Status-värden som räknas som AVSLUTAD kläckning.
const COMPLETED_HATCH_STATUSES = new Set([
  'completed', 'complete', 'done', 'finished',
  'hatched', 'klar', 'avslutad', 'avslutat',
]);

export async function getHatchStatistics(): Promise<HatchStatistics> {
  const { data, error } = await supabase
    .from('hatch_sessions')
    .select('id, name, set_date, status, eggs_set, eggs_fertile, eggs_hatched, chicks_survived_7d, actual_hatch_date')
    .order('set_date', { ascending: true });

  if (error) throw new Error(error.message);

  const all = (data ?? []) as any[];
  const completed = all.filter((s) => {
    const st = (s.status || '').toString().toLowerCase().trim();
    if (COMPLETED_HATCH_STATUSES.has(st)) return true;
    // Fallback: behandla som klar om actual_hatch_date eller eggs_hatched satts
    if (s.actual_hatch_date) return true;
    if (s.eggs_hatched != null) return true;
    return false;
  });

  // Snitt-av-ratios beräknas per session (varje session med giltig nämnare),
  // sedan medel av ratios – mer rättvist än totalsumma.
  const avg = (vals: number[]) =>
    vals.length === 0 ? null : (vals.reduce((s, n) => s + n, 0) / vals.length) * 100;

  const fert: number[] = [];
  const hatch: number[] = [];
  const hatchOfFert: number[] = [];
  const surv: number[] = [];

  for (const s of completed) {
    const set = Number(s.eggs_set) || 0;
    const fertile = s.eggs_fertile != null ? Number(s.eggs_fertile) : null;
    const hatched = s.eggs_hatched != null ? Number(s.eggs_hatched) : null;
    const survived = s.chicks_survived_7d != null ? Number(s.chicks_survived_7d) : null;

    if (set > 0 && fertile != null) fert.push(fertile / set);
    if (set > 0 && hatched != null) hatch.push(hatched / set);
    if (fertile != null && fertile > 0 && hatched != null) hatchOfFert.push(hatched / fertile);
    if (hatched != null && hatched > 0 && survived != null) surv.push(survived / hatched);
  }

  const fmt = new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'short' });

  const sessions: HatchSessionPoint[] = completed
    .map((s) => {
      const set = Number(s.eggs_set) || 0;
      const hatched = s.eggs_hatched != null ? Number(s.eggs_hatched) : null;
      const rate = set > 0 && hatched != null ? (hatched / set) * 100 : null;
      const d = s.set_date ? new Date(s.set_date) : null;
      const dateLabel = d && !isNaN(d.getTime()) ? fmt.format(d) : '';
      return {
        id: s.id,
        name: s.name || 'Kläckning',
        setDate: s.set_date,
        label: dateLabel ? `${s.name} (${dateLabel})` : (s.name || dateLabel),
        hatchRatePct: rate,
        eggsSet: set,
        eggsHatched: hatched,
      };
    })
    .sort((a, b) => new Date(a.setDate).getTime() - new Date(b.setDate).getTime());

  return {
    fertilityRatePct: avg(fert),
    hatchRatePct: avg(hatch),
    hatchOfFertilePct: avg(hatchOfFert),
    survival7dPct: avg(surv),
    totalCompleted: completed.length,
    sessions,
  };
}


// ==================== FEED EFFICIENCY TREND ====================

export interface FeedMonthPoint {
  month: string; // YYYY-MM
  label: string;
  costPerEgg: number | null;
  kgPerDozen: number | null;
  eggs: number;
  kg: number;
  cost: number;
}

export interface FeedTypeStat {
  type: string;
  totalCost: number;
  totalKg: number;
  costPerKg: number | null;
}

export interface FeedEfficiencyTrend {
  months: FeedMonthPoint[];
  feedTypes: FeedTypeStat[];
  hasFeedRecords: boolean;
}

export async function getFeedEfficiencyTrend(): Promise<FeedEfficiencyTrend> {
  const [feed, eggs] = await Promise.all([
    supabase.from('feed_records').select('amount_kg, cost, feed_type, brand, date'),
    supabase.from('egg_logs').select('count, date'),
  ]);

  const feedRows = (feed.data ?? []) as any[];
  const eggRows = (eggs.data ?? []) as any[];

  const fmt = new Intl.DateTimeFormat('sv-SE', { month: 'short', year: '2-digit' });
  const now = new Date();

  const monthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Build 12-month skeleton
  const months: { key: string; label: string; date: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: fmt.format(d), date: d });
  }
  const monthSet = new Set(months.map((m) => m.key));

  const feedByMonth = new Map<string, { kg: number; cost: number }>();
  for (const r of feedRows) {
    if (!r.date) continue;
    const d = new Date(r.date);
    if (isNaN(d.getTime())) continue;
    const k = monthKey(d);
    if (!monthSet.has(k)) continue;
    const cur = feedByMonth.get(k) || { kg: 0, cost: 0 };
    cur.kg += Number(r.amount_kg) || 0;
    cur.cost += Number(r.cost) || 0;
    feedByMonth.set(k, cur);
  }

  const eggsByMonth = new Map<string, number>();
  for (const e of eggRows) {
    if (!e.date) continue;
    const d = new Date(e.date);
    if (isNaN(d.getTime())) continue;
    const k = monthKey(d);
    if (!monthSet.has(k)) continue;
    eggsByMonth.set(k, (eggsByMonth.get(k) || 0) + (Number(e.count) || 0));
  }

  const monthsOut: FeedMonthPoint[] = months.map((m) => {
    const f = feedByMonth.get(m.key) || { kg: 0, cost: 0 };
    const eggCount = eggsByMonth.get(m.key) || 0;
    const costPerEgg = eggCount > 0 && f.cost > 0 ? f.cost / eggCount : null;
    const kgPerDozen = eggCount > 0 && f.kg > 0 ? f.kg / (eggCount / 12) : null;
    return {
      month: m.key,
      label: m.label,
      costPerEgg,
      kgPerDozen,
      eggs: eggCount,
      kg: f.kg,
      cost: f.cost,
    };
  });

  // Feed types aggregation (all-time)
  const typeMap = new Map<string, { totalCost: number; totalKg: number }>();
  for (const r of feedRows) {
    const t =
      (r.feed_type && String(r.feed_type).trim()) ||
      (r.brand && String(r.brand).trim()) ||
      'Övrigt';
    const cur = typeMap.get(t) || { totalCost: 0, totalKg: 0 };
    cur.totalCost += Number(r.cost) || 0;
    cur.totalKg += Number(r.amount_kg) || 0;
    typeMap.set(t, cur);
  }
  const feedTypes: FeedTypeStat[] = Array.from(typeMap.entries())
    .map(([type, v]) => ({
      type,
      totalCost: v.totalCost,
      totalKg: v.totalKg,
      costPerKg: v.totalKg > 0 ? v.totalCost / v.totalKg : null,
    }))
    .sort((a, b) => b.totalCost - a.totalCost);

  return {
    months: monthsOut,
    feedTypes,
    hasFeedRecords: feedRows.length > 0,
  };
}


// ==================== FLOCK SURVIVAL ====================

export interface FlockSizePoint {
  month: string; // YYYY-MM
  label: string; // sv-SE
  alive: number;
}

export interface DeathCauseCount {
  cause: string;
  count: number;
}

export interface FlockSurvival {
  timeline: FlockSizePoint[];
  mortalityPct12m: number | null;
  deaths12m: number;
  avgFlockSize12m: number;
  avgLifespanDays: number | null;
  lossesThisYear: number;
  causes: DeathCauseCount[];
  totalDeaths: number;
}

export async function getFlockSurvival(): Promise<FlockSurvival> {
  const hens = (await getHens()) as any[];

  const now = new Date();
  const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
  const fmt = new Intl.DateTimeFormat('sv-SE', { month: 'short', year: '2-digit' });

  // Build 12 month buckets ending this month
  const months: { date: Date; key: string; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months.push({ date: d, key, label: fmt.format(d) });
  }

  // For each month end, count alive = created_at <= monthEnd AND (death_date is null OR death_date > monthEnd)
  const timeline: FlockSizePoint[] = months.map((m) => {
    const monthEnd = new Date(m.date.getFullYear(), m.date.getMonth() + 1, 0, 23, 59, 59);
    let alive = 0;
    for (const h of hens) {
      const created = h.created_at ? new Date(h.created_at) : null;
      if (!created || created > monthEnd) continue;
      const died = h.death_date ? new Date(h.death_date) : null;
      if (died && died <= monthEnd) continue;
      alive += 1;
    }
    return { month: m.key, label: m.label, alive };
  });

  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  let deaths12m = 0;
  let lossesThisYear = 0;
  const lifespans: number[] = [];
  const causeMap = new Map<string, number>();
  let totalDeaths = 0;

  for (const h of hens) {
    if (!h.death_date) continue;
    totalDeaths += 1;
    const dd = new Date(h.death_date);
    if (isNaN(dd.getTime())) continue;
    if (dd >= twelveMonthsAgo) deaths12m += 1;
    if (dd.getFullYear() === now.getFullYear()) lossesThisYear += 1;
    if (h.birth_date) {
      const bd = new Date(h.birth_date);
      if (!isNaN(bd.getTime()) && dd > bd) {
        lifespans.push(Math.floor((dd.getTime() - bd.getTime()) / (24 * 60 * 60 * 1000)));
      }
    }
    const cause = (h.death_cause || '').toString().trim() || 'Okänd';
    causeMap.set(cause, (causeMap.get(cause) || 0) + 1);
  }

  const avgFlockSize12m =
    timeline.reduce((s, p) => s + p.alive, 0) / Math.max(1, timeline.length);
  const mortalityPct12m =
    avgFlockSize12m > 0 ? (deaths12m / avgFlockSize12m) * 100 : null;
  const avgLifespanDays =
    lifespans.length > 0 ? lifespans.reduce((s, n) => s + n, 0) / lifespans.length : null;

  const causes: DeathCauseCount[] = Array.from(causeMap.entries())
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count);

  return {
    timeline,
    mortalityPct12m,
    deaths12m,
    avgFlockSize12m,
    avgLifespanDays,
    lossesThisYear,
    causes,
    totalDeaths,
  };
}



// ==================== DAYLIGHT & TEMP REGRESSION ====================

export interface DaylightScatterPoint {
  date: string;
  label: string;
  daylightHours: number;
  eggsPerHen: number;
  temp?: number | null;
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
  xMin: number;
  xMax: number;
}

export interface DaylightTempAnalysis {
  latitude: number;
  latitudeSource: 'coop_settings' | 'weather' | 'fallback';
  daysWithData: number;
  daylightPoints: DaylightScatterPoint[];
  tempPoints: DaylightScatterPoint[];
  daylightRegression: RegressionResult | null;
  tempRegression: RegressionResult | null;
  daylightInsight: string | null;
  tempInsight: string | null;
}

function linearRegression(xs: number[], ys: number[]): RegressionResult | null {
  const n = xs.length;
  if (n < 2) return null;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
    ssTot += (ys[i] - meanY) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  const intercept = meanY - slope * meanX;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i];
    ssRes += (ys[i] - pred) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
  return {
    slope,
    intercept,
    r2,
    n,
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
  };
}

function daylightHoursFor(dateISO: string, latitude: number): number {
  const d = new Date(dateISO + 'T12:00:00Z');
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  const diff = d.getTime() - start.getTime();
  const N = Math.floor(diff / (1000 * 60 * 60 * 24));
  const delta = 0.4093 * Math.sin((2 * Math.PI * (N - 81)) / 365);
  const latRad = (latitude * Math.PI) / 180;
  let cosH = -Math.tan(latRad) * Math.tan(delta);
  if (cosH > 1) cosH = 1;
  if (cosH < -1) cosH = -1;
  return (24 / Math.PI) * Math.acos(cosH);
}

function extractTemp(weather: any): number | null {
  if (!weather || typeof weather !== 'object') return null;
  const cur = weather.current?.temperature_2m;
  if (typeof cur === 'number') return cur;
  const max = weather.daily?.temperature_2m_max?.[0];
  const min = weather.daily?.temperature_2m_min?.[0];
  if (typeof max === 'number' && typeof min === 'number') return (max + min) / 2;
  if (typeof max === 'number') return max;
  if (typeof min === 'number') return min;
  return null;
}

function extractLat(weather: any): number | null {
  if (!weather || typeof weather !== 'object') return null;
  const candidates = [weather.lat, weather.latitude, weather.location?.lat, weather.location?.latitude];
  for (const c of candidates) {
    if (typeof c === 'number' && isFinite(c)) return c;
  }
  return null;
}

export async function getDaylightTempAnalysis(): Promise<DaylightTempAnalysis> {
  const [eggsRes, hensRes, coopRes] = await Promise.all([
    supabase.from('egg_logs').select('date, count, weather'),
    supabase.from('hens').select('created_at, death_date, hen_type'),
    supabase.from('coop_settings').select('latitude').limit(1),
  ]);

  const eggs = (eggsRes.data ?? []) as { date: string; count: number | null; weather: any }[];
  const hens = (hensRes.data ?? []) as { created_at: string; death_date: string | null; hen_type: string | null }[];
  const coopRow = (coopRes.data ?? [])[0] as { latitude: number | null } | undefined;

  // Resolve latitude
  let latitude: number;
  let latitudeSource: DaylightTempAnalysis['latitudeSource'];
  if (coopRow?.latitude != null && isFinite(Number(coopRow.latitude))) {
    latitude = Number(coopRow.latitude);
    latitudeSource = 'coop_settings';
  } else {
    let fromWeather: number | null = null;
    for (const log of eggs) {
      const lat = extractLat(log.weather);
      if (lat != null) {
        fromWeather = lat;
        break;
      }
    }
    if (fromWeather != null) {
      latitude = fromWeather;
      latitudeSource = 'weather';
    } else {
      latitude = 59.3;
      latitudeSource = 'fallback';
    }
  }

  // Aggregate eggs per day & keep one weather per day (prefer one with temp)
  const dayMap = new Map<string, { count: number; weather: any }>();
  for (const e of eggs) {
    if (!e.date) continue;
    const cur = dayMap.get(e.date) ?? { count: 0, weather: null };
    cur.count += e.count ?? 0;
    if (cur.weather == null || (extractTemp(cur.weather) == null && extractTemp(e.weather) != null)) {
      cur.weather = e.weather;
    }
    dayMap.set(e.date, cur);
  }

  const hensList = hens.filter((h) => (h.hen_type ?? 'hen') === 'hen');

  function activeHensOn(dateISO: string): number {
    const d = new Date(dateISO + 'T23:59:59Z').getTime();
    let n = 0;
    for (const h of hensList) {
      const created = h.created_at ? new Date(h.created_at).getTime() : 0;
      if (created > d) continue;
      if (h.death_date) {
        const dd = new Date(h.death_date + 'T00:00:00Z').getTime();
        if (dd <= d) continue;
      }
      n++;
    }
    return n;
  }

  const fmt = new Intl.DateTimeFormat('sv-SE', { day: '2-digit', month: 'short' });

  const daylightPoints: DaylightScatterPoint[] = [];
  const tempPoints: DaylightScatterPoint[] = [];

  const sortedDates = Array.from(dayMap.keys()).sort();
  for (const date of sortedDates) {
    const { count, weather } = dayMap.get(date)!;
    const active = activeHensOn(date);
    if (active <= 0) continue;
    const eggsPerHen = count / active;
    const dh = daylightHoursFor(date, latitude);
    const label = fmt.format(new Date(date + 'T12:00:00Z'));
    const temp = extractTemp(weather);
    const point: DaylightScatterPoint = {
      date,
      label,
      daylightHours: Math.round(dh * 100) / 100,
      eggsPerHen: Math.round(eggsPerHen * 1000) / 1000,
      temp: temp != null ? Math.round(temp * 10) / 10 : null,
    };
    daylightPoints.push(point);
    if (temp != null) tempPoints.push(point);
  }

  const MIN = 20;

  const daylightRegression =
    daylightPoints.length >= MIN
      ? linearRegression(
          daylightPoints.map((p) => p.daylightHours),
          daylightPoints.map((p) => p.eggsPerHen),
        )
      : null;

  const tempRegression =
    tempPoints.length >= MIN
      ? linearRegression(
          tempPoints.map((p) => p.temp as number),
          tempPoints.map((p) => p.eggsPerHen),
        )
      : null;

  function pctPerUnit(reg: RegressionResult): number | null {
    const midX = (reg.xMin + reg.xMax) / 2;
    const midY = reg.intercept + reg.slope * midX;
    if (midY <= 0) return null;
    return (reg.slope / midY) * 100;
  }

  let daylightInsight: string | null = null;
  if (daylightRegression) {
    const pct = pctPerUnit(daylightRegression);
    if (pct != null) {
      const abs = Math.abs(pct).toFixed(0);
      if (pct > 1) {
        daylightInsight = `Värpningen stiger med ungefär ${abs}% per extra ljustimme – ljuset triggar äggläggningen.`;
      } else if (pct < -1) {
        daylightInsight = `Värpningen faller ungefär ${abs}% per förlorad ljustimme – väntat under den mörka årstiden.`;
      } else {
        daylightInsight = 'Dagsljuset verkar inte påverka din flock särskilt mycket just nu.';
      }
      daylightInsight += ` Förklaringsgrad R²=${daylightRegression.r2.toFixed(2)}.`;
    }
  }

  let tempInsight: string | null = null;
  if (tempRegression) {
    const pct = pctPerUnit(tempRegression);
    if (pct != null) {
      const abs = Math.abs(pct).toFixed(0);
      if (pct > 1) {
        tempInsight = `Värmen hjälper – värpningen ökar ungefär ${abs}% per grad varmare.`;
      } else if (pct < -1) {
        tempInsight = `Värpningen minskar ungefär ${abs}% per grad varmare – kan vara sommarvärme som stressar.`;
      } else {
        tempInsight = 'Temperaturen verkar ha liten effekt på värpningen i din flock.';
      }
      tempInsight += ` Förklaringsgrad R²=${tempRegression.r2.toFixed(2)}.`;
    }
  }

  return {
    latitude,
    latitudeSource,
    daysWithData: daylightPoints.length,
    daylightPoints,
    tempPoints,
    daylightRegression,
    tempRegression,
    daylightInsight,
    tempInsight,
  };
}

// ==================== PRODUCTION CONTROL CHART ====================

export interface ControlPoint {
  date: string;
  label: string;
  count: number;
  mean: number | null;
  ucl2: number | null;
  lcl2: number | null;
  ucl3: number | null;
  lcl3: number | null;
  z: number | null;
  outOf2: boolean;
  direction: 'above' | 'below' | null;
}

export interface ProductionControlData {
  windowSize: number;
  hasEnoughData: boolean;
  daysWithData: number;
  series: ControlPoint[];
  latest: ControlPoint | null;
  yesterdayLabel: string | null;
}

export async function getProductionControlData(windowSize: 14 | 28 = 28): Promise<ProductionControlData> {
  const res = await supabase.from('egg_logs').select('date, count');
  const rows = (res.data ?? []) as { date: string; count: number | null }[];

  if (rows.length === 0) {
    return { windowSize, hasEnoughData: false, daysWithData: 0, series: [], latest: null, yesterdayLabel: null };
  }

  const dayTotals = new Map<string, number>();
  for (const r of rows) {
    if (!r.date) continue;
    dayTotals.set(r.date, (dayTotals.get(r.date) ?? 0) + (r.count ?? 0));
  }

  const sorted = Array.from(dayTotals.keys()).sort();
  const firstDate = new Date(sorted[0] + 'T12:00:00Z');
  const lastDate = new Date(sorted[sorted.length - 1] + 'T12:00:00Z');
  const DAY_MS = 24 * 60 * 60 * 1000;

  const filled: { date: string; count: number }[] = [];
  for (let t = firstDate.getTime(); t <= lastDate.getTime(); t += DAY_MS) {
    const d = new Date(t);
    const key = d.toISOString().slice(0, 10);
    filled.push({ date: key, count: dayTotals.get(key) ?? 0 });
  }

  const daysWithData = filled.length;
  const fmt = new Intl.DateTimeFormat('sv-SE', { day: '2-digit', month: 'short' });

  if (daysWithData < 21) {
    return { windowSize, hasEnoughData: false, daysWithData, series: [], latest: null, yesterdayLabel: null };
  }

  const series: ControlPoint[] = filled.map((p, i) => {
    const start = Math.max(0, i - windowSize);
    const window = filled.slice(start, i);
    let mean: number | null = null;
    let std: number | null = null;
    if (window.length >= Math.min(windowSize, 7)) {
      const m = window.reduce((s, x) => s + x.count, 0) / window.length;
      const varSum = window.reduce((s, x) => s + (x.count - m) ** 2, 0) / window.length;
      mean = m;
      std = Math.sqrt(varSum);
    }
    const ucl2 = mean != null && std != null ? mean + 2 * std : null;
    const lcl2 = mean != null && std != null ? Math.max(0, mean - 2 * std) : null;
    const ucl3 = mean != null && std != null ? mean + 3 * std : null;
    const lcl3 = mean != null && std != null ? Math.max(0, mean - 3 * std) : null;
    const z = mean != null && std != null && std > 0 ? (p.count - mean) / std : null;
    let outOf2 = false;
    let direction: 'above' | 'below' | null = null;
    if (z != null) {
      if (z > 2) { outOf2 = true; direction = 'above'; }
      else if (z < -2) { outOf2 = true; direction = 'below'; }
    }
    return {
      date: p.date,
      label: fmt.format(new Date(p.date + 'T12:00:00Z')),
      count: p.count,
      mean,
      ucl2,
      lcl2,
      ucl3,
      lcl3,
      z,
      outOf2,
      direction,
    };
  });

  const latest = series[series.length - 1] ?? null;
  const yesterdayLabel = latest?.label ?? null;

  return { windowSize, hasEnoughData: true, daysWithData, series, latest, yesterdayLabel };
}

// ==================== SEASONAL DECOMPOSITION ====================

export interface DecompositionPoint {
  date: string;
  label: string;
  actual: number;
  trend: number | null;
  seasonal: number | null;
  residual: number | null;
}

export interface MonthSeasonalPoint {
  month: number; // 1..12
  label: string;
  value: number;
}

export interface WeekdaySeasonalPoint {
  weekday: number; // 0=Sun..6=Sat
  label: string;
  value: number;
}

export interface DecompositionResult {
  hasEnoughData: boolean;
  daysWithData: number;
  hasMonthSeason: boolean;
  series: DecompositionPoint[];
  monthSeasonal: MonthSeasonalPoint[];
  weekdaySeasonal: WeekdaySeasonalPoint[];
  trendSlopePerDay: number | null;
  trendTotalChange: number | null;
  meanLevel: number | null;
  verdict: string;
}

export async function getDecomposition(): Promise<DecompositionResult> {
  const res = await supabase.from('egg_logs').select('date, count');
  const rows = (res.data ?? []) as { date: string; count: number | null }[];

  if (rows.length === 0) {
    return {
      hasEnoughData: false,
      daysWithData: 0,
      hasMonthSeason: false,
      series: [],
      monthSeasonal: [],
      weekdaySeasonal: [],
      trendSlopePerDay: null,
      trendTotalChange: null,
      meanLevel: null,
      verdict: '',
    };
  }

  const dayTotals = new Map<string, number>();
  for (const r of rows) {
    if (!r.date) continue;
    dayTotals.set(r.date, (dayTotals.get(r.date) ?? 0) + (r.count ?? 0));
  }
  const sorted = Array.from(dayTotals.keys()).sort();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const firstD = new Date(sorted[0] + 'T12:00:00Z').getTime();
  const lastD = new Date(sorted[sorted.length - 1] + 'T12:00:00Z').getTime();
  const filled: { date: string; d: Date; count: number }[] = [];
  for (let t = firstD; t <= lastD; t += DAY_MS) {
    const d = new Date(t);
    const key = d.toISOString().slice(0, 10);
    filled.push({ date: key, d, count: dayTotals.get(key) ?? 0 });
  }
  const daysWithData = filled.length;
  const fmt = new Intl.DateTimeFormat('sv-SE', { day: '2-digit', month: 'short' });

  if (daysWithData < 60) {
    return {
      hasEnoughData: false,
      daysWithData,
      hasMonthSeason: false,
      series: [],
      monthSeasonal: [],
      weekdaySeasonal: [],
      trendSlopePerDay: null,
      trendTotalChange: null,
      meanLevel: null,
      verdict: '',
    };
  }

  // Centered 30-day moving average for trend
  const TREND_WIN = 30;
  const half = Math.floor(TREND_WIN / 2);
  const trend: (number | null)[] = filled.map((_, i) => {
    const start = i - half;
    const end = i + half;
    if (start < 0 || end >= filled.length) return null;
    let sum = 0;
    for (let j = start; j <= end; j++) sum += filled[j].count;
    return sum / (end - start + 1);
  });

  // Detrended
  const detrended: (number | null)[] = filled.map((p, i) =>
    trend[i] == null ? null : p.count - (trend[i] as number),
  );

  // Weekday seasonal (avg detrended per weekday); fallback to avg deviation from overall mean
  const overallMean = filled.reduce((s, p) => s + p.count, 0) / filled.length;
  const weekdayBuckets: number[][] = Array.from({ length: 7 }, () => []);
  filled.forEach((p, i) => {
    const wd = p.d.getUTCDay();
    const val = detrended[i];
    if (val != null) weekdayBuckets[wd].push(val);
  });
  let weekdaySeasonalValues = weekdayBuckets.map((arr) =>
    arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : 0,
  );
  // Center weekday seasonal so it sums to 0
  const wMean = weekdaySeasonalValues.reduce((s, x) => s + x, 0) / 7;
  weekdaySeasonalValues = weekdaySeasonalValues.map((v) => v - wMean);

  // Month seasonal — only if we have ≥ ~2 years
  const hasMonthSeason = daysWithData >= 365 * 2 - 30;
  const monthBuckets: number[][] = Array.from({ length: 12 }, () => []);
  if (hasMonthSeason) {
    filled.forEach((p, i) => {
      const m = p.d.getUTCMonth();
      const val = detrended[i];
      if (val != null) monthBuckets[m].push(val);
    });
  }
  let monthSeasonalValues = monthBuckets.map((arr) =>
    arr.length > 0 ? arr.reduce((s, x) => s + x, 0) / arr.length : 0,
  );
  if (hasMonthSeason) {
    const mMean = monthSeasonalValues.reduce((s, x) => s + x, 0) / 12;
    monthSeasonalValues = monthSeasonalValues.map((v) => v - mMean);
  } else {
    monthSeasonalValues = monthSeasonalValues.map(() => 0);
  }

  const series: DecompositionPoint[] = filled.map((p, i) => {
    const wd = p.d.getUTCDay();
    const m = p.d.getUTCMonth();
    const seasonal =
      weekdaySeasonalValues[wd] + (hasMonthSeason ? monthSeasonalValues[m] : 0);
    const tr = trend[i];
    const residual = tr == null ? null : p.count - tr - seasonal;
    return {
      date: p.date,
      label: fmt.format(p.d),
      actual: p.count,
      trend: tr,
      seasonal,
      residual,
    };
  });

  // Trend slope via least squares on non-null trend
  const idx: number[] = [];
  const vals: number[] = [];
  trend.forEach((v, i) => {
    if (v != null) {
      idx.push(i);
      vals.push(v);
    }
  });
  let trendSlopePerDay: number | null = null;
  let trendTotalChange: number | null = null;
  if (idx.length >= 2) {
    const n = idx.length;
    const meanX = idx.reduce((a, b) => a + b, 0) / n;
    const meanY = vals.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (idx[i] - meanX) * (vals[i] - meanY);
      den += (idx[i] - meanX) ** 2;
    }
    if (den > 0) {
      trendSlopePerDay = num / den;
      trendTotalChange = (vals[n - 1] - vals[0]);
    }
  }

  const monthNamesShort = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const weekdayNamesShort = ['sön', 'mån', 'tis', 'ons', 'tor', 'fre', 'lör'];

  const monthSeasonal: MonthSeasonalPoint[] = monthSeasonalValues.map((value, i) => ({
    month: i + 1,
    label: monthNamesShort[i],
    value: Math.round(value * 100) / 100,
  }));
  // Display weekday as mon..sun for readability
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdaySeasonal: WeekdaySeasonalPoint[] = weekdayOrder.map((wd) => ({
    weekday: wd,
    label: weekdayNamesShort[wd],
    value: Math.round(weekdaySeasonalValues[wd] * 100) / 100,
  }));

  // Verdict
  let verdict = '';
  const meanLevel = overallMean;
  if (trendSlopePerDay != null) {
    const pctPerMonth = (trendSlopePerDay * 30) / Math.max(1, overallMean) * 100;
    const seasonalAmplitude = hasMonthSeason
      ? Math.max(...monthSeasonalValues) - Math.min(...monthSeasonalValues)
      : Math.max(...weekdaySeasonalValues) - Math.min(...weekdaySeasonalValues);
    const trendMagnitude = Math.abs((trendTotalChange ?? 0));
    const seasonExplainsMost = seasonalAmplitude > trendMagnitude * 0.8;

    if (pctPerMonth < -1.5) {
      verdict = seasonExplainsMost
        ? 'Trenden pekar nedåt, men det mesta förklaras av säsong – din flock presterar normalt för årstiden.'
        : 'Trenden pekar nedåt även när säsongen räknats bort. Värt att titta på foder, ljus och hälsa.';
    } else if (pctPerMonth > 1.5) {
      verdict = 'Trenden pekar uppåt – flocken värper allt bättre, även när säsongen räknats bort.';
    } else {
      verdict = 'Trenden är stabil. Variationen du ser i siffrorna förklaras främst av säsong och veckodag.';
    }
  } else {
    verdict = 'För tidigt att avgöra trend – fortsätt logga så blir bilden tydligare.';
  }

  return {
    hasEnoughData: true,
    daysWithData,
    hasMonthSeason,
    series,
    monthSeasonal,
    weekdaySeasonal,
    trendSlopePerDay,
    trendTotalChange,
    meanLevel,
    verdict,
  };
}

// ==================== HEN CONSISTENCY ====================

export interface HenConsistencyRow {
  id: string;
  name: string;
  totalEggs: number;
  daysCovered: number;
  perWeek: number;
  cv: number;
  consistencyIndex: number; // 0..100
  longestStreak: number;
  currentStreak: number;
}

export interface HenConsistencyResult {
  hens: HenConsistencyRow[];
  bestConsistencyId: string | null;
  longestStreakId: string | null;
}

export async function getHenConsistency(): Promise<HenConsistencyResult> {
  const [logsRes, hensRes] = await Promise.all([
    supabase.from('egg_logs').select('hen_id, date, count').not('hen_id', 'is', null),
    supabase.from('hens').select('id, name, hen_type, created_at, death_date'),
  ]);

  const logs = (logsRes.data ?? []) as { hen_id: string; date: string; count: number | null }[];
  const hens = (hensRes.data ?? []) as {
    id: string;
    name: string | null;
    hen_type: string | null;
    created_at: string;
    death_date: string | null;
  }[];

  const layingHens = hens.filter((h) => (h.hen_type ?? 'hen') === 'hen');
  const henById = new Map(layingHens.map((h) => [h.id, h]));

  // group logs per hen / day
  const perHen = new Map<string, Map<string, number>>();
  for (const l of logs) {
    if (!henById.has(l.hen_id)) continue;
    if (!l.date) continue;
    let m = perHen.get(l.hen_id);
    if (!m) {
      m = new Map();
      perHen.set(l.hen_id, m);
    }
    m.set(l.date, (m.get(l.date) ?? 0) + (l.count ?? 0));
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const todayKey = new Date().toISOString().slice(0, 10);

  const rows: HenConsistencyRow[] = [];

  for (const hen of layingHens) {
    const dayMap = perHen.get(hen.id);
    if (!dayMap || dayMap.size < 14) continue;

    const dates = Array.from(dayMap.keys()).sort();
    const firstHen = new Date(hen.created_at).toISOString().slice(0, 10);
    const firstLog = dates[0];
    const startKey = firstLog > firstHen ? firstLog : firstHen;
    const endKey = hen.death_date ?? todayKey;
    if (endKey < startKey) continue;

    const startD = new Date(startKey + 'T12:00:00Z').getTime();
    const endD = new Date(endKey + 'T12:00:00Z').getTime();

    const series: { date: string; count: number }[] = [];
    for (let t = startD; t <= endD; t += DAY_MS) {
      const k = new Date(t).toISOString().slice(0, 10);
      series.push({ date: k, count: dayMap.get(k) ?? 0 });
    }
    if (series.length < 14) continue;

    const counts = series.map((s) => s.count);
    const total = counts.reduce((s, x) => s + x, 0);
    if (total === 0) continue;
    const mean = total / counts.length;
    const variance = counts.reduce((s, x) => s + (x - mean) ** 2, 0) / counts.length;
    const std = Math.sqrt(variance);
    const cv = mean > 0 ? std / mean : Infinity;

    // Friendly 0-100 index: CV of 0 -> 100, CV ≥ 1.5 -> 0
    const consistencyIndex = Math.max(0, Math.min(100, Math.round(100 * (1 - cv / 1.5))));

    let longestStreak = 0;
    let run = 0;
    for (const c of counts) {
      if (c >= 1) {
        run++;
        if (run > longestStreak) longestStreak = run;
      } else {
        run = 0;
      }
    }
    // Current streak: trailing run of ≥1 ending at end of series
    let currentStreak = 0;
    for (let i = counts.length - 1; i >= 0; i--) {
      if (counts[i] >= 1) currentStreak++;
      else break;
    }

    rows.push({
      id: hen.id,
      name: hen.name ?? 'Namnlös höna',
      totalEggs: total,
      daysCovered: counts.length,
      perWeek: Math.round((mean * 7) * 10) / 10,
      cv: Math.round(cv * 1000) / 1000,
      consistencyIndex,
      longestStreak,
      currentStreak,
    });
  }

  rows.sort((a, b) => a.cv - b.cv);

  const bestConsistencyId = rows[0]?.id ?? null;
  const longestStreakId =
    rows.length > 0
      ? rows.slice().sort((a, b) => b.longestStreak - a.longestStreak)[0].id
      : null;

  return { hens: rows, bestConsistencyId, longestStreakId };
}

// ==================== BREEDING ANALYSIS ====================

export interface BreedingValueRow {
  parentId: string;
  parentName: string;
  parentRole: 'father' | 'mother' | 'both';
  offspringCount: number;
  avgEggsPerDay: number;
  pctVsFlock: number;
}

export interface InbreedingRow {
  henId: string;
  henName: string;
  fIndex: number; // 0..1
  commonAncestors: { id: string; name: string; viaFatherDepth: number; viaMotherDepth: number }[];
}

export interface BreedingAnalysisResult {
  flockAvgEggsPerDay: number;
  parents: BreedingValueRow[];
  hasParentData: boolean;
  inbreeding: InbreedingRow[];
  highInbreedingCount: number;
}

export async function getBreedingValues(): Promise<BreedingAnalysisResult> {
  const [hensRes, logsRes] = await Promise.all([
    supabase
      .from('hens')
      .select('id, name, father_id, mother_id, birth_date, hen_type, death_date, created_at'),
    supabase.from('egg_logs').select('hen_id, date, count').not('hen_id', 'is', null),
  ]);

  const hens = (hensRes.data ?? []) as {
    id: string;
    name: string | null;
    father_id: string | null;
    mother_id: string | null;
    birth_date: string | null;
    hen_type: string | null;
    death_date: string | null;
    created_at: string;
  }[];
  const logs = (logsRes.data ?? []) as { hen_id: string; date: string; count: number | null }[];

  const henById = new Map(hens.map((h) => [h.id, h]));
  const today = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Aggregate eggs per hen
  const eggsByHen = new Map<string, number>();
  for (const l of logs) {
    eggsByHen.set(l.hen_id, (eggsByHen.get(l.hen_id) ?? 0) + (l.count ?? 0));
  }

  // For each laying hen: compute eggs per active day
  function activeDays(hen: typeof hens[number]): number {
    const startStr = hen.birth_date ?? hen.created_at.slice(0, 10);
    const start = new Date(startStr + 'T12:00:00Z').getTime();
    const end = hen.death_date
      ? new Date(hen.death_date + 'T12:00:00Z').getTime()
      : today.getTime();
    return Math.max(1, Math.round((end - start) / DAY_MS));
  }

  const layingHens = hens.filter((h) => (h.hen_type ?? 'hen') === 'hen');
  const henEggsPerDay = new Map<string, number>();
  for (const h of layingHens) {
    const e = eggsByHen.get(h.id) ?? 0;
    if (e <= 0) continue;
    const d = activeDays(h);
    henEggsPerDay.set(h.id, e / d);
  }

  const flockVals = Array.from(henEggsPerDay.values());
  const flockAvgEggsPerDay =
    flockVals.length > 0 ? flockVals.reduce((s, x) => s + x, 0) / flockVals.length : 0;

  // Group offspring by parent
  const offspringByParent = new Map<string, { role: 'father' | 'mother'; henId: string }[]>();
  for (const h of layingHens) {
    if (!henEggsPerDay.has(h.id)) continue;
    if (h.father_id) {
      const arr = offspringByParent.get(h.father_id) ?? [];
      arr.push({ role: 'father', henId: h.id });
      offspringByParent.set(h.father_id, arr);
    }
    if (h.mother_id) {
      const arr = offspringByParent.get(h.mother_id) ?? [];
      arr.push({ role: 'mother', henId: h.id });
      offspringByParent.set(h.mother_id, arr);
    }
  }

  const parents: BreedingValueRow[] = [];
  for (const [parentId, offspring] of offspringByParent) {
    if (offspring.length < 2) continue;
    const parent = henById.get(parentId);
    if (!parent) continue;
    const vals = offspring.map((o) => henEggsPerDay.get(o.henId) ?? 0).filter((v) => v > 0);
    if (vals.length < 2) continue;
    const avg = vals.reduce((s, x) => s + x, 0) / vals.length;
    const pct = flockAvgEggsPerDay > 0 ? (avg / flockAvgEggsPerDay - 1) * 100 : 0;
    const roles = new Set(offspring.map((o) => o.role));
    const role: BreedingValueRow['parentRole'] =
      roles.size === 2 ? 'both' : (Array.from(roles)[0] as 'father' | 'mother');
    parents.push({
      parentId,
      parentName: parent.name ?? 'Namnlös',
      parentRole: role,
      offspringCount: vals.length,
      avgEggsPerDay: Math.round(avg * 1000) / 1000,
      pctVsFlock: Math.round(pct * 10) / 10,
    });
  }
  parents.sort((a, b) => b.pctVsFlock - a.pctVsFlock);

  // Inbreeding via get_hen_ancestors for distinct parent IDs
  const parentsToFetch = new Set<string>();
  const henPairs: { hen: typeof hens[number]; fId: string; mId: string }[] = [];
  for (const h of hens) {
    if (h.father_id && h.mother_id) {
      parentsToFetch.add(h.father_id);
      parentsToFetch.add(h.mother_id);
      henPairs.push({ hen: h, fId: h.father_id, mId: h.mother_id });
    }
  }

  // Cap to avoid heavy load
  const MAX_PARENTS = 60;
  const parentList = Array.from(parentsToFetch).slice(0, MAX_PARENTS);
  const ancestorCache = new Map<string, Map<string, number>>(); // parentId -> (ancestorId -> minDepth)

  for (const pid of parentList) {
    try {
      const res = await supabase.rpc('get_hen_ancestors', { _hen_id: pid, _generations: 4 });
      const rows = (res.data ?? []) as { id: string; depth: number }[];
      const m = new Map<string, number>();
      for (const r of rows) {
        const prev = m.get(r.id);
        if (prev == null || r.depth < prev) m.set(r.id, r.depth);
      }
      ancestorCache.set(pid, m);
    } catch {
      ancestorCache.set(pid, new Map());
    }
  }

  const inbreeding: InbreedingRow[] = [];
  for (const { hen, fId, mId } of henPairs) {
    const fa = ancestorCache.get(fId);
    const ma = ancestorCache.get(mId);
    if (!fa || !ma) continue;
    let F = 0;
    const common: InbreedingRow['commonAncestors'] = [];
    for (const [aid, df] of fa) {
      const dm = ma.get(aid);
      if (dm == null) continue;
      // Skip if A is the father or mother themselves (df=0 or dm=0 trivially) -
      // father appearing in mother's tree means mother descends from father (irregular but real).
      F += Math.pow(0.5, df + dm + 1);
      const ancestor = henById.get(aid);
      common.push({
        id: aid,
        name: ancestor?.name ?? 'Namnlös',
        viaFatherDepth: df,
        viaMotherDepth: dm,
      });
    }
    if (F > 0) {
      inbreeding.push({
        henId: hen.id,
        henName: hen.name ?? 'Namnlös',
        fIndex: Math.min(1, F),
        commonAncestors: common.sort(
          (a, b) => a.viaFatherDepth + a.viaMotherDepth - (b.viaFatherDepth + b.viaMotherDepth),
        ),
      });
    }
  }
  inbreeding.sort((a, b) => b.fIndex - a.fIndex);

  const highInbreedingCount = inbreeding.filter((r) => r.fIndex > 0.125).length;

  return {
    flockAvgEggsPerDay: Math.round(flockAvgEggsPerDay * 1000) / 1000,
    parents,
    hasParentData: parents.length > 0,
    inbreeding,
    highInbreedingCount,
  };
}

// ==================== COHORT ANALYSIS ====================

export interface CohortSeriesPoint {
  week: number;
  [cohortKey: string]: number | null;
}

export interface CohortMeta {
  key: string;
  label: string;
  henCount: number;
  color: string;
}

export interface CohortAnalysisResult {
  cohorts: CohortMeta[];
  series: CohortSeriesPoint[];
  maxWeek: number;
}

export async function getCohortAnalysis(): Promise<CohortAnalysisResult> {
  const [hensRes, logsRes, sessionsRes] = await Promise.all([
    supabase
      .from('hens')
      .select('id, birth_date, hatch_session_id, hen_type, death_date'),
    supabase.from('egg_logs').select('hen_id, date, count').not('hen_id', 'is', null),
    supabase.from('hatch_sessions').select('id, name'),
  ]);

  const hens = (hensRes.data ?? []) as {
    id: string;
    birth_date: string | null;
    hatch_session_id: string | null;
    hen_type: string | null;
    death_date: string | null;
  }[];
  const logs = (logsRes.data ?? []) as { hen_id: string; date: string; count: number | null }[];
  const sessions = (sessionsRes.data ?? []) as { id: string; name: string | null }[];
  const sessionName = new Map(sessions.map((s) => [s.id, s.name ?? 'Kläckning']));

  const monthFmt = new Intl.DateTimeFormat('sv-SE', { month: 'long', year: 'numeric' });

  const layingHens = hens.filter(
    (h) => (h.hen_type ?? 'hen') === 'hen' && h.birth_date,
  );

  // Cohort assignment
  type HenInfo = {
    id: string;
    birthMs: number;
    deathMs: number | null;
    cohortKey: string;
    cohortLabel: string;
  };
  const DAY_MS = 24 * 60 * 60 * 1000;
  const henInfo = new Map<string, HenInfo>();
  for (const h of layingHens) {
    const birthMs = new Date(h.birth_date! + 'T12:00:00Z').getTime();
    let cohortKey: string;
    let cohortLabel: string;
    if (h.hatch_session_id) {
      cohortKey = `s:${h.hatch_session_id}`;
      cohortLabel = sessionName.get(h.hatch_session_id) ?? 'Kläckning';
    } else {
      const ym = h.birth_date!.slice(0, 7);
      cohortKey = `m:${ym}`;
      cohortLabel = monthFmt.format(new Date(h.birth_date! + 'T12:00:00Z'));
      cohortLabel = cohortLabel.charAt(0).toUpperCase() + cohortLabel.slice(1);
    }
    henInfo.set(h.id, {
      id: h.id,
      birthMs,
      deathMs: h.death_date ? new Date(h.death_date + 'T12:00:00Z').getTime() : null,
      cohortKey,
      cohortLabel,
    });
  }

  // Group hens by cohort
  const cohortHens = new Map<string, HenInfo[]>();
  for (const info of henInfo.values()) {
    const arr = cohortHens.get(info.cohortKey) ?? [];
    arr.push(info);
    cohortHens.set(info.cohortKey, arr);
  }

  // Aggregate eggs by (cohort, week)
  // For each log, age = floor((log.date - birth)/7d)
  const eggsByCohortWeek = new Map<string, Map<number, number>>();
  for (const l of logs) {
    const info = henInfo.get(l.hen_id);
    if (!info) continue;
    const logMs = new Date(l.date + 'T12:00:00Z').getTime();
    const ageDays = Math.floor((logMs - info.birthMs) / DAY_MS);
    if (ageDays < 0) continue;
    const week = Math.floor(ageDays / 7);
    let weeks = eggsByCohortWeek.get(info.cohortKey);
    if (!weeks) {
      weeks = new Map();
      eggsByCohortWeek.set(info.cohortKey, weeks);
    }
    weeks.set(week, (weeks.get(week) ?? 0) + (l.count ?? 0));
  }

  // Filter cohorts: ≥2 hens AND has any eggs logged
  const today = Date.now();
  const qualifiedKeys: string[] = [];
  for (const [key, list] of cohortHens) {
    if (list.length < 2) continue;
    const weeks = eggsByCohortWeek.get(key);
    if (!weeks || weeks.size === 0) continue;
    let totalEggs = 0;
    for (const v of weeks.values()) totalEggs += v;
    if (totalEggs < 5) continue;
    qualifiedKeys.push(key);
  }

  // Order cohorts by earliest birth date desc (newest first feels natural; pick earliest first instead)
  qualifiedKeys.sort((a, b) => {
    const ha = cohortHens.get(a)!;
    const hb = cohortHens.get(b)!;
    const earliestA = Math.min(...ha.map((h) => h.birthMs));
    const earliestB = Math.min(...hb.map((h) => h.birthMs));
    return earliestA - earliestB;
  });

  const palette = [
    'hsl(var(--primary))',
    'hsl(35 70% 50%)',
    'hsl(210 60% 50%)',
    'hsl(280 50% 55%)',
    'hsl(0 60% 55%)',
    'hsl(160 50% 40%)',
    'hsl(45 80% 45%)',
    'hsl(250 50% 55%)',
  ];

  const cohorts: CohortMeta[] = qualifiedKeys.map((key, i) => {
    const list = cohortHens.get(key)!;
    const sample = list[0];
    return {
      key,
      label: sample.cohortLabel,
      henCount: list.length,
      color: palette[i % palette.length],
    };
  });

  // For each week up to max, compute avg eggs per active hen for each cohort
  let maxWeek = 0;
  for (const weeks of eggsByCohortWeek.values()) {
    for (const w of weeks.keys()) if (w > maxWeek) maxWeek = w;
  }

  // Helper: number of hens in cohort that "had reached" age w AND were still alive at that age week
  function activeHens(list: HenInfo[], week: number): number {
    const weekEndMs = (week + 1) * 7 * DAY_MS;
    let n = 0;
    for (const h of list) {
      const reachedMs = h.birthMs + weekEndMs;
      if (reachedMs > today) continue; // hen hasn't reached this age yet
      if (h.deathMs != null && h.deathMs < h.birthMs + week * 7 * DAY_MS) continue;
      n++;
    }
    return n;
  }

  const series: CohortSeriesPoint[] = [];
  for (let w = 0; w <= maxWeek; w++) {
    const row: CohortSeriesPoint = { week: w };
    for (const cohort of cohorts) {
      const list = cohortHens.get(cohort.key)!;
      const active = activeHens(list, w);
      const eggs = eggsByCohortWeek.get(cohort.key)?.get(w) ?? 0;
      if (active <= 0) {
        row[cohort.key] = null;
      } else {
        row[cohort.key] = Math.round((eggs / active) * 100) / 100;
      }
    }
    series.push(row);
  }

  return { cohorts, series, maxWeek };
}
