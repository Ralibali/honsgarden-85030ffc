/**
 * Säkerhetsmotståndare (Swarm W) — bestående regressionstester.
 *
 * Dessa tester kodifierar de fientliga granskningarna så att fynden
 * inte kan luckras upp tyst i framtiden:
 *  1. RLS-täckning: varje tabell som skapas i migrationskedjan har RLS påslaget.
 *  2. Inga hemligheter/service-role-referenser i klientkod (src/).
 *  3. Service-role-nyckel i edge functions hämtas bara från miljövariabler.
 *  4. Premium- och kvot-tvång för Agda sker server-side (inte bara i klienten).
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');

function walk(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, ext));
    else if (ext.test(entry)) out.push(full);
  }
  return out;
}

describe('RLS-täckning över migrationskedjan', () => {
  const migrationsDir = join(ROOT, 'supabase', 'migrations');
  const sqlFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const chain = sqlFiles.map((f) => readFileSync(join(migrationsDir, f), 'utf8')).join('\n');

  const created = new Set<string>();
  for (const m of chain.matchAll(/create table (?:if not exists )?(?:public\.)?"?(\w+)"?/gi)) {
    created.add(m[1].toLowerCase());
  }

  const rlsEnabled = new Set<string>();
  for (const m of chain.matchAll(/alter table (?:public\.)?"?(\w+)"? enable row level security/gi)) {
    rlsEnabled.add(m[1].toLowerCase());
  }

  it('varje skapad tabell har RLS påslaget någonstans i kedjan', () => {
    const missing = [...created].filter((t) => !rlsEnabled.has(t));
    expect(missing).toEqual([]);
  });

  it('ingen tabell avslutas i RLS-avstängt tillstånd', () => {
    // Per tabell: sista enable/disable-händelsen i kedjan måste vara enable.
    const events: { table: string; on: boolean; pos: number }[] = [];
    for (const m of chain.matchAll(/alter table (?:public\.)?"?(\w+)"? (enable|disable) row level security/gi)) {
      events.push({ table: m[1].toLowerCase(), on: m[2].toLowerCase() === 'enable', pos: m.index ?? 0 });
    }
    const lastByTable = new Map<string, boolean>();
    for (const e of events) lastByTable.set(e.table, e.on);
    const disabled = [...lastByTable.entries()].filter(([, on]) => !on).map(([t]) => t);
    expect(disabled).toEqual([]);
  });

  it('användardatatabeller har minst en policy (eller är medvetet deny-all)', () => {
    const policyCount = new Map<string, number>();
    // CREATE POLICY "Namn med mellanslag" ON public.tabell — hantera citattecken.
    for (const m of chain.matchAll(/create policy\s+(?:"[^"]+"|\S+)\s+on\s+(?:public\.)?"?(\w+)"?/gi)) {
      const t = m[1].toLowerCase();
      policyCount.set(t, (policyCount.get(t) ?? 0) + 1);
    }
    // Kärn-tabeller med användardata MÅSTE ha explicita policies (inte deny-all).
    // OBS: flera av dem skapades innan migrationskedjan (dashboard-eran) —
    // därför krävs policies i kedjan, inte CREATE TABLE i kedjan.
    const mustHavePolicies = ['hens', 'egg_logs', 'feed_records', 'health_logs', 'transactions', 'profiles'];
    for (const table of mustHavePolicies) {
      expect(policyCount.get(table) ?? 0, `${table} saknar RLS-policy`).toBeGreaterThan(0);
    }
  });
});

describe('hemligheter håller sig utanför klienten', () => {
  // Undvik självträff: denna testfil innehåller mönstren den söker efter.
  const SELF = join('src', 'lib', '__tests__', 'securityAdversarial.test.ts');
  const srcFiles = walk(join(ROOT, 'src'), /\.(ts|tsx|mjs)$/).filter((f) => !f.endsWith(SELF));

  it('ingen service-role-referens i klientkod', () => {
    const offenders = srcFiles.filter((f) => /service_role/i.test(readFileSync(f, 'utf8')));
    expect(offenders.map((f) => f.replace(ROOT, ''))).toEqual([]);
  });

  it('inga Stripe-hemligheter eller privata nyckelmönster i klientkod', () => {
    const patterns = [/sk_live_/, /sk_test_/, /-----BEGIN (RSA |EC )?PRIVATE KEY-----/, /sbp_[a-f0-9]{20,}/];
    const offenders = srcFiles.filter((f) => {
      const content = readFileSync(f, 'utf8');
      return patterns.some((p) => p.test(content));
    });
    expect(offenders.map((f) => f.replace(ROOT, ''))).toEqual([]);
  });

  it('service-role-nyckel i edge functions kommer bara från miljövariabler', () => {
    const fnFiles = walk(join(ROOT, 'supabase', 'functions'), /\.ts$/);
    const withKey = fnFiles.filter((f) => readFileSync(f, 'utf8').includes('SUPABASE_SERVICE_ROLE_KEY'));
    expect(withKey.length).toBeGreaterThan(0); // mönstren finns — granska dem
    for (const f of withKey) {
      const content = readFileSync(f, 'utf8');
      // Nyckeln får aldrig vara hårdkodad: varje referens måste gå via env.
      const hardcoded = /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/.test(content);
      expect(hardcoded, `${f.replace(ROOT, '')} hårdkodar service-role-nyckel`).toBe(false);
    }
  });
});

describe('server-side tvång (klient-entitlements är bara UX)', () => {
  const agdaSrc = readFileSync(join(ROOT, 'supabase', 'functions', 'agda-chat', 'index.ts'), 'utf8');

  it('agda-chat nekar icke-premium server-side', () => {
    expect(agdaSrc).toContain('premium_required');
    expect(agdaSrc).toMatch(/subscription_status\s*===\s*"premium"/);
  });

  it('agda-chat har server-side rate limit', () => {
    expect(agdaSrc).toContain('check_rate_limit');
    expect(agdaSrc).toContain('monthly_ai_limit_reached');
  });

  it('agda systemprompt försvarar mot prompt injection', () => {
    expect(agdaSrc).toMatch(/opålitlig data/i);
    expect(agdaSrc).toMatch(/ignorera instruktioner/i);
  });
});
