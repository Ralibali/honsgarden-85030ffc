// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Kör den riktiga migrationen mot en lokal Postgres med samma rättigheter som
// produktion: anon har kolumnvis SELECT, authenticated har SELECT på hela
// tabellen. Testet visar läckan före migrationen och att den är stängd efter.

const MIGRATION = new URL(
  "../../supabase/migrations/20261110110000_egg_listing_private.sql",
  import.meta.url,
);

const SIMPLE = "00000000-0000-4000-8000-000000000101";
const UNVERIFIED = "00000000-0000-4000-8000-000000000102";
const FULL = "00000000-0000-4000-8000-000000000103";
const SELLER = "00000000-0000-4000-8000-000000000001";
const TOKEN = "11111111-1111-4111-8111-111111111111";

let db: PGlite;

async function as(role: string) {
  await db.exec(`reset role; set role ${role};`);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create table public.public_egg_sale_listings (
      id uuid primary key default gen_random_uuid(),
      user_id uuid,
      listing_kind text not null default 'full',
      slug text,
      title text,
      is_active boolean not null default false,
      owner_email text,
      contact_phone text,
      manage_token uuid unique,
      submitted_ip text,
      created_at timestamptz not null default now()
    );
    alter table public.public_egg_sale_listings enable row level security;
    create policy "public reads active" on public.public_egg_sale_listings
      for select using (is_active = true);

    -- Supabase standard: alla API-roller får ALL på nya tabeller.
    grant all on public.public_egg_sale_listings to anon, authenticated, service_role;
    -- 20260712212800 och 20260717212040: kolumnvis REVOKE (utan effekt för authenticated).
    revoke select (manage_token, owner_email, contact_phone, submitted_ip)
      on public.public_egg_sale_listings from anon, authenticated;
    -- 20260718232511: anon får bara de säkra kolumnerna.
    revoke select on public.public_egg_sale_listings from anon;
    grant select (id, user_id, listing_kind, slug, title, is_active, created_at)
      on public.public_egg_sale_listings to anon;

    -- 20260607080326: den gamla valideringen.
    create function public.validate_simple_listing() returns trigger
    language plpgsql set search_path = public as $$
    begin
      if new.listing_kind = 'simple' then
        if new.owner_email is null or length(new.owner_email) < 5 then
          raise exception 'Enkla annonser kräver owner_email';
        end if;
        if new.manage_token is null then
          raise exception 'Enkla annonser kräver manage_token';
        end if;
      end if;
      return new;
    end $$;
    create trigger trg_validate_simple_listing
      before insert or update on public.public_egg_sale_listings
      for each row execute function public.validate_simple_listing();

    insert into public.public_egg_sale_listings
      (id, user_id, listing_kind, slug, title, is_active, owner_email, contact_phone, manage_token, submitted_ip)
    values
      ('${SIMPLE}', null, 'simple', 'agg-1', 'Ägg i Berg', true, 'agg@example.test', '0701234567', '${TOKEN}', '203.0.113.7'),
      ('${UNVERIFIED}', null, 'simple', 'agg-2', 'Ägg i Ljungsbro', false, 'agg@example.test', null, gen_random_uuid(), '203.0.113.7'),
      ('${FULL}', '${SELLER}', 'full', 'gard', 'Gårdsbutik', true, null, null, null, null);
  `);
}, 30000);

afterAll(() => db?.close());

describe("före migrationen", () => {
  it("kan en inloggad användare läsa andras hanteringstoken och kontaktuppgifter", async () => {
    await as("authenticated");
    const { rows } = await db.query<{ manage_token: string; owner_email: string }>(
      `select manage_token, owner_email from public.public_egg_sale_listings where id = '${SIMPLE}'`,
    );
    expect(rows).toEqual([{ manage_token: TOKEN, owner_email: "agg@example.test" }]);
  });

  it("är anon redan utestängd via kolumnrättigheterna", async () => {
    await as("anon");
    await expect(db.query("select manage_token from public.public_egg_sale_listings")).rejects
      .toThrow(/permission denied/);
  });
});

describe("efter migrationen", () => {
  beforeAll(async () => {
    await as("postgres");
    await db.exec(await readFile(MIGRATION, "utf8"));
  });

  it("flyttar varje värde till den privata tabellen", async () => {
    await as("postgres");
    const { rows } = await db.query(
      "select listing_id, manage_token, owner_email, contact_phone, submitted_ip from public.egg_listing_private order by listing_id",
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      listing_id: SIMPLE,
      manage_token: TOKEN,
      owner_email: "agg@example.test",
      contact_phone: "0701234567",
      submitted_ip: "203.0.113.7",
    });
    expect(rows[1]).toMatchObject({ listing_id: UNVERIFIED, owner_email: "agg@example.test", contact_phone: null });
  });

  it("lämnar inga privata värden kvar på annonserna", async () => {
    await as("postgres");
    const { rows } = await db.query<{ left: number }>(`
      select count(*)::int as left from public.public_egg_sale_listings
      where manage_token is not null or owner_email is not null
         or contact_phone is not null or submitted_ip is not null`);
    expect(rows[0].left).toBe(0);
  });

  it("ger en inloggad användare bara NULL där token och e-post låg", async () => {
    await as("authenticated");
    const { rows } = await db.query(
      `select manage_token, owner_email, contact_phone, submitted_ip
       from public.public_egg_sale_listings where id = '${SIMPLE}'`,
    );
    expect(rows).toEqual([{ manage_token: null, owner_email: null, contact_phone: null, submitted_ip: null }]);
    // select * fungerar fortfarande, vilket äldre appversioner är beroende av.
    await expect(db.query("select * from public.public_egg_sale_listings")).resolves.toBeTruthy();
  });

  it.each(["anon", "authenticated"])("stänger %s ute från den privata tabellen", async (role) => {
    await as(role);
    await expect(db.query("select * from public.egg_listing_private")).rejects.toThrow(/permission denied/);
    await expect(db.query("select listing_id from public.egg_listing_private")).rejects.toThrow(/permission denied/);
    await expect(
      db.query(`update public.egg_listing_private set owner_email = 'x@example.test'`),
    ).rejects.toThrow(/permission denied/);
    await expect(db.query("select public.simple_listing_active_count('agg@example.test')")).rejects
      .toThrow(/permission denied/);
  });

  it("låter service role läsa, räkna och slå upp på token", async () => {
    await as("service_role");
    const byToken = await db.query<{ listing_id: string }>(
      "select listing_id from public.egg_listing_private where manage_token = $1",
      [TOKEN],
    );
    expect(byToken.rows).toEqual([{ listing_id: SIMPLE }]);
    // Två annonser på adressen, bara en är aktiv.
    const count = await db.query<{ n: number }>(
      "select public.simple_listing_active_count(' AGG@example.test ') as n",
    );
    expect(count.rows[0].n).toBe(1);
  });

  it("stoppar varje försök att skriva privata fält på annonsen igen", async () => {
    await as("service_role");
    await expect(db.query(
      `insert into public.public_egg_sale_listings (listing_kind, slug, owner_email, manage_token)
       values ('simple', 'gammal-kod', 'ny@example.test', gen_random_uuid())`,
    )).rejects.toThrow(/egg_listing_private/);
    await expect(db.query(
      `update public.public_egg_sale_listings set contact_phone = '0700000000' where id = '${SIMPLE}'`,
    )).rejects.toThrow(/egg_listing_private/);
  });

  it("tillåter enkla annonser utan privata fält och vanliga uppdateringar", async () => {
    await as("service_role");
    const inserted = await db.query<{ id: string }>(
      `insert into public.public_egg_sale_listings (listing_kind, slug, title)
       values ('simple', 'ny-annons', 'Nya ägg') returning id`,
    );
    const id = inserted.rows[0].id;
    await db.query(
      `insert into public.egg_listing_private (listing_id, manage_token, owner_email)
       values ($1, gen_random_uuid(), 'ny@example.test')`,
      [id],
    );
    await db.query("update public.public_egg_sale_listings set is_active = true where id = $1", [id]);
    await db.query(`update public.public_egg_sale_listings set is_active = false where id = '${SIMPLE}'`);
    const count = await db.query<{ n: number }>("select public.simple_listing_active_count('ny@example.test') as n");
    expect(count.rows[0].n).toBe(1);
  });

  it("tar bort de privata fälten när annonsen raderas", async () => {
    await as("service_role");
    await db.query(`delete from public.public_egg_sale_listings where id = '${UNVERIFIED}'`);
    const { rows } = await db.query(
      `select 1 from public.egg_listing_private where listing_id = '${UNVERIFIED}'`,
    );
    expect(rows).toHaveLength(0);
  });

  it("går att köra en gång till utan att något ändras eller går förlorat", async () => {
    await as("postgres");
    const before = await db.query(
      "select listing_id, manage_token, owner_email, contact_phone, submitted_ip from public.egg_listing_private order by listing_id",
    );
    await db.exec(await readFile(MIGRATION, "utf8"));
    const after = await db.query(
      "select listing_id, manage_token, owner_email, contact_phone, submitted_ip from public.egg_listing_private order by listing_id",
    );
    expect(after.rows).toEqual(before.rows);
  });
});
