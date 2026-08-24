// Demo-shim: ersätter api-funktionerna med implementationer mot den fiktiva
// demogården medan /demo är monterad. Alla anrop (även refetch) får demoläsa
// svar, och mutationer uppdaterar demostore + invaliderar react-query så att
// UI:t uppdateras live – precis som i den riktiga appen.
// Originalen återställs alltid vid unmount.

import type { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  createDemoStore, DEMO_ALERTS, DEMO_COACH, DEMO_TIP_TEXT,
  type DemoStore,
} from '@/lib/demoData';

type ApiMutable = Record<string, unknown>;

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Singleton-guard: shimmen ska bara vara installerad en gång åt gången,
// även om React renderar om (t.ex. StrictMode dubbelrendering).
let activeUninstall: (() => void) | null = null;

export function installDemoShim(queryClient: QueryClient): () => void {
  if (activeUninstall) return activeUninstall;

  const store: DemoStore = createDemoStore();
  const mutableApi = api as unknown as ApiMutable;
  const originals = new Map<string, unknown>();

  const patch = (name: string, fn: unknown) => {
    if (!originals.has(name)) originals.set(name, mutableApi[name]);
    mutableApi[name] = fn;
  };
  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key] });
  let writeCounter = 0;
  const nextId = (prefix: string) => `demo-write-${prefix}-${++writeCounter}`;

  // ----- Läsningar -----
  patch('getEggs', async () => [...store.eggs].sort((a, b) => b.date.localeCompare(a.date)));
  patch('getHens', async () => store.hens);
  patch('getHealthLogs', async () => [...store.healthLogs].sort((a, b) => b.date.localeCompare(a.date)));
  patch('getTransactions', async () => [...store.transactions].sort((a, b) => b.date.localeCompare(a.date)));
  patch('getFeedRecords', async () => store.feedRecords);
  patch('getHatchings', async () => store.hatchings);
  patch('getDailyChores', async () => store.chores);
  patch('getEggGoals', async () => store.eggGoals);
  patch('getDailyTip', async () => ({ tip_text: DEMO_TIP_TEXT, cached: true }));
  patch('getYesterdaySummary', async () => ({
    date: yesterdayKey(),
    eggs: store.eggs.filter((e) => e.date === yesterdayKey()).reduce((s, e) => s + e.count, 0),
  }));
  patch('getDashboardCoach', async () => DEMO_COACH);
  patch('getDashboardAlerts', async () => DEMO_ALERTS);

  // ----- Skrivningar (uppdaterar demostore + invaliderar) -----
  patch('createEggRecord', async (record: { date: string; count: number; notes?: string; hen_id?: string }) => {
    const log = {
      id: nextId('egg'),
      user_id: 'demo-user',
      hen_id: record.hen_id ?? null,
      flock_id: null,
      date: record.date ?? todayKey(),
      count: record.count,
      notes: record.notes ?? null,
      weather: null,
      client_id: null,
      created_at: new Date().toISOString(),
    };
    store.eggs.push(log);
    invalidate('eggs');
    return log;
  });

  patch('deleteEggRecord', async (id: string) => {
    store.eggs = store.eggs.filter((e) => e.id !== id);
    invalidate('eggs');
  });

  patch('createHealthLog', async (log: { date: string; type: string; description: string; hen_id?: string }) => {
    const entry = {
      id: nextId('hl'),
      user_id: 'demo-user',
      hen_id: log.hen_id ?? null,
      date: log.date,
      type: log.type,
      description: log.description,
      created_at: new Date().toISOString(),
    };
    store.healthLogs.push(entry);
    invalidate('health-logs');
    return entry;
  });

  patch('completeChore', async (choreId: string) => {
    store.chores = store.chores.map((c) => (c.id === choreId ? { ...c, completed: true } : c));
    invalidate('daily-chores');
  });

  patch('uncompleteChore', async (choreId: string) => {
    store.chores = store.chores.map((c) => (c.id === choreId ? { ...c, completed: false } : c));
    invalidate('daily-chores');
  });

  patch('upsertEggGoal', async (goal: { period: string; target_count: number; is_active?: boolean; id?: string }) => {
    const existing = store.eggGoals.find((g) => g.id === goal.id);
    if (existing) {
      Object.assign(existing, goal, { updated_at: new Date().toISOString() });
    } else {
      store.eggGoals.push({
        id: nextId('goal'),
        user_id: 'demo-user',
        period: goal.period,
        target_count: goal.target_count,
        is_active: goal.is_active ?? true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
    invalidate('egg-goals');
    return store.eggGoals[0];
  });

  patch('deleteEggGoal', async (id: string) => {
    store.eggGoals = store.eggGoals.filter((g) => g.id !== id);
    invalidate('egg-goals');
  });

  // Återställ originalen när demon lämnas – viktigt för inloggade användare.
  const uninstall = () => {
    originals.forEach((original, name) => {
      mutableApi[name] = original;
    });
    activeUninstall = null;
  };
  activeUninstall = uninstall;
  return uninstall;
}

/** Avinstallera shimmen (no-op om den inte är installerad). */
export function uninstallDemoShim(): void {
  activeUninstall?.();
}
