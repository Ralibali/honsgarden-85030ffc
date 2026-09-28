import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

const functions = ['dashboard-alerts', 'dashboard-coach', 'health-note-helper', 'analyze-import', 'egg-sales-marketing'];
const serviceKey = randomUUID();
function runtime(rate: unknown = true, quota: unknown = true, rpcError = false) {
  const rpc = vi.fn(async (name: string) => ({ data: name === 'check_rate_limit' ? rate : quota, error: rpcError ? { message: 'offline' } : null }));
  const ai = vi.fn(async () => ({ ok: true, text: '{}', raw: { choices: [{ message: { tool_calls: [{ function: { arguments: JSON.stringify({ advices: [{ title: 'Tips', text: 'Följ flocken' }] }) } }] } }] } }));
  const service = { rpc, auth: { getUser: async () => ({ data: { user: { id: 'verified-user' } }, error: null }) } };
  const anon = { auth: service.auth };
  const createClient = vi.fn((_url: string, key: string) => key === serviceKey ? service : anon);
  function load(file: string): { exports: any; handler: (req: Request) => Promise<Response> } {
    let handler: any;
    const exports = {};
    const code = ts.transpileModule(readFileSync(resolve('supabase/functions', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = (name: string) => name.endsWith('/aiLimits.ts') ? load('_shared/aiLimits.ts').exports : { serve: (fn: unknown) => { handler = fn; }, createClient, callAi: ai };
    new Function('require', 'exports', 'Deno', code)(require, exports, { env: { get: (key: string) => key === 'SUPABASE_SERVICE_ROLE_KEY' ? serviceKey : key === 'SUPABASE_URL' ? 'https://project.test' : 'anon-fixture' } });
    return { exports, handler };
  }
  return { load, rpc, ai, createClient };
}
const body = { signals: [{ key: 'low-eggs' }], noteText: 'Hönan är trött', rows: [], headers: [], user_id: 'attacker-selected-user' };
function request(input = JSON.stringify(body), headers: Record<string,string> = {}) {
  return new Request('https://project.test', { method: 'POST', headers: { Authorization: 'Bearer user-fixture', ...headers }, body: input });
}

describe.each(functions)('%s AI limits', name => {
  it('uses verified user and service role, with 10 per 60 minutes before AI', async () => {
    const test = runtime();
    const result = await test.load(`${name}/index.ts`).handler(request());
    expect(result.status).toBe(200);
    expect(test.rpc.mock.calls[0]).toEqual(['check_rate_limit', { _user_id: 'verified-user', _function_name: name, _max_requests: 10, _window_minutes: 60 }]);
    expect(test.rpc.mock.calls[1]).toEqual(['consume_ai_monthly_quota', { _user_id: 'verified-user' }]);
    expect(test.ai).toHaveBeenCalledOnce();
    expect(test.createClient.mock.calls.some(call => call[1] === serviceKey)).toBe(true);
  });
  it.each([[false,true,'per timme'],[true,false,'nästa månad']])('rejects exhausted rate/quota (%s, %s)', async (rate,quota,text) => {
    const test=runtime(rate,quota);
    const result=await test.load(`${name}/index.ts`).handler(request());
    expect(result.status).toBe(429);
    expect((await result.json()).error).toContain(text);
    expect(test.ai).not.toHaveBeenCalled();
  });
  it('fails closed when quota service fails', async () => {
    const test=runtime(true,true,true);
    expect((await test.load(`${name}/index.ts`).handler(request())).status).toBe(503);
    expect(test.ai).not.toHaveBeenCalled();
  });
});

it('limits import by actual UTF-8 bytes without trusting Content-Length', async () => {
  for (const headers of [{}, { 'content-length': '5' }]) {
    const test=runtime();
    const response=await test.load('analyze-import/index.ts').handler(request(JSON.stringify({ rows: ['å'.repeat(100_000)], headers: [] }),headers));
    expect(response.status).toBe(413);
    expect(test.ai).not.toHaveBeenCalled();
    expect(test.rpc).not.toHaveBeenCalled();
  }
});
it('accepts exactly 200 kB input', async () => {
  const test=runtime();
  const initial=JSON.stringify({ rows: [], headers: [] });
  const response=await test.load('analyze-import/index.ts').handler(request(initial.padEnd(200_000)));
  expect(response.status).toBe(200);
  expect(test.ai).toHaveBeenCalledOnce();
});
