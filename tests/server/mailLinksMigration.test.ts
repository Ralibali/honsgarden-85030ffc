// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Migrationen skriver om funktioner utifrån deras definition i databasen.
// Testet ska visa att bara länken ändras: beteende, säkerhetsattribut och
// rättigheter är desamma efteråt, och funktioner som inte köar mejl rörs inte.

const MIGRATION = new URL(
  "../../supabase/migrations/20261110112000_mail_links_to_honsgarden_se.sql",
  import.meta.url,
);

let db: PGlite;

const snapshot = async () =>
  (await db.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null; provolatile: string; acl: string | null; owner: string; body: string }>(`
    select p.proname, p.prosecdef, p.proconfig, p.provolatile, p.proacl::text as acl,
           pg_get_userbyid(p.proowner) as owner, p.prosrc as body
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' order by p.proname`)).rows;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create table public.outbox (id bigserial primary key, queue_name text, payload jsonb);
    create function public.enqueue_email(queue_name text, payload jsonb) returns bigint
    language sql security definer as $$
      insert into public.outbox (queue_name, payload) values (queue_name, payload) returning id
    $$;

    create table public.profiles (user_id uuid primary key, email text, display_name text);
    create table public.listings (id uuid primary key default gen_random_uuid(), slug text, buyer_email text);

    -- Trigger med SECURITY DEFINER, search_path och egen dollar-tagg, som välkomstmejlet.
    create function public.send_welcome_email() returns trigger
    language plpgsql security definer set search_path to 'public' as $function$
    begin
      perform public.enqueue_email('transactional_emails', jsonb_build_object(
        'to', new.email,
        'html', '<a href="https://honsgarden.lovable.app/app" style="color: hsl(142,32%,34%)">Öppna</a>',
        'text', 'Hej ' || coalesce(new.display_name, '') || '! Kom igång: https://honsgarden.lovable.app/app'));
      return new;
    end;
    $function$;
    create trigger trg_welcome after insert on public.profiles
      for each row execute function public.send_welcome_email();

    -- Länk som sätts ihop med en slug, som avbokningsmejlet.
    create function public.send_cancellation_email_to_buyer() returns trigger
    language plpgsql security definer set search_path = public as $$
    declare _link text;
    begin
      _link := 'https://honsgarden.lovable.app/s/' || coalesce(new.slug, new.id::text);
      perform public.enqueue_email('transactional_emails', jsonb_build_object('to', new.buyer_email, 'text', _link));
      return new;
    end $$;
    create trigger trg_cancel after insert on public.listings
      for each row execute function public.send_cancellation_email_to_buyer();
    revoke execute on function public.send_cancellation_email_to_buyer() from public;
    grant execute on function public.send_cancellation_email_to_buyer() to service_role;

    -- Tillåtenlista: nämner lovable.app men köar inget mejl. Ska stå kvar.
    create function public.is_allowed_origin(_origin text) returns boolean
    language sql immutable as $$
      select _origin in ('https://honsgarden.se', 'https://honsgarden.lovable.app')
    $$;

    -- Köar mejl men länkar redan rätt. Ska inte röras.
    create function public.send_other_mail() returns void
    language plpgsql as $$
    begin
      perform public.enqueue_email('transactional_emails', '{"text":"https://honsgarden.se/app"}'::jsonb);
    end $$;
  `);
}, 30000);

afterAll(() => db?.close());

describe("mejllänkar i databasfunktioner", () => {
  it("skickar lovable.app-länkar före migrationen", async () => {
    await db.exec(`insert into public.profiles values (gen_random_uuid(), 'a@example.test', 'Anna')`);
    const { rows } = await db.query<{ text: string }>(`select payload->>'text' as text from public.outbox order by id desc limit 1`);
    expect(rows[0].text).toBe("Hej Anna! Kom igång: https://honsgarden.lovable.app/app");
  });

  it("ändrar bara länken och lämnar allt annat exakt som det var", async () => {
    const before = await snapshot();
    await db.exec(await readFile(MIGRATION, "utf8"));
    const after = await snapshot();

    expect(after.map((f) => f.proname)).toEqual(before.map((f) => f.proname));
    for (const fn of after) {
      const was = before.find((f) => f.proname === fn.proname)!;
      // Säkerhetsattribut, rättigheter och ägare är orörda för alla funktioner.
      expect({ ...fn, body: null }, fn.proname).toEqual({ ...was, body: null });

      const rewritten = ["send_welcome_email", "send_cancellation_email_to_buyer"].includes(fn.proname);
      expect(fn.body, fn.proname).toBe(
        rewritten ? was.body.split("https://honsgarden.lovable.app").join("https://honsgarden.se") : was.body,
      );
    }
    expect(after.find((f) => f.proname === "send_welcome_email")!.body).not.toContain("lovable.app");
    expect(after.find((f) => f.proname === "is_allowed_origin")!.body).toContain("https://honsgarden.lovable.app");
  });

  it("skickar honsgarden.se-länkar efter migrationen, med samma sökvägar", async () => {
    await db.exec(`insert into public.profiles values (gen_random_uuid(), 'b@example.test', 'Bo')`);
    await db.exec(`insert into public.listings (slug, buyer_email) values ('bergs-agg', 'kop@example.test')`);
    const { rows } = await db.query<{ payload: { text: string; html?: string } }>(
      `select payload from public.outbox order by id desc limit 2`,
    );
    expect(rows[0].payload.text).toBe("https://honsgarden.se/s/bergs-agg");
    expect(rows[1].payload.text).toBe("Hej Bo! Kom igång: https://honsgarden.se/app");
    expect(rows[1].payload.html).toBe('<a href="https://honsgarden.se/app" style="color: hsl(142,32%,34%)">Öppna</a>');
  });

  it("behåller rättigheterna: anon får fortfarande inte anropa den spärrade funktionen", async () => {
    await db.exec("grant usage on schema public to anon; set role anon;");
    await expect(db.query("select public.send_cancellation_email_to_buyer()")).rejects.toThrow(/permission denied/);
    await db.exec("reset role;");
  });

  it("gör ingenting vid en andra körning", async () => {
    const before = await snapshot();
    await db.exec(await readFile(MIGRATION, "utf8"));
    expect(await snapshot()).toEqual(before);
  });
});
