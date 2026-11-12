import { describe, expect, it } from 'vitest';
import {
  PRIVATE_TABLE,
  isManageToken,
  isMissingPrivateTable,
  openPrivateStore,
  requestIp,
} from '../../../supabase/functions/_shared/mapListingPrivate';

const LISTINGS = 'public_egg_sale_listings';
const TOKEN = '3f2b8c1e-5a47-4d0b-9c6e-0a1b2c3d4e5f';

type Row = Record<string, unknown>;
type DbError = { code?: string; message: string };

/**
 * Minimal PostgREST-liknande klient i minnet. Stödjer precis de anrop som
 * mapListingPrivate gör, så att testerna visar vilka tabeller som faktiskt
 * läses och skrivs i respektive läge.
 */
function fakeAdmin(options: {
  tables: Record<string, Row[]>;
  /** Fel som returneras för alla anrop mot en tabell. */
  tableErrors?: Record<string, DbError>;
  /** Fel som bara returneras vid insert i en tabell. */
  insertErrors?: Record<string, DbError>;
}) {
  const { tables, tableErrors = {}, insertErrors = {} } = options;
  const calls: string[] = [];

  function builder(table: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row = {};
    let head = false;
    let single: 'one' | 'maybe' | null = null;
    const filters: Array<[string, unknown]> = [];

    const run = () => {
      calls.push(`${op}:${table}`);
      const rows = (tables[table] ??= []);
      const error = tableErrors[table] ?? (op === 'insert' ? insertErrors[table] : undefined);
      if (error) return { data: null, error, count: null };
      const matches = (row: Row) => filters.every(([key, value]) => row[key] === value);

      if (op === 'insert') {
        const row = { id: `id-${rows.length + 1}`, ...payload };
        rows.push(row);
        return { data: single ? row : [row], error: null, count: null };
      }
      if (op === 'update') {
        rows.filter(matches).forEach((row) => Object.assign(row, payload));
        return { data: null, error: null, count: null };
      }
      if (op === 'delete') {
        tables[table] = rows.filter((row) => !matches(row));
        return { data: null, error: null, count: null };
      }
      const found = rows.filter(matches);
      if (head) return { data: null, error: null, count: found.length };
      if (single) return { data: found[0] ?? null, error: null, count: null };
      return { data: found, error: null, count: null };
    };

    const api = {
      select(_columns?: string, opts?: { head?: boolean }) { head = !!opts?.head; return api; },
      insert(row: Row) { op = 'insert'; payload = row; return api; },
      update(row: Row) { op = 'update'; payload = row; return api; },
      delete() { op = 'delete'; return api; },
      eq(key: string, value: unknown) { filters.push([key, value]); return api; },
      limit() { return api; },
      single() { single = 'one'; return api; },
      maybeSingle() { single = 'maybe'; return api; },
      then(resolve: (value: ReturnType<typeof run>) => unknown, reject?: (reason: unknown) => unknown) {
        return Promise.resolve().then(run).then(resolve, reject);
      },
    };
    return api;
  }

  return {
    calls,
    tables,
    from: (table: string) => builder(table),
    rpc: async (name: string, args: { _email: string }) => {
      calls.push(`rpc:${name}`);
      const privateRows = tables[PRIVATE_TABLE] ?? [];
      const active = privateRows.filter((p) =>
        p.owner_email === args._email &&
        (tables[LISTINGS] ?? []).some((l) => l.id === p.listing_id && l.is_active === true));
      return { data: active.length, error: null };
    },
  };
}

const missingTable: DbError = {
  code: 'PGRST205',
  message: "Could not find the table 'public.egg_listing_private' in the schema cache",
};

const fields = {
  manage_token: TOKEN,
  owner_email: 'agg@example.test',
  contact_phone: '0701234567',
  submitted_ip: '203.0.113.7',
};

describe('isManageToken', () => {
  it('godkänner bara UUID:n', () => {
    expect(isManageToken(TOKEN)).toBe(true);
    expect(isManageToken(TOKEN.toUpperCase())).toBe(true);
    expect(isManageToken('')).toBe(false);
    expect(isManageToken('abc')).toBe(false);
    expect(isManageToken(`${TOKEN}' or '1'='1`)).toBe(false);
    expect(isManageToken(null)).toBe(false);
    expect(isManageToken(123)).toBe(false);
  });
});

describe('isMissingPrivateTable', () => {
  it('känner igen både Postgres- och PostgREST-svaret för saknad tabell', () => {
    expect(isMissingPrivateTable({ code: '42P01', message: 'relation does not exist' })).toBe(true);
    expect(isMissingPrivateTable(missingTable)).toBe(true);
    expect(isMissingPrivateTable({ message: 'relation "public.egg_listing_private" does not exist' })).toBe(true);
  });

  it('tolkar inte andra fel som att tabellen saknas', () => {
    expect(isMissingPrivateTable(null)).toBe(false);
    expect(isMissingPrivateTable({ code: '42501', message: 'permission denied for table egg_listing_private' })).toBe(false);
    expect(isMissingPrivateTable({ code: '57014', message: 'canceling statement due to statement timeout' })).toBe(false);
  });
});

