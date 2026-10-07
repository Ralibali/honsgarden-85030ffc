// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { allowedOrderActions, bookingTotal } from "@/lib/eggSalePricing";
let db: PGlite;
const seller = "00000000-0000-4000-8000-000000000001",
  stranger = "00000000-0000-4000-8000-000000000002";
const listing = "00000000-0000-4000-8000-000000000010";
const customer = {
  name: "Testkund",
  phone: "0701234567",
  email: "test@example.test",
  message: "",
  pickup_name: "",
  pickup_phone: "",
};
async function role(name: string, user = "") {
  await db.exec(
    `reset role;set role ${name};select set_config('request.jwt.claim.sub','${user}',false);`,
  );
}
async function order(
  id: string,
  packs: number,
  total: number,
  list = listing,
  slot: string | null = null,
) {
  return (await db.query<
    {
      result: {
        id: string;
        token: string;
        total_price_sek: number;
        duplicate: boolean;
      };
    }
  >("select create_egg_order($1,$2,$3::jsonb,$4,$5,$6) result", [
    id,
    list,
    JSON.stringify(customer),
    packs,
    total,
    slot,
  ])).rows[0].result;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table profiles(user_id uuid,email text,display_name text);
 create table public_egg_sale_listings(id uuid primary key,user_id uuid not null,is_active boolean default true,sold_out_manually boolean default false,packs_available integer,price_per_pack numeric,price_tiers jsonb,eggs_per_pack integer default 12,slug text,title text,location text,pickup_info text,latitude numeric,longitude numeric,swish_number text,swish_name text,swish_message text);
 create table egg_sale_pickup_slots(id uuid primary key,listing_id uuid,seller_user_id uuid,starts_at timestamptz,ends_at timestamptz,label text,max_bookings integer,current_bookings integer default 0,is_active boolean default true);
 create table public_egg_sale_bookings(id uuid primary key default gen_random_uuid(),listing_id uuid not null references public_egg_sale_listings(id),seller_user_id uuid,customer_name text,customer_phone text,customer_email text,customer_message text,packs integer,status text default 'reserved',payment_status text default 'unpaid',pickup_slot_id uuid,pickup_person_name text,pickup_person_phone text,created_at timestamptz default now(),updated_at timestamptz default now(),confirmed_at timestamptz,paid_at timestamptz,packed_at timestamptz,picked_up_at timestamptz,cancelled_at timestamptz,no_show_at timestamptz,refunded_at timestamptz);
 alter table public_egg_sale_bookings enable row level security;grant all on public_egg_sale_bookings to anon,authenticated;create policy seller_read on public_egg_sale_bookings for select using(seller_user_id=auth.uid());
 create table egg_sale_booking_tokens(id uuid default gen_random_uuid(),booking_id uuid unique references public_egg_sale_bookings(id),token text unique default replace(gen_random_uuid()::text,'-',''),used_at timestamptz);alter table egg_sale_booking_tokens enable row level security;
 create table egg_sale_booking_events(id uuid default gen_random_uuid(),booking_id uuid,listing_id uuid,seller_user_id uuid,event_type text,old_status text,new_status text,actor text,metadata jsonb,created_at timestamptz default now());
 insert into public_egg_sale_listings(id,user_id,packs_available,price_per_pack,price_tiers) values('${listing}','${seller}',3,60,'[{"min_qty":2,"max_qty":null,"price_per_pack":50.50}]');`,
  );
  const existing = await readFile(
    new URL(
      "../../supabase/migrations/20260607120058_a4935968-fad7-4f3c-b737-15dad29a1843.sql",
      import.meta.url,
    ),
    "utf8",
  );
  await db.exec(
    existing.slice(
      existing.indexOf(
        "CREATE OR REPLACE FUNCTION public.adjust_slot_count_on_booking()",
      ),
      existing.indexOf("-- 7. Verified"),
    ),
  );
  const dir = new URL("../../supabase/migrations/", import.meta.url);
  const migration = (await readdir(dir)).find((f) =>
    f.endsWith("_atomic_egg_orders.sql")
  )!;
  await db.exec(await readFile(new URL(migration, dir), "utf8"));
}, 30000);
afterAll(() => db?.close());
it("books anonymously without exposing other customers, fixes tier price and handles retry once", async () => {
  await role("anon");
  const id = "00000000-0000-4000-8000-000000000020";
  const first = await order(id, 2, 101);
  expect(first.total_price_sek).toBe(101);
  expect(first.token).toBeTruthy();
  const again = await order(id, 2, 101);
  expect(again.id).toBe(first.id);
  expect(again.duplicate).toBe(true);
  await expect(order(id, 1, 60)).rejects.toThrow();
  await expect(order("00000000-0000-4000-8000-000000000021", 2, 101)).rejects
    .toThrow(/inte så många/);
  await expect(db.query("select * from egg_sale_booking_tokens")).rejects
    .toThrow();
  expect((await db.query("select * from public_egg_sale_bookings")).rows)
    .toHaveLength(0);
  await role("postgres");
  await db.exec(
    `update public_egg_sale_listings set price_per_pack=99,price_tiers='[]' where id='${listing}'`,
  );
  await role("anon");
  const portal = (await db.query<
    { result: { booking: { total_price_sek: number }; pickup_slot: null } }
  >("select get_order_by_token($1) result", [first.token])).rows[0].result;
  expect(portal.booking.total_price_sek).toBe(101);
  expect(portal.pickup_slot).toBeNull();
  await expect(order("00000000-0000-4000-8000-000000000022", 1, 60)).rejects
    .toThrow(/Priset har ändrats/);
  const final = await order("00000000-0000-4000-8000-000000000023", 1, 99);
  expect(final.total_price_sek).toBe(99);
  await expect(order("00000000-0000-4000-8000-000000000024", 1, 99)).rejects
    .toThrow(/inte så många/);
});
it("validates ownership and keeps payment independent from collection; batches roll back together", async () => {
  await role("postgres");
  const ids = (await db.query<{ id: string }>(
    "select id from public_egg_sale_bookings order by created_at",
  )).rows.map((r) => r.id);
  await role("authenticated", stranger);
  await expect(
    db.query("select transition_egg_booking_status($1,'picked_up')", [ids[0]]),
  ).rejects.toThrow(/kunde inte hittas/);
  await role("authenticated", seller);
  await db.query("select transition_egg_booking_status($1,'picked_up')", [
    ids[0],
  ]);
  await db.query("select transition_egg_booking_status($1,'paid')", [ids[0]]);
  const b = (await db.query<{ status: string; payment_status: string }>(
    "select status,payment_status from public_egg_sale_bookings where id=$1",
    [ids[0]],
  )).rows[0];
  expect(b).toEqual({ status: "picked_up", payment_status: "paid" });
  await expect(
    db.query("select transition_egg_booking_status($1,'confirmed')", [ids[0]]),
  ).rejects.toThrow();
  await expect(
    db.query("select transition_egg_orders($1,'packed')", [[ids[1], ids[0]]]),
  ).rejects.toThrow();
  expect(
    (await db.query<{ status: string }>(
      "select status from public_egg_sale_bookings where id=$1",
      [ids[1]],
    )).rows[0].status,
  ).toBe("reserved");
  await expect(
    db.query(
      "update public_egg_sale_bookings set status='reserved' where id=$1",
      [ids[0]],
    ),
  ).rejects.toThrow();
  await db.query("select transition_egg_booking_status($1,'cancelled')", [
    ids[1],
  ]);
  await role("anon");
  expect(
    (await order("00000000-0000-4000-8000-000000000025", 1, 99))
      .total_price_sek,
  ).toBe(99);
});
it("rejects full, past and foreign pickup slots at the database boundary", async () => {
  const l = "00000000-0000-4000-8000-000000000030",
    slot = "00000000-0000-4000-8000-000000000031";
  await role("postgres");
  await db.exec(
    `insert into public_egg_sale_listings(id,user_id,packs_available,price_per_pack) values('${l}','${seller}',10,60);insert into egg_sale_pickup_slots(id,listing_id,starts_at,ends_at,max_bookings) values('${slot}','${l}',now()+interval '1 day',now()+interval '25 hours',1);`,
  );
  await role("anon");
  await expect(order("00000000-0000-4000-8000-000000000032", 1, 60, l)).rejects
    .toThrow(/Välj en hämtningstid/);
  await order("00000000-0000-4000-8000-000000000033", 1, 60, l, slot);
  await expect(order("00000000-0000-4000-8000-000000000034", 1, 60, l, slot))
    .rejects.toThrow(/inte längre ledig/);
});
it("uses immutable totals and does not offer backwards or repeated payment actions", () => {
  expect(
    bookingTotal({ packs: 2, total_price_sek: 101 }, { price_per_pack: 999 }),
  ).toBe(101);
  expect(allowedOrderActions("picked_up", "unpaid")).toMatchObject({
    pay: true,
    pickup: false,
    confirm: false,
    pack: false,
    cancel: false,
  });
  expect(allowedOrderActions("picked_up", "paid").pay).toBe(false);
});
