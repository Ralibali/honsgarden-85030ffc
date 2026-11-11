// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

// Kör migrationen mot en lokal Postgres med enkla ersättare för pg_cron,
// vault och pg_net. Testet ska visa att ett jobb bara skrivs om när anropet
// bevisligen blir detsamma som förut, och att inget annat rörs.

const MIGRATION = new URL(
  "../../supabase/migrations/20261110111000_cron_secret_from_vault.sql",
  import.meta.url,
);
const BASE = "https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1";

const STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema cron;
  create table cron.job (
    jobid bigserial primary key, schedule text not null, command text not null,
    jobname text unique, active boolean not null default true
  );
  create function cron.alter_job(
    job_id bigint, schedule text default null, command text default null,
    database text default null, username text default null, active boolean default null
  ) returns void language plpgsql as $$
  begin
    update cron.job j set
      schedule = coalesce(alter_job.schedule, j.schedule),
      command = coalesce(alter_job.command, j.command),
      active = coalesce(alter_job.active, j.active)
    where j.jobid = job_id;
  end $$;

  create schema vault;
  create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
  create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
  create function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
  returns uuid language sql as $$
    insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id
  $$;

  create schema net;
  create table net.calls (id bigserial primary key, url text, headers jsonb, body jsonb, timeout_milliseconds integer);
  create function net.http_post(
    url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
    headers jsonb default '{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds integer default 5000
  ) returns bigint language sql as $$
    insert into net.calls (url, headers, body, timeout_milliseconds)
    values (url, headers, body, timeout_milliseconds) returning id
  $$;
