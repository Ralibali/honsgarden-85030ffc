import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), 'supabase/functions');
const nodeRequire = createRequire(import.meta.url);
const key = randomUUID();
const values: Record<string, string> = { CRON_SECRET: key, SUPABASE_SERVICE_ROLE_KEY: randomUUID(), SUPABASE_URL: 'https://project.test' };
const malicious = `<img src=x onerror="bad">&'`;
const escaped = '&lt;img src=x onerror=&quot;bad&quot;&gt;&amp;&#39;';
function load(file: string, client: unknown = {}, exposed = ''): { exports: any; handler: (req: Request) => Promise<Response>; helpers: any } {
  const exports = {};
  let handler: any;
  const source = readFileSync(resolve(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const capture = (fn: unknown) => { handler = fn; };
  const require = (name: string): unknown => {
    if (name === 'node:crypto') return nodeRequire(name);
    if (/\/(html|appUrl|cronAuth)\.ts$/.test(name)) return load(`_shared/${name.split('/').at(-1)}`).exports;
    return { createClient: () => client, serve: capture, corsHeaders: {} };
  };
  const helpers = new Function('require', 'Deno', 'exports', code + `\nreturn {${exposed}};`)(require, { env: { get: (k: string) => values[k] }, serve: capture }, exports);
  return { exports, handler, helpers };
}
function mockClient(tables: Record<string, unknown>, queued: any[]) {
  return {
    from: (table: string) => {
      let update = false;
      const chain: any = new Proxy({}, { get: (_, name) => {
        if (name === 'then') return (done: (result: unknown) => unknown) => Promise.resolve(done({ data: update ? null : tables[table], error: null }));
        return (..._args: unknown[]) => { if (name === 'update') update = true; return chain; };
      } });
      return chain;
    },
    rpc: async (name: string, args: any) => { queued.push({ name, ...args }); return { data: true, error: null }; },
  };
}
const request = (body: unknown = {}) => new Request('https://project.test', { method:'POST', headers:{'x-cron-secret':key},body:JSON.stringify(body) });

describe('outgoing mail HTML', () => {
  it('escapes all five HTML special characters and null', () => {
    const { esc } = load('_shared/html.ts').exports;
    expect(esc(malicious)).toBe(escaped);
    expect(esc(null)).toBe('');
  });
  it('escapes marketplace names, locations, titles and alert text while keeping plaintext readable', () => {
    const {buildEmail} = load('marketplace-alerts-dispatch/index.ts', {}, 'buildEmail').helpers;
    const mail=buildEmail(malicious,[{title:malicious,slug:'x" onclick="bad',city:malicious,price:12}], [malicious]);
    expect(mail.html).not.toContain(malicious);
    expect(mail.html).toContain(escaped);
    expect(mail.text).toContain(malicious);
    expect(mail.html).not.toContain('onclick="bad');
  });
  it('escapes payment reminder customer, title and Swish fields', () => {
    const {buildEmail} = load('send-payment-reminder/index.ts', {}, 'buildEmail').helpers;
    const mail=buildEmail({customerName:malicious,listingTitle:malicious,swishName:malicious,swishNumber:malicious,packs:1,amount:12,pickupDate:'2026-09-23',reminderNumber:1});
    expect(mail.html).not.toContain(malicious);
    expect(mail.html.match(/&lt;img/g)).toHaveLength(4);
  });
  it.each(['pickup-reminder','send-review-request'])('%s escapes actual queued HTML and uses the public URL', async name => {
    const queued: any[]=[];
    const tomorrow = new Date(Date.now()+86400000);
    tomorrow.setUTCHours(12,0,0,0);
    const tables = {
      egg_sale_pickup_slots: [{ id:'slot',starts_at:tomorrow.toISOString(),ends_at:tomorrow.toISOString() }],
      public_egg_sale_bookings: [{ id:'booking',listing_id:'listing',pickup_slot_id:'slot',customer_name:malicious,customer_email:'fixture@example.test',packs:1,payment_status:'unpaid' }],
      public_egg_sale_listings: [{id:'listing',title:malicious,pickup_info:malicious,swish_number:malicious,swish_name:malicious,price_per_pack:12}],
      egg_sale_booking_tokens:[{booking_id:'booking',token:'fixture-token'}],
      egg_sale_review_tokens:{token:'fixture-token'},
    };
    const {handler}=load(`${name}/index.ts`,mockClient(tables,queued));
    expect((await handler(request())).status).toBe(200);
    expect(queued).toHaveLength(1);
    expect(queued[0].payload.html).not.toContain(malicious);
    expect(queued[0].payload.html).toContain(escaped);
    expect(queued[0].payload.html).toContain('https://honsgarden.se/');
  });
  it('does not enqueue a previously notified seller', async () => {
    const queued: any[]=[];
    const {handler}=load('notify-seller-booking/index.ts',mockClient({public_egg_sale_bookings:{id:'booking',seller_notified_at:new Date().toISOString()}},queued));
    expect((await handler(request({booking_id:'booking'}))).status).toBe(200);
    expect(queued).toHaveLength(0);
  });
  it('uses configurable public URL with canonical fallback', () => {
    expect(load('_shared/appUrl.ts').exports.PUBLIC_APP_URL).toBe('https://honsgarden.se');
    values.PUBLIC_APP_URL='https://preview.example.test/';
    expect(load('_shared/appUrl.ts').exports.PUBLIC_APP_URL).toBe('https://preview.example.test');
    delete values.PUBLIC_APP_URL;
  });
  it('keeps the old domain only in the three allowed origin lists', () => {
    const found = readdirSync(root).flatMap(dir => {
      try { return readFileSync(resolve(root,dir,'index.ts'),'utf8').includes('https://honsgarden.lovable.app') ? [dir] : []; } catch { return []; }
    });
    expect(found.sort()).toEqual(['create-checkout','customer-portal']);
    expect(readFileSync(resolve(root,'_shared/cors.ts'),'utf8')).toContain('https://honsgarden.lovable.app');
  });
});
