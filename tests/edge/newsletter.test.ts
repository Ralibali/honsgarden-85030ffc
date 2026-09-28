import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nodeRequire=createRequire(import.meta.url);
const key=randomUUID();
const env: Record<string,string>={SUPABASE_SERVICE_ROLE_KEY:key,CRON_SECRET:key,BREVO_API_KEY:randomUUID(),LOVABLE_API_KEY:randomUUID(),RESEND_API_KEY:randomUUID(),SUPABASE_URL:'https://project.test'};
function setup(confirmed: string[], messages: any[] = []) {
  const profiles=[{user_id:'yes',email:'YES@EXAMPLE.TEST',created_at:new Date().toISOString(),premium_expires_at:new Date(Date.now()+2*86400000).toISOString()}, {user_id:'no',email:'no@example.test',created_at:new Date().toISOString(),premium_expires_at:new Date(Date.now()+2*86400000).toISOString()}];
  const tables: Record<string,any>={profiles,newsletter_subscribers:confirmed.map((email,i)=>({id:String(i),email,confirmed_at:new Date().toISOString()})),email_send_state:{send_delay_ms:0},email_send_log:[],egg_logs:[],hens:[],chore_completions:[],suppressed_emails:[],lifecycle_emails_sent:[]};
  const rpc=vi.fn(async(name:string,args:any)=>({data:name==='read_email_batch'?(args.queue_name==='transactional_emails'?messages:[]):true,error:null}));
  const reads:any[]=[];
  const client={rpc,from:(table:string)=>{
    const actions:any[]=[]; reads.push({table,actions}); let single=false; let range=[0,Infinity];
    const chain:any=new Proxy({}, {get:(_,name)=> {
      if(name==='then')return (done:(result:unknown)=>unknown)=>{
        let data=tables[table]??[];
        if(Array.isArray(data))data=data.slice(range[0],range[1]+1);
        if(single&&Array.isArray(data))data=data[0]??null;
        return Promise.resolve(done({data,error:null,count:0}));
      };
      return (...args:any[])=> {actions.push([name,...args]);if(name==='maybeSingle'||name==='single')single=true;if(name==='range')range=args;return chain;};
    }});return chain;
  }};
  function load(file:string):{exports:any;handler:(req:Request)=>Promise<Response>} {
    let handler:any;const exports={};
    const code=ts.transpileModule(readFileSync(resolve('supabase/functions',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const capture=(fn:unknown)=>{handler=fn;};
    const require=(name:string):unknown=>name==='node:crypto'?nodeRequire(name): /\/(newsletter|html|appUrl|cronAuth)\.ts$/.test(name)?load(`_shared/${name.split('/').at(-1)}`).exports:{createClient:()=>client,serve:capture};
    new Function('require','exports','Deno',code)(require,exports,{env:{get:(name:string)=>env[name]},serve:capture});
    return {exports,handler};
  }
  return {load,client,rpc,reads};
}
const request=()=>new Request('https://project.test',{method:'POST',headers:{'x-cron-secret':key}});
afterEach(()=>vi.restoreAllMocks());

describe('newsletter consent',()=>{
  it('paginates confirmed addresses and normalizes email',async()=>{
    const test=setup(Array.from({length:1001},(_,i)=>`USER${i}@EXAMPLE.TEST`));
    const emails=await test.load('_shared/newsletter.ts').exports.confirmedNewsletterEmails(test.client);
    expect(emails.size).toBe(1001);expect(emails.has('user1000@example.test')).toBe(true);
    expect(test.reads.filter(r=>r.table==='newsletter_subscribers')).toHaveLength(2);
    for(const read of test.reads)expect(read.actions).toContainEqual(['not','confirmed_at','is',null]);
  });
  it('syncs only confirmed subscribers including those without an account',async()=>{
    const sent:any[]=[];
    vi.spyOn(globalThis,'fetch').mockImplementation(async(url,init)=>{if(String(url).endsWith('/contacts/import'))sent.push(...JSON.parse(String(init?.body)).jsonBody);return new Response('{}',{status:200});});
    const test=setup(['yes@example.test','newsletter-only@example.test']);
    expect((await test.load('sync-brevo/index.ts').handler(request())).status).toBe(200);
    expect(sent.map(c=>c.email).sort()).toEqual(['newsletter-only@example.test','yes@example.test']);
  });
  it.each(['day-2-activation-email','trial-email-sequence'])('%s does not queue unconfirmed recipients',async(name)=>{
    const test=setup(['yes@example.test']);
    expect((await test.load(`${name}/index.ts`).handler(request())).status).toBe(200);
    const queued=test.rpc.mock.calls.filter(call=>call[0]==='enqueue_email');
    expect(queued).toHaveLength(1);
    expect(queued[0][1].payload.to).toBe('YES@EXAMPLE.TEST');
  });
  it('rechecks previously queued marketing while allowing the confirmation itself',async()=>{
    const sent:any[]=[];
    vi.spyOn(globalThis,'fetch').mockImplementation(async(_url,init)=>{sent.push(JSON.parse(String(init?.body)));return new Response('{}',{status:200});});
    const messages=[
      {msg_id:1,message:{to:'no@example.test',label:'trial_day10'}},
      {msg_id:2,message:{to:'yes@example.test',label:'newsletter-weekly'}},
      {msg_id:3,message:{to:'no@example.test',label:'newsletter-confirmation'}},
    ];
    const test=setup(['yes@example.test'],messages);
    // The queue worker's existing gateway contract supplies a verified service JWT.
    const token=`e30.${Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')}.${randomUUID()}`;
    const req=new Request('https://project.test',{method:'POST',headers:{Authorization:`Bearer ${token}`}});
    expect((await test.load('process-email-queue/index.ts').handler(req)).status).toBe(200);
    expect(sent.map(p=>p.to)).toEqual([['yes@example.test'],['no@example.test']]);
    expect(test.rpc.mock.calls).toContainEqual(['delete_email',{queue_name:'transactional_emails',message_id:1}]);
  });
});