`;

/**
 * Samma skrivsätt som de befintliga jobben använder: jsonb_build_object med
 * hemligheten som en vanlig SQL-sträng, radbrytningar och blanksteg inräknade.
 */
const INLINE_SECRET = "Zx81TestHemlighetSomInteFinnsNagonAnnanstans";
const rekoJob = {
  secret: INLINE_SECRET,
  command: `
  SELECT net.http_post(
    url := '${BASE}/reko-pickup-reminder',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-cron-secret','${INLINE_SECRET}'
    ),
    body := '{}'::jsonb
  );
  `,
};

const jsonStyle = (fn: string, secret: string, extra = "") => `
  select net.http_post(
    url:='${BASE}/${fn}',
    headers:='{"Content-Type":"application/json","X-Cron-Secret": "${secret}"}'::jsonb,
    body:='{}'::jsonb${extra}
  ) as request_id;`;

const VAULT_STYLE = `
  SELECT net.http_post(
    url := '${BASE}/premium-expiry-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET' LIMIT 1)
    ),
    body := jsonb_build_object('time', now())
  ) AS request_id;`;

const NO_SECRET = `
  SELECT net.http_post(url:='${BASE}/marketplace-expire-listings',
    headers:='{"Content-Type":"application/json","apikey":"public-anon-key"}'::jsonb, body:='{}'::jsonb);`;

const NOT_HTTP = `DELETE FROM public.client_error_logs WHERE created_at < now() - interval '30 days'`;

let db: PGlite | undefined;
afterEach(async () => {
  await db?.close();
  db = undefined;
});

async function setup(options: { vault?: string; jobs: Record<string, string> }) {
  db = new PGlite();
  await db.exec(STUBS);
  if (options.vault) {
    await db.query("insert into vault.secrets (name, secret) values ('CRON_SECRET', $1)", [options.vault]);
  }
  for (const [name, command] of Object.entries(options.jobs)) {
    await db.query("insert into cron.job (jobname, schedule, command) values ($1, '0 9 * * *', $2)", [name, command]);
  }
  return db;
}

async function migrate(target: PGlite) {
  await target.exec(await readFile(MIGRATION, "utf8"));
}

async function commands(target: PGlite) {
  const { rows } = await target.query<{ jobname: string; command: string }>(
    "select jobname, command from cron.job order by jobname",
  );
  return Object.fromEntries(rows.map((row) => [row.jobname, row.command]));
}

async function overview(target: PGlite) {
  const { rows } = await target.query<{ jobname: string; auth: string; edge_function: string | null }>(
    "select jobname, auth, edge_function from public.cron_auth_overview()",
  );
  return Object.fromEntries(rows.map((row) => [row.jobname, row.auth]));
}

describe("tomt vault och jobb som är överens om hemligheten", () => {
  it("lägger hemligheten i vault och skriver om jobben utan att anropet ändras", async () => {
    const reko = rekoJob;
    const target = await setup({
      jobs: {
        "reko-pickup-reminder-daily": reko.command,
        "daily-egg-reminder": jsonStyle("daily-egg-reminder", reko.secret, ",\n    timeout_milliseconds := 30000"),
        "daily-premium-expiry-check": VAULT_STYLE,
        "marketplace-expire-listings-daily": NO_SECRET,
        "cleanup-client-error-logs": NOT_HTTP,
      },
    });
    const before = await commands(target);

    await migrate(target);
    const after = await commands(target);

    expect(after["reko-pickup-reminder-daily"]).toBe("SELECT public.invoke_cron_function('reko-pickup-reminder');");
    expect(after["daily-egg-reminder"]).toBe(
      "SELECT public.invoke_cron_function('daily-egg-reminder', '{}'::jsonb, 30000);",
    );
    // Jobb som redan läser vault, saknar hemlighet eller inte är HTTP rörs inte.
    for (const name of ["daily-premium-expiry-check", "marketplace-expire-listings-daily", "cleanup-client-error-logs"]) {
      expect(after[name], name).toBe(before[name]);
    }
    // Ingen hemlighet står kvar i något jobb.
    expect(Object.values(after).join("\n")).not.toContain(reko.secret);
    expect(await overview(target)).toEqual({
      "cleanup-client-error-logs": "anropar ingen funktion",
      "daily-egg-reminder": "vault (hjälpfunktion)",
      "daily-premium-expiry-check": "vault",
      "marketplace-expire-listings-daily": "annan (ingen cron-hemlighet)",
      "reko-pickup-reminder-daily": "vault (hjälpfunktion)",
    });

    // De omskrivna jobben skickar samma hemlighet till samma adress som förut.
    await target.exec(after["reko-pickup-reminder-daily"]);
    await target.exec(after["daily-egg-reminder"]);
    // ... och jobbet som redan läste vault fungerar nu, när hemligheten finns där.
    await target.exec(after["daily-premium-expiry-check"]);
    const { rows } = await target.query<{ url: string; secret: string; timeout_milliseconds: number }>(
      "select url, headers->>'x-cron-secret' as secret, timeout_milliseconds from net.calls order by id",
    );
    expect(rows).toEqual([
      { url: `${BASE}/reko-pickup-reminder`, secret: reko.secret, timeout_milliseconds: 5000 },
      { url: `${BASE}/daily-egg-reminder`, secret: reko.secret, timeout_milliseconds: 30000 },
      { url: `${BASE}/premium-expiry-cron`, secret: reko.secret, timeout_milliseconds: 5000 },
    ]);
  });

  it("följer med när hemligheten sedan byts i vault", async () => {
    const reko = rekoJob;
    const target = await setup({ jobs: { "reko-pickup-reminder-daily": reko.command } });
    await migrate(target);

    await target.exec("update vault.secrets set secret = 'ny-hemlighet' where name = 'CRON_SECRET'");
    await target.exec((await commands(target))["reko-pickup-reminder-daily"]);

    const { rows } = await target.query<{ secret: string }>("select headers->>'x-cron-secret' as secret from net.calls");
    expect(rows).toEqual([{ secret: "ny-hemlighet" }]);
  });

  it("ger samma resultat om migrationen körs en gång till", async () => {
    const reko = rekoJob;
    const target = await setup({ jobs: { "reko-pickup-reminder-daily": reko.command } });
    await migrate(target);
    const first = await commands(target);
    await migrate(target);
    expect(await commands(target)).toEqual(first);
    const { rows } = await target.query("select 1 from vault.secrets where name = 'CRON_SECRET'");
    expect(rows).toHaveLength(1);
  });
});

describe("lägen där ett jobb inte får röras", () => {
  it("lämnar jobb orörda när vault har en annan hemlighet än jobbet", async () => {
    const target = await setup({
      vault: "nagot-annat",
      jobs: { "daily-egg-reminder": jsonStyle("daily-egg-reminder", "jobbets-hemlighet") },
    });
    const before = await commands(target);
    await migrate(target);
    expect(await commands(target)).toEqual(before);
    expect(await overview(target)).toEqual({ "daily-egg-reminder": "KLARTEXT" });
    const { rows } = await target.query<{ secret: string }>("select secret from vault.secrets");
    expect(rows).toEqual([{ secret: "nagot-annat" }]);
  });

  it("gissar inte när jobben har olika hemligheter och vault är tomt", async () => {
    const target = await setup({
      jobs: {
        "daily-egg-reminder": jsonStyle("daily-egg-reminder", "hemlighet-a"),
        "weekly-report-email": jsonStyle("weekly-report-email", "hemlighet-b"),
      },
    });
    const before = await commands(target);
    await migrate(target);
    expect(await commands(target)).toEqual(before);
    const { rows } = await target.query("select 1 from vault.secrets");
    expect(rows).toHaveLength(0);
  });

  it("skriver bara om enkla anrop till projektets egna funktioner", async () => {
    const secret = "samma-hemlighet";
    const target = await setup({
      vault: secret,
      jobs: {
        "matchar": jsonStyle("weekly-report-email", secret),
        "annan-vard": jsonStyle("x", secret).replace(BASE, "https://example.test/functions/v1"),
        "tva-anrop": jsonStyle("daily-egg-reminder", secret) + jsonStyle("weekly-report-email", secret),
        "laser-body": jsonStyle("send-payment-reminder", secret),
      },
    });
    const before = await commands(target);
    await migrate(target);
    const after = await commands(target);

    expect(after["matchar"]).toBe("SELECT public.invoke_cron_function('weekly-report-email');");
    for (const name of ["annan-vard", "tva-anrop", "laser-body"]) {
      expect(after[name], name).toBe(before[name]);
    }
  });
});

describe("invoke_cron_function", () => {
  it("vägrar anropa utan hemlighet i vault eller med ett konstigt funktionsnamn", async () => {
    const target = await setup({ jobs: {} });
    await migrate(target);
    await expect(target.query("select public.invoke_cron_function('daily-egg-reminder')")).rejects
      .toThrow(/CRON_SECRET saknas/);

    await target.exec("insert into vault.secrets (name, secret) values ('CRON_SECRET', 's')");
    for (const name of ["../admin", "https://example.test/x", "A", "", "a b", "a/b?c=d"]) {
      await expect(target.query("select public.invoke_cron_function($1)", [name]), name).rejects
        .toThrow(/Ogiltigt funktionsnamn/);
    }
    await expect(target.query("select public.invoke_cron_function(null)")).rejects.toThrow(/Ogiltigt funktionsnamn/);
    const { rows } = await target.query("select 1 from net.calls");
    expect(rows).toHaveLength(0);
  });

  it.each(["anon", "authenticated", "service_role"])("går inte att nå för %s", async (role) => {
    const target = await setup({ vault: "s", jobs: {} });
    await migrate(target);
    await target.exec(`grant usage on schema public to ${role}; set role ${role};`);
    await expect(target.query("select public.invoke_cron_function('daily-egg-reminder')")).rejects
      .toThrow(/permission denied/);
    await expect(target.query("select * from public.cron_auth_overview()")).rejects.toThrow(/permission denied/);
  });
});