describe('openPrivateStore efter migrationen', () => {
  it('sparar privata fält i den privata tabellen och aldrig på annonsen', async () => {
    const admin = fakeAdmin({ tables: { [LISTINGS]: [], [PRIVATE_TABLE]: [] } });
    const store = await openPrivateStore(admin);
    expect(store.mode).toBe('table');

    const inserted = await store.insertListing({ slug: 'agg-1', title: 'Ägg', listing_kind: 'simple' }, fields);

    const listing = admin.tables[LISTINGS][0];
    expect(Object.keys(listing)).not.toEqual(expect.arrayContaining(['manage_token']));
    expect(listing).not.toHaveProperty('owner_email');
    expect(listing).not.toHaveProperty('contact_phone');
    expect(listing).not.toHaveProperty('submitted_ip');
    expect(admin.tables[PRIVATE_TABLE]).toEqual([expect.objectContaining({ listing_id: inserted.id, ...fields })]);
  });

  it('slår upp token, kontaktuppgifter och telefonnummer via den privata tabellen', async () => {
    const admin = fakeAdmin({
      tables: {
        [LISTINGS]: [{ id: 'l1', listing_kind: 'simple', is_active: true }],
        [PRIVATE_TABLE]: [{ listing_id: 'l1', ...fields }],
      },
    });
    const store = await openPrivateStore(admin);

    expect(await store.listingIdForToken(TOKEN)).toBe('l1');
    expect(await store.listingIdForToken('00000000-0000-4000-8000-000000000000')).toBeNull();
    expect(await store.contact('l1')).toEqual({ owner_email: 'agg@example.test', contact_phone: '0701234567' });

    await store.setContactPhone('l1', null);
    expect(admin.tables[PRIVATE_TABLE][0].contact_phone).toBeNull();
    expect(admin.tables[LISTINGS][0]).not.toHaveProperty('contact_phone');
    expect(await store.activeCountForEmail('agg@example.test')).toBe(1);
  });

  it('tar bort annonsen igen om de privata fälten inte gick att spara', async () => {
    const admin = fakeAdmin({
      tables: { [LISTINGS]: [], [PRIVATE_TABLE]: [] },
      insertErrors: { [PRIVATE_TABLE]: { code: '23505', message: 'duplicate key value' } },
    });
    const store = await openPrivateStore(admin);

    await expect(store.insertListing({ slug: 'agg-1' }, fields)).rejects.toThrow(/privata annonsfält/);
    expect(admin.tables[LISTINGS]).toHaveLength(0);
  });
});

describe('openPrivateStore före migrationen', () => {
  it('faller tillbaka på kolumnerna på annonsen när tabellen saknas', async () => {
    const admin = fakeAdmin({
      tables: { [LISTINGS]: [{ id: 'old', listing_kind: 'simple', is_active: true, ...fields }] },
      tableErrors: { [PRIVATE_TABLE]: missingTable },
    });
    const store = await openPrivateStore(admin);
    expect(store.mode).toBe('legacy');

    expect(await store.listingIdForToken(TOKEN)).toBe('old');
    expect(await store.contact('old')).toEqual({ owner_email: 'agg@example.test', contact_phone: '0701234567' });
    expect(await store.activeCountForEmail('agg@example.test')).toBe(1);

    await store.insertListing({ slug: 'agg-2', listing_kind: 'simple' }, { ...fields, manage_token: 'other' });
    expect(admin.tables[LISTINGS][1]).toMatchObject({ slug: 'agg-2', owner_email: 'agg@example.test', manage_token: 'other' });
    // Efter avkänningen rörs den saknade tabellen aldrig igen.
    expect(admin.calls.filter((call) => call.endsWith(PRIVATE_TABLE))).toEqual([`select:${PRIVATE_TABLE}`]);
  });

  it('matchar bara enkla annonser på token', async () => {
    const admin = fakeAdmin({
      tables: { [LISTINGS]: [{ id: 'full', listing_kind: 'full', manage_token: TOKEN }] },
      tableErrors: { [PRIVATE_TABLE]: missingTable },
    });
    const store = await openPrivateStore(admin);
    expect(await store.listingIdForToken(TOKEN)).toBeNull();
  });
});

describe('openPrivateStore vid andra fel', () => {
  it('gissar inte läge när databasen svarar med ett oväntat fel', async () => {
    const admin = fakeAdmin({
      tables: {},
      tableErrors: { [PRIVATE_TABLE]: { code: '57014', message: 'statement timeout' } },
    });
    await expect(openPrivateStore(admin)).rejects.toThrow(/lagringskontroll/);
  });
});

describe('requestIp', () => {
  const request = (headers: Record<string, string>) => ({ headers: new Headers(headers) });

  it('föredrar proxyns rubrik framför x-forwarded-for', () => {
    expect(requestIp(request({ 'cf-connecting-ip': '198.51.100.4', 'x-forwarded-for': '10.0.0.1, 198.51.100.4' })))
      .toBe('198.51.100.4');
    expect(requestIp(request({ 'x-real-ip': '198.51.100.5' }))).toBe('198.51.100.5');
  });

  it('faller tillbaka på första ledet i x-forwarded-for, annars null', () => {
    expect(requestIp(request({ 'x-forwarded-for': ' 203.0.113.9 , 10.0.0.1' }))).toBe('203.0.113.9');
    expect(requestIp(request({}))).toBeNull();
  });
});
