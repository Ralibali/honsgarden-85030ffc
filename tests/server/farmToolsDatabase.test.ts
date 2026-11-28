// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";

const owner = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const plan = "00000000-0000-4000-8000-000000000003";
const listing = "00000000-0000-4000-8000-000000000004";
const receipt = "00000000-0000-4000-8000-000000000005";
let db: PGlite;
async function scalar<T = string>(
  sql: string,
  args: unknown[] = []
): Promise<T> {
  const row = (await db.query<Record<string, T>>(sql, args)).rows[0];
  return row && Object.values(row)[0];
}
async function user(id: string) {
  await scalar("select set_config('claim.uid',$1,false)", [id]);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('claim.uid',true),'')::uuid$$;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,created_at timestamptz default now());
    create function has_farm_role_for_owner(uuid,text) returns boolean language sql as $$select $1=auth.uid()$$;
    create function has_role(uuid,text) returns boolean language sql as $$select current_setting('test.admin',true)='yes'$$;
    create table flocks(id uuid primary key default gen_random_uuid(),user_id uuid,name text);
    create table hatchings(id uuid primary key default gen_random_uuid(),user_id uuid,start_date date,expected_hatch_date date,egg_count integer,hatched_count integer default 0,status text,notes text);
    create table hatch_sessions(id uuid primary key default gen_random_uuid(),user_id uuid,flock_id uuid,name text,set_date date,expected_hatch_date date,actual_hatch_date date,eggs_set int,eggs_hatched int,status text);
    create table hens(id uuid primary key default gen_random_uuid(),user_id uuid,flock_id uuid,name text,hen_type text,breed text,is_active boolean,color text,image_url text,birth_date date,mother_id uuid,father_id uuid,hatch_session_id uuid,notes text);
    create table egg_logs(id uuid primary key default gen_random_uuid(),user_id uuid,date date,count int,notes text);
    create table public_egg_sale_listings(id uuid primary key,user_id uuid,is_active boolean,listing_kind text,eggs_per_pack int,price_per_pack numeric,price_tiers jsonb,stock_source text,packs_available int,stock_packs int,sold_out_manually boolean,created_at timestamptz default now());
    create table public_egg_sale_bookings(id uuid primary key default gen_random_uuid(),listing_id uuid,seller_user_id uuid,packs int,status text default 'reserved',payment_status text default 'unpaid',picked_up_at timestamptz,updated_at timestamptz default now(),customer_name text,customer_email text,customer_phone text,customer_message text,pickup_slot_id uuid,pickup_person_name text,pickup_person_phone text);
    create function get_public_egg_sale_reserved_packs(uuid) returns integer language sql stable as $$select coalesce(sum(packs),0)::integer from public.public_egg_sale_bookings where listing_id=$1 and status<>'cancelled'$$;
    create table egg_sales(id uuid primary key default gen_random_uuid(),user_id uuid,customer text,eggs int,amount numeric,paid boolean,sale_date date);
    create table transactions(id uuid primary key default gen_random_uuid(),user_id uuid,date date,type text,category text,amount numeric,description text);
    create table feed_records(id uuid primary key,user_id uuid,date date,feed_type text,amount_kg numeric,cost numeric);
    create table inventory_items(id uuid primary key default gen_random_uuid(),user_id uuid,category text,name text,unit text,current_quantity numeric default 0);
    create table inventory_transactions(id uuid primary key default gen_random_uuid(),user_id uuid,inventory_item_id uuid,transaction_type text,quantity numeric,cost numeric,transaction_date date,notes text);
    create function apply_inventory() returns trigger language plpgsql as $$begin update public.inventory_items set current_quantity=current_quantity+new.quantity where id=new.inventory_item_id;return new;end$$;
    create trigger apply_inventory after insert on inventory_transactions for each row execute function apply_inventory();
    create table digital_orders(product_slug text,customer_email text,status text,refunded_at timestamptz,livemode boolean);
    create table reminders(id uuid primary key default gen_random_uuid(),user_id uuid,title text,due_date date,reminder_type text,recurrence text,status text);
    insert into auth.users(id,email,email_confirmed_at) values('${owner}','owner@example.test',now()),('${other}','other@example.test',now());
  `);
  for (const file of (await readdir("supabase/migrations"))
    .filter((s) => s.startsWith("20261128") && s.endsWith(".sql"))
    .sort()) {
    await db.exec(await readFile("supabase/migrations/" + file, "utf8"));
  }
}, 30000);
afterAll(() => db.close());

it("keeps plans separate from livestock and accepts one arrival and one explicit hatch outcome", async () => {
  await user(owner);
  await scalar("select save_flock_plan($1,$2,4,200,4000)", [plan, "Sussex"]);
  expect(await scalar("select count(*)::int from hens")).toBe(0);
  await user(other);
  await expect(
    scalar("select receive_flock_plan($1,4,'Ny flock')", [plan])
  ).rejects.toThrow();
  await user(owner);
  const flock = await scalar("select receive_flock_plan($1,4,'Ny flock')", [
    plan,
  ]);
  expect(
    await scalar("select receive_flock_plan($1,4,'Ny flock')", [plan])
  ).toBe(flock);
  const hatch = await scalar(
    "insert into hatchings(user_id,start_date,expected_hatch_date,egg_count,status) values(auth.uid(),current_date-24,current_date-3,6,'incubating') returning id"
  );
  expect(
    await scalar("select outcome_date from hatchings where id=$1", [hatch])
  ).toBeNull();
  await expect(
    scalar(
      "select confirm_hatch_outcome($1,7,current_date,$2,null,null,true)",
      [hatch, flock]
    )
  ).rejects.toThrow();
  const session = await scalar(
    "select confirm_hatch_outcome($1,2,current_date,$2,null,null,true)",
    [hatch, flock]
  );
  expect(
    await scalar(
      "select confirm_hatch_outcome($1,2,current_date,$2,null,null,true)",
      [hatch, flock]
    )
  ).toBe(session);
  expect(
    await scalar("select count(*)::int from hens where hen_type='chick'")
  ).toBe(2);
  expect(await scalar("select count(*)::int from hens")).toBe(6);
});

it("reserves only whole packs, returns cancellations and journals a paid pickup exactly once", async () => {
  await user(owner);
  await db.query(
    "insert into public_egg_sale_listings(id,user_id,is_active,listing_kind,eggs_per_pack,price_per_pack) values($1,$2,true,'full',6,30)",
    [listing, owner]
  );
  await scalar("select configure_egg_basket(current_date,20,2,$1)", [listing]);
  expect(await scalar("select publish_basket_packs()")).toBe(3);
  const book = () =>
    scalar(
      "insert into public_egg_sale_bookings(listing_id,packs,customer_name) values($1,2,'Kund') returning id",
      [listing]
    );
  const first = await book();
  expect(await scalar("select basket_listing_packs($1)", [listing])).toBe(1);
  await expect(book()).rejects.toThrow();
  await db.query(
    "update public_egg_sale_bookings set status='cancelled' where id=$1",
    [first]
  );
  expect(await scalar("select basket_listing_packs($1)", [listing])).toBe(3);
  const request = "00000000-0000-4000-8000-000000000098";
  const retry = () =>
    db.query(
      "insert into public_egg_sale_bookings(listing_id,packs,customer_name,basket_request_id,basket_amount) values($1,2,'Kund',$2,60) returning id",
      [listing, request]
    );
  const id = (await retry()).rows[0].id;
  expect((await retry()).rows).toHaveLength(0);
  await expect(
    db.query(
      "insert into public_egg_sale_bookings(listing_id,packs,customer_name,basket_request_id,basket_amount) values($1,1,'Annan',$2,30)",
      [listing, request]
    )
  ).rejects.toThrow();
  await db.query(
    "update public_egg_sale_bookings set status='picked_up',payment_status='paid' where id=$1",
    [id]
  );
  await db.query(
    "update public_egg_sale_bookings set payment_status='paid' where id=$1",
    [id]
  );
  expect(
    await scalar(
      "select count(*)::int from egg_sales where source_booking_id=$1",
      [id]
    )
  ).toBe(1);
  expect(
    await scalar(
      "select coalesce(sum(amount),0)::int from transactions where type='income'"
    )
  ).toBe(60);
  expect(await scalar("select (my_egg_basket()->>'available')::int")).toBe(6);
  await expect(
    scalar(
      "insert into egg_sales(user_id,eggs,sale_date) values(auth.uid(),7,current_date) returning id"
    )
  ).rejects.toThrow();
  await expect(
    db.query("delete from egg_sales where source_booking_id=$1", [id])
  ).rejects.toThrow();
  await db.query(
    "update public_egg_sale_bookings set payment_status='refunded' where id=$1",
    [id]
  );
  expect(
    await scalar("select count(*)::int from transactions where type='income'")
  ).toBe(0);
});

it("bounds guest access, handles repeated rounds and immediately honors revocation", async () => {
  await user(owner);
  const key = await scalar(
    "insert into care_passes(starts_on,ends_on,morning,evening) values(current_date,current_date,'Vatten','Stäng') returning token"
  );
  await db.exec("set role anon");
  expect(await scalar("select read_care_pass($1)->>'morning'", [key])).toBe(
    "Vatten"
  );
  await expect(db.query("select * from care_passes")).rejects.toThrow();
  expect(
    await scalar("select complete_care_round($1,current_date,'morning',3,'')", [
      key,
    ])
  ).toBe(true);
  expect(
    await scalar("select complete_care_round($1,current_date,'morning',3,'')", [
      key,
    ])
  ).toBe(false);
  await db.exec("reset role");
  expect(await scalar("select sum(count)::int from egg_logs")).toBe(3);
  await db.query("update care_passes set revoked_at=now() where token=$1", [
    key,
  ]);
  expect(await scalar("select read_care_pass($1)", [key])).toBeNull();
  await expect(
    scalar("select complete_care_round($1,current_date,'evening',0,'')", [key])
  ).rejects.toThrow();
});

it("posts receipts to feed, inventory and finance atomically, and reverses removal", async () => {
  await user(owner);
  const save = () =>
    scalar(
      "select save_feed_receipt($1,'Värpfoder',current_date,20,175,null)",
      [receipt]
    );
  await save();
  await save();
  expect(
    await scalar("select current_quantity::int from inventory_items")
  ).toBe(20);
  expect(
    await scalar("select sum(amount)::int from transactions where id=$1", [
      receipt,
    ])
  ).toBe(175);
  await expect(
    db.query("delete from transactions where id=$1", [receipt])
  ).rejects.toThrow();
  await db.query("delete from feed_records where id=$1", [receipt]);
  expect(
    await scalar("select current_quantity::int from inventory_items")
  ).toBe(0);
  expect(
    await scalar("select count(*)::int from transactions where id=$1", [
      receipt,
    ])
  ).toBe(0);
});

it("gates guide access, starts the calendar once and imports each handoff once", async () => {
  await user(owner);
  await expect(
    scalar("select start_farm_program('mina-forsta-hons',current_date)")
  ).rejects.toThrow();
  expect(
    await scalar("select start_farm_program('klack-tillsammans',current_date)")
  ).toBe(true);
  expect(
    await scalar("select start_farm_program('klack-tillsammans',current_date)")
  ).toBe(false);
  expect(await scalar("select count(*)::int from reminders")).toBe(3);
  await expect(scalar("select farm_growth_totals()")).rejects.toThrow();
  await db.query(
    "insert into digital_orders values('mina-forsta-hons','OWNER@example.test','paid',null,true)"
  );
  expect(
    await scalar("select start_farm_program('mina-forsta-hons',current_date)")
  ).toBe(true);
  await scalar("select set_config('test.admin','yes',false)");
  expect(await scalar("select farm_growth_totals()")).toMatchObject({
    accounts: 2,
    planned: 1,
    arrived: 1,
    sellers: 1,
    pickup: 1,
    repeat: 0,
  });
  await scalar("select set_config('test.admin','no',false)");
  const bird = await scalar("select id from hens where hen_type='hen' limit 1");
  const pass = await scalar("select create_hen_handoff($1,false,false)", [
    bird,
  ]);
  await expect(
    scalar("select receive_hen_handoff($1,null)", [pass])
  ).rejects.toThrow();
  await user(other);
  const newHen = await scalar("select receive_hen_handoff($1,null)", [pass]);
  expect(await scalar("select receive_hen_handoff($1,null)", [pass])).toBe(
    newHen
  );
  expect(
    await scalar("select count(*)::int from hens where user_id=$1", [other])
  ).toBe(1);
});
