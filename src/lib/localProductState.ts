export interface EggGoal {
  daily: number;
  weekly: number;
  monthly: number;
  updatedAt: string;
}

export interface EggSale {
  id: string;
  customer: string;
  eggs: number;
  amount: number;
  paid: boolean;
  date: string;
  note?: string;
}

const GOALS_KEY = 'honsgarden-egg-goals';
const SALES_KEY = 'honsgarden-egg-sales';

const defaultGoal: EggGoal = {
  daily: 0,
  weekly: 0,
  monthly: 0,
  updatedAt: new Date().toISOString(),
};

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getEggGoal(userId?: string | null): EggGoal {
  if (typeof window === 'undefined') return defaultGoal;
  const key = userId ? `${GOALS_KEY}-${userId}` : GOALS_KEY;
  return { ...defaultGoal, ...safeJson<Partial<EggGoal>>(localStorage.getItem(key), {}) };
}

export function saveEggGoal(goal: EggGoal, userId?: string | null) {
  if (typeof window === 'undefined') return;
  const key = userId ? `${GOALS_KEY}-${userId}` : GOALS_KEY;
  localStorage.setItem(key, JSON.stringify({ ...goal, updatedAt: new Date().toISOString() }));
}

export function getEggSales(userId?: string | null): EggSale[] {
  if (typeof window === 'undefined') return [];
  const key = userId ? `${SALES_KEY}-${userId}` : SALES_KEY;
  return safeJson<EggSale[]>(localStorage.getItem(key), []);
}

export function saveEggSales(sales: EggSale[], userId?: string | null) {
  if (typeof window === 'undefined') return;
  const key = userId ? `${SALES_KEY}-${userId}` : SALES_KEY;
  localStorage.setItem(key, JSON.stringify(sales));
}

export function createEggSale(input: Omit<EggSale, 'id'>, userId?: string | null): EggSale[] {
  const current = getEggSales(userId);
  const next: EggSale = {
    ...input,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`,
  };
  const sales = [next, ...current];
  saveEggSales(sales, userId);
  return sales;
}

export function updateEggSale(id: string, patch: Partial<EggSale>, userId?: string | null): EggSale[] {
  const sales = getEggSales(userId).map((sale) => sale.id === id ? { ...sale, ...patch } : sale);
  saveEggSales(sales, userId);
  return sales;
}

export function deleteEggSale(id: string, userId?: string | null): EggSale[] {
  const sales = getEggSales(userId).filter((sale) => sale.id !== id);
  saveEggSales(sales, userId);
  return sales;
}
