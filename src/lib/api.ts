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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
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

export async function createEggRecord(record: { date: string; count: number; notes?: string; hen_id?: string; flock_id?: string }): Promise<EggLog> {
  const userId = await getUserId();
  const insertData: TablesInsert<'egg_logs'> = { date: record.date, count: record.count, user_id: userId };
  if (record.notes) insertData.notes = record.notes;
  if (record.hen_id) insertData.hen_id = record.hen_id;
  if (record.flock_id) insertData.flock_id = record.flock_id;
  const { data, error } = await supabase.from('egg_logs').insert(insertData).select().single();
  if (error) throw new Error(error.message);
  return data;
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
  await getUserId();
  const { data: coop } = await supabase.from('coop_settings').select('id').limit(1).maybeSingle();
  if (!coop) throw new Error('Ingen gård hittades');
  const { data, error } = await supabase.from('coop_settings').update(settings).eq('id', coop.id).select().single();
  if (error) throw new Error(error.message);
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
    supabase.from('hens').select('id').eq('is_active', true),
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
    supabase.from('hens').select('id').eq('is_active', true),
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
    supabase.from('hens').select('id, name').eq('is_active', true),
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
  const activeHens = hens.filter(h => h.is_active).length;
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
  const hens = (hensRes.data || []).filter(h => h.hen_type !== 'rooster');

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

export async function getAdvancedInsights() { return { insights: [] }; }
export async function getTrendAnalysis() { return { trends: [] }; }
export async function getAlerts() { return []; }
export async function dismissAlert(_id: string) { return {}; }
export async function getRankingSummary() { return { rank: 1, total: 1 }; }

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

    const activeHensCount = hens.filter(h => h.flock_id === flock.id && h.is_active && h.hen_type !== 'rooster').length;
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

export async function getFlockHealth() { return {}; }
export async function getInsights() { return { insights: [] }; }
export async function getAgdaInboxToday() { return { messages: [] }; }
export async function markHenSeen(_id: string) { return {}; }

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
  const { error } = await supabase.from('profiles').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
  return {};
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

// Legacy compatibility: export as api object for existing imports
export const api = {
  getHens, createHen, updateHen, deleteHen, getHenProfile, markHenSeen,
  getHenHealthScores, getProductivityAlerts,
  getHensWithEggTotals,
  getEggs, createEggRecord, deleteEggRecord,
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
  getStatisticsInsights, getAdvancedInsights, getTrendAnalysis,
  getYesterdaySummary, getFarmToday,
  getWeather,
  getDailyTip,
  getPremiumStatus, createCheckoutSession, cancelSubscription,
  getAlerts, dismissAlert,
  getStreak, touchStreak,
  getRankingSummary, getFlockStatistics, getFlockHealth,
  getInsights, getAgdaInboxToday,
  getEggGoals, upsertEggGoal, deleteEggGoal,
  adminCheck, adminStats, adminUsers, adminSubscriptions,
  adminFeedback, adminUpdateFeedbackStatus, adminReplyFeedback, adminDeleteUser, adminUpdateSubscription,
  adminAcceptTerms,
  getDashboardCoach,
  getDashboardAlerts,
  getHealthNoteHelp,
};
