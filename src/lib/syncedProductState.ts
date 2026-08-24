import { supabase } from '@/integrations/supabase/client';
import {
  getEggGoal as getLocalEggGoal,
  saveEggGoal as saveLocalEggGoal,
  getEggSales as getLocalEggSales,
  saveEggSales as saveLocalEggSales,
  type EggGoal,
  type EggSale,
} from './localProductState';

async function getUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

function normalizeGoal(row: any): EggGoal {
  return {
    daily: Number(row?.daily_goal || 0),
    weekly: Number(row?.weekly_goal || 0),
    monthly: Number(row?.monthly_goal || 0),
    updatedAt: row?.updated_at || new Date().toISOString(),
  };
}

function normalizeSale(row: any): EggSale {
  return {
    id: row.id,
    customer: row.customer,
    eggs: Number(row.eggs || 0),
    amount: Number(row.amount || 0),
    paid: !!row.paid,
    date: row.sale_date || row.date,
    note: row.note || undefined,
  };
}

export async function getSyncedEggGoal(): Promise<EggGoal> {
  const userId = await getUserId();
  const local = getLocalEggGoal(userId);
  const { data, error } = await (supabase as any)
    .from('egg_goals')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[egg_goals] Supabase fallback:', error.message);
    return local;
  }

  if (!data) {
    // Om användaren redan hann sätta mål lokalt innan tabellen fanns migrerar vi upp det.
    if (local.daily || local.weekly || local.monthly) {
      try {
        return await saveSyncedEggGoal(local);
      } catch {
        return local;
      }
    }
    return local;
  }

  const goal = normalizeGoal(data);
  saveLocalEggGoal(goal, userId);
  return goal;
}

export async function saveSyncedEggGoal(goal: EggGoal): Promise<EggGoal> {
  const userId = await getUserId();
  const payload = {
    user_id: userId,
    daily_goal: Number(goal.daily || 0),
    weekly_goal: Number(goal.weekly || 0),
    monthly_goal: Number(goal.monthly || 0),
  };

  const { data, error } = await (supabase as any)
    .from('egg_goals')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) {
    console.warn('[egg_goals] save fallback:', error.message);
    saveLocalEggGoal(goal, userId);
    return { ...goal, updatedAt: new Date().toISOString() };
  }

  const saved = normalizeGoal(data);
  saveLocalEggGoal(saved, userId);
  return saved;
}

export async function getSyncedEggSales(): Promise<EggSale[]> {
  const userId = await getUserId();
  const local = getLocalEggSales(userId);
  const { data, error } = await (supabase as any)
    .from('egg_sales')
    .select('*')
    .eq('user_id', userId)
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[egg_sales] Supabase fallback:', error.message);
    return local;
  }

  const synced = (data || []).map(normalizeSale);

  // Migrera lokala försäljningar till Supabase första gången tabellen finns.
  if (synced.length === 0 && local.length > 0) {
    try {
      const rows = local.map((sale) => ({
        user_id: userId,
        customer: sale.customer,
        eggs: sale.eggs,
        amount: sale.amount,
        paid: sale.paid,
        sale_date: sale.date,
        note: sale.note || null,
      }));
      const { data: inserted, error: insertError } = await (supabase as any)
        .from('egg_sales')
        .insert(rows)
        .select('*');
      if (insertError) throw insertError;
      const migrated = (inserted || []).map(normalizeSale);
      saveLocalEggSales(migrated, userId);
      return migrated;
    } catch (err: any) {
      console.warn('[egg_sales] migration fallback:', err?.message || err);
      return local;
    }
  }

  saveLocalEggSales(synced, userId);
  return synced;
}

export async function createSyncedEggSale(input: Omit<EggSale, 'id'>): Promise<EggSale> {
  const userId = await getUserId();
  const { data, error } = await (supabase as any)
    .from('egg_sales')
    .insert({
      user_id: userId,
      customer: input.customer,
      eggs: input.eggs,
      amount: input.amount,
      paid: input.paid,
      sale_date: input.date,
      note: input.note || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const sale = normalizeSale(data);
  const current = getLocalEggSales(userId);
  saveLocalEggSales([sale, ...current.filter((s) => s.id !== sale.id)], userId);
  return sale;
}

export async function updateSyncedEggSale(id: string, patch: Partial<EggSale>): Promise<EggSale> {
  const userId = await getUserId();
  const payload: Record<string, unknown> = {};
  if (patch.customer !== undefined) payload.customer = patch.customer;
  if (patch.eggs !== undefined) payload.eggs = patch.eggs;
  if (patch.amount !== undefined) payload.amount = patch.amount;
  if (patch.paid !== undefined) payload.paid = patch.paid;
  if (patch.date !== undefined) payload.sale_date = patch.date;
  if (patch.note !== undefined) payload.note = patch.note || null;

  const { data, error } = await (supabase as any)
    .from('egg_sales')
    .update(payload)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const sale = normalizeSale(data);
  const current = getLocalEggSales(userId).map((s) => s.id === id ? sale : s);
  saveLocalEggSales(current, userId);
  return sale;
}

export async function deleteSyncedEggSale(id: string): Promise<void> {
  const userId = await getUserId();
  const { error } = await (supabase as any)
    .from('egg_sales')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  saveLocalEggSales(getLocalEggSales(userId).filter((s) => s.id !== id), userId);
}
