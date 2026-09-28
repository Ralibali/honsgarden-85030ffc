import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = resolve(process.cwd(), 'supabase/functions');
const nodeRequire = createRequire(import.meta.url);
const env = new Map<string, string>([
  ['CRON_SECRET', randomUUID()], ['SUPABASE_SERVICE_ROLE_KEY', randomUUID()],
  ['SUPABASE_URL', 'https://project.supabase.co'], ['SUPABASE_ANON_KEY', randomUUID()],
]);
function loadSource(file: string, capture?: (handler: (req: Request) => Promise<Response>) => void): any {
  const source = readFileSync(resolve(root, file), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const require = (name: string) => {
    if (name === 'node:crypto') return nodeRequire(name);
    if (name.endsWith('/cronAuth.ts')) return loadSource('_shared/cronAuth.ts');
    return { serve: capture, corsHeaders: {}, createClient: () => { throw new Error('Unauthorized request reached database'); } };
  };
  new Function('require', 'Deno', 'exports', code)(require, { env: { get: (key: string) => env.get(key) }, serve: capture }, exports);
  return exports;
}
const request = (headers: Record<string, string>) => new Request('https://project.test/cron', { method: 'POST', headers, body: '{}' });
const forgedJwt = `${Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')}.${Buffer.from(JSON.stringify({ref:'project',role:'service_role'})).toString('base64url')}.invalid-signature`;
const unauthorized = [
  {}, { Authorization: `Bearer ${env.get('SUPABASE_ANON_KEY')}` },
  { Authorization: `Bearer ${forgedJwt}` }, { 'x-cron-secret': randomUUID() },
  { Authorization: `Bearer ${env.get('CRON_SECRET')}` },
  { Authorization: env.get('SUPABASE_SERVICE_ROLE_KEY')! },
];

describe('cron credentials', () => {
  it('accepts only the exact configured header or service bearer', () => {
    const { isCronAuthorized } = loadSource('_shared/cronAuth.ts');
    for (const headers of unauthorized) expect(isCronAuthorized(request(headers))).toBe(false);
    expect(isCronAuthorized(request({'x-cron-secret': env.get('CRON_SECRET')!}))).toBe(true);
    expect(isCronAuthorized(request({Authorization: `Bearer ${env.get('SUPABASE_SERVICE_ROLE_KEY')}`}))).toBe(true);
    const old = new Map(env);
    env.clear();
    expect(isCronAuthorized(request({}))).toBe(false);
    for (const [key,value] of old) env.set(key,value);
  });
  const endpoints = readdirSync(root).filter(name => name !== '_shared' && (() => {
    try { return readFileSync(resolve(root,name,'index.ts'),'utf8').includes('isCronAuthorized'); } catch { return false; }
  })());
  it.each(endpoints)('%s rejects anon, forged JWT and wrong or missing cron credentials before side effects', async name => {
    let handler: ((req: Request) => Promise<Response>) | undefined;
    loadSource(`${name}/index.ts`, fn => { handler = fn; });
    expect(handler).toBeDefined();
    for (const headers of unauthorized) expect((await handler!(request(headers))).status).toBe(401);
  });
});
