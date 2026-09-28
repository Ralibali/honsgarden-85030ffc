import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { expect, it, vi } from 'vitest';
const source=readFileSync(resolve('supabase/functions/premium-expiry-cron/index.ts'),'utf8');
async function run(overrides: Record<string,unknown>={}, customers: string[]=['first','second'], subs: Record<string,string>={second:'active'}, retrieveError?: string) {
  const updates: any[]=[];
  const profile={user_id:'user',email:'fixture@example.test',premium_expires_at:new Date(Date.now()-72*3600000).toISOString(),...overrides};
  const stripe={
    customers:{retrieve:vi.fn(async(id:string)=>{if(retrieveError)throw {code:retrieveError};return {id};}),list:vi.fn(async function*(){for(const id of customers)yield {id};})},
    subscriptions:{list:vi.fn(async function*({customer}: {customer:string}) { if(subs[customer])yield {status:subs[customer],items:{data:[{current_period_end:Math.floor(Date.now()/1000)+86400}]}};})},
  };
  const client={from:()=>{
    let change:unknown;
    const chain:any=new Proxy({}, {get:(_,name)=> name==='then' ? (done:any)=>Promise.resolve(done({data:change?null:[profile],error:null})) : (...args:unknown[])=>{if(name==='update'){change=args[0];updates.push(change);}return chain;}});
    return chain;
  }};
  let handler:any;
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const require=(name:string)=>name.includes('cronAuth')?{isCronAuthorized:()=>true}:name.includes('stripe@')?{default:class{constructor(){return stripe;}}}:{createClient:()=>client};
  new Function('require','Deno','exports',code)(require,{env:{get:()=> 'fixture'},serve:(fn:unknown)=>{handler=fn;}},{});
  const response=await handler(new Request('https://example.test',{method:'POST'}));
  return {updates,stripe,result:await response.json()};
}
it.each(['active','trialing','past_due'])('preserves %s on a later email-matched customer',async status=>{
 const {updates,stripe,result}=await run({},['first','second'],{first:'canceled',second:status});
 expect(result.downgraded).toBe(0);expect(result.skipped).toBe(1);
 expect(updates).toHaveLength(1);expect(updates[0].subscription_status).toBeUndefined();
 expect(stripe.subscriptions.list).toHaveBeenCalledWith({customer:'second',status:'all',limit:100});
});
it('prefers stored customer id and does not search email',async()=>{
 const {stripe,result}=await run({stripe_customer_id:'stored'},[],{stored:'active'});
 expect(stripe.customers.retrieve).toHaveBeenCalledWith('stored');expect(stripe.customers.list).not.toHaveBeenCalled();expect(result.downgraded).toBe(0);
});
it('falls back when the stored customer no longer exists',async()=>{
 const {stripe,result}=await run({stripe_customer_id:'old'},['new'],{new:'trialing'},'resource_missing');
 expect(stripe.customers.list).toHaveBeenCalled();expect(result.downgraded).toBe(0);
});
it('does not downgrade when Stripe lookup fails',async()=>{
 const {updates,result}=await run({stripe_customer_id:'stored'},[],{},'api_connection_error');
 expect(updates).toHaveLength(0);expect(result.skipped).toBe(1);
});
it('gives Apple 48 hours and downgrades only after that with no paying Stripe subscription',async()=>{
 const recent=await run({preferences:{apple_iap:{}},premium_expires_at:new Date(Date.now()-47*3600000).toISOString()},[],{});
 expect(recent.updates).toHaveLength(0);expect(recent.stripe.customers.list).not.toHaveBeenCalled();
 const old=await run({preferences:{apple_iap:{}},premium_expires_at:new Date(Date.now()-49*3600000).toISOString()},[],{});
 expect(old.updates[0]).toEqual({subscription_status:'free',premium_expires_at:null});
});
it('reads the new invoice parent and handles old and expanded subscription references',()=>{
 const webhook=readFileSync(resolve('supabase/functions/stripe-webhook/index.ts'),'utf8');
 const snippet=webhook.match(/const subscription = invoice\.parent[\s\S]*?const subId = [^;]+;/)![0];
 const extract=new Function('invoice',ts.transpileModule(snippet+'return subId;',{}).outputText);
 expect(extract({parent:{subscription_details:{subscription:'new'}},subscription:'old'})).toBe('new');
 expect(extract({subscription:'old'})).toBe('old');
 expect(extract({parent:{subscription_details:{subscription:{id:'expanded'}}}})).toBe('expanded');
 expect(extract({})).toBeUndefined();
});
