import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { createDemoStore } from '@/lib/demoData';
import { installDemoShim, uninstallDemoShim } from '@/lib/demoShim';

// api.ts importerar supabase-klienten – stubba den (shimmade funktioner når den aldrig)
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => { throw new Error('ska inte anropas i demo'); },
    functions: { invoke: () => Promise.reject(new Error('ska inte anropas i demo')) },
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

describe('demoData – fiktiva demogården', () => {
  it('har 5 hönor med svenska namn', () => {
    const store = createDemoStore();
    expect(store.hens).toHaveLength(5);
    expect(store.hens.map((h) => h.name)).toEqual(['Blanka', 'Agda', 'Doris', 'Greta', 'Sigrid']);
  });

  it('genererar ägg 45 dagar bakåt inklusive idag', () => {
    const store = createDemoStore();
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(store.eggs.some((e) => e.date === todayKey)).toBe(true);
    expect(store.eggs.length).toBeGreaterThan(100);
  });

  it('är deterministisk – samma data vid varje laddning', () => {
    const a = createDemoStore();
    const b = createDemoStore();
    expect(a.eggs.map((e) => e.date + e.hen_id)).toEqual(b.eggs.map((e) => e.date + e.hen_id));
  });

  it('har dagboksinlägg av rätt typ för dashboardens Dagbok-widget', () => {
    const store = createDemoStore();
    expect(store.healthLogs.filter((l) => l.type === 'diary').length).toBeGreaterThanOrEqual(2);
  });
});

describe('demoShim – api-ersättning', () => {
  it('serverar demoläsningar och återställer originalet', async () => {
    const originalGetEggs = api.getEggs;
    const qc = new QueryClient();

    installDemoShim(qc);
    const eggs = await api.getEggs();
    expect(eggs.length).toBeGreaterThan(100);
    expect(eggs[0].user_id).toBe('demo-user');

    uninstallDemoShim();
    expect(api.getEggs).toBe(originalGetEggs);
  });

  it('skriver in i demostore och syns vid nästa läsning', async () => {
    const qc = new QueryClient();
    installDemoShim(qc);

    const before = (await api.getEggs()).length;
    await api.createEggRecord({ date: '2026-07-22', count: 7 });
    const after = (await api.getEggs()).length;

    expect(after).toBe(before + 1);
    uninstallDemoShim();
  });

  it('är singleton-säker – dubbel installation återställer ändå originalet', () => {
    const originalGetHens = api.getHens;
    const qc = new QueryClient();

    installDemoShim(qc);
    installDemoShim(qc); // andra anropet ska vara no-op
    uninstallDemoShim();

    expect(api.getHens).toBe(originalGetHens);
  });
});
