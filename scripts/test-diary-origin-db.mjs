import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
// Point PGLITE_MODULE at an installed @electric-sql/pglite (tested with 0.5.4).
const { PGlite } = await import(process.env.PGLITE_MODULE || (globalThis.Deno ? 'npm:@electric-sql/pglite@0.5.4' : '@electric-sql/pglite'));
const db = new PGlite();
const root = new URL('../', import.meta.url);
let checks = 0;
const id = (prefix, n) => `${prefix}0000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const user = n => id(1,n), hen = n => id(3,n), entry = id(4,1), newEntry = id(4,2), brood = id(6,1);
const one = async (sql, params=[]) => (await db.query(sql,params)).rows[0];
async function asUser(n) { await db.exec(`reset role; set role authenticated; set test.uid='${user(n)}'`); }
async function rejects(fn, reason) { await assert.rejects(fn, reason); checks++; }
function check(actual, expected) { assert.deepEqual(actual,expected); checks++; }
try {
  await db.exec(await readFile(new URL('tests/database/diary-origin-baseline.sql',root),'utf8'));
  const preflight = (await db.exec(await readFile(new URL('scripts/sql/pr72-preflight.sql',root),'utf8')))[0].rows[0];
  check(preflight.migration_recorded, false);
  check(preflight.new_columns_present, 0);
  await db.exec(await readFile(new URL('supabase/migrations/20260920123852_diary_and_brood_origin.sql',root),'utf8'));
  // Emulate the migration runner's history entry only inside this disposable DB.
  await db.exec("insert into supabase_migrations.schema_migrations values('20260920123852')");
  const postflight = (await db.exec(await readFile(new URL('scripts/sql/pr72-postflight.sql',root),'utf8')))[0].rows[0];
  for (const [key, value] of Object.entries(postflight)) {
    if (key.endsWith('_ok')) check(value, true);
  }
  check(postflight.missing_legacy_links, 0);
  check(postflight.dangling_diary_objects, 0);
  check((await one('select count(*)::int n from diary_entry_hens')).n,1);
  await asUser(1);
  const save = (ids, text='Gemensamt minne', paths=[], target=entry, isNew=false) => db.query('select * from save_diary_entry($1,$2,$3,$4,$5::uuid[],$6::text[],$7)',[target,isNew,'2026-09-01',text,ids,paths,'arrival']);
  await save([hen(1),hen(2)]);
  check((await one('select count(*)::int n from diary_entry_hens where entry_id=$1',[entry])).n,2);
  check((await one('select hen_id from health_logs where id=$1',[entry])).hen_id,null);
  await rejects(() => save([hen(5)],'Must roll back'), /inte tillgänglig/);
  check((await one('select description from health_logs where id=$1',[entry])).description,'Gemensamt minne');
  check((await one('select count(*)::int n from diary_entry_hens where entry_id=$1',[entry])).n,2);
  await save([], 'Retry safe', [], newEntry,true); await save([], 'Retry safe', [],newEntry,true);
  check((await one('select count(*)::int n from health_logs where id=$1',[newEntry])).n,1);
  const path = `${user(1)}/${entry}/${id(7,1)}.jpg`;
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['diary-photos',path]);
  await save([hen(1),hen(2)],'With photo',[path]);
  await rejects(() => save([], 'Too many', Array.from({length:6},(_,n)=>`${user(1)}/${entry}/${id(7,n+1)}.jpg`)), /diary_image_limit/);
  await rejects(() => save([], 'Wrong uploader', [`${user(3)}/${entry}/${id(7,1)}.jpg`]), /egna uppladdningar/);
  await rejects(() => save([], 'Other entry photo', [`${user(1)}/${newEntry}/${id(7,1)}.jpg`]), /Ogiltig bildreferens/);
  await asUser(2);
  check((await one('select count(*)::int n from storage.objects')).n,1);
  await save([hen(2)],'Shared edit',[path]);
  await db.query('delete from storage.objects where name=$1',[path]);
  check((await one('select count(*)::int n from storage.objects')).n,1);
  await asUser(3);
  check((await one('select count(*)::int n from diary_entry_hens')).n,0);
  check((await one('select count(*)::int n from storage.objects')).n,0);
  await rejects(() => save([hen(5)]), /inte längre/);
  await rejects(() => db.query('insert into diary_entry_hens values($1,$2)',[entry,hen(5)]), /row-level security/);
  await asUser(1);
  await save([hen(2)],'Detached',[]);
  await db.query('delete from storage.objects where name=$1',[path]);
  check((await one('select count(*)::int n from storage.objects')).n,0);
  // A member's account cleanup preserves the owner's entry, text, links and
  // other uploaders' images, while removing the deleted member's attachments.
  const memberPath = `${user(2)}/${entry}/${id(7,2)}.jpg`;
  await save([hen(1)], 'Survives member deletion', [path]);
  await asUser(2);
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['diary-photos',memberPath]);
  await save([hen(1)], 'Survives member deletion', [memberPath,path]);
  const detach = () => db.query('select detach_diary_photos_for_deleted_uploader($1)',[user(2)]);
  await rejects(detach, /permission denied/);
  await db.exec("reset role; set role anon; set test.uid=''");
  await rejects(detach, /permission denied/);
  await db.exec('reset role; set role service_role');
  await detach(); await detach();
  check(await one('select description,image_paths from health_logs where id=$1',[entry]),
    {description:'Survives member deletion',image_paths:[path]});
  await asUser(1);
  check((await one('select count(*)::int n from diary_entry_hens where entry_id=$1',[entry])).n,1);
  await db.query('update hens set origin_genbank_number=$1 where id=$2',['GB-123',hen(1)]);
  const parents = [{hen_id:hen(1),role:'mother',name:'Forged name'},{hen_id:hen(2),role:'mother'},{hen_id:hen(3),role:'father'}];
  await db.query('insert into brood_origins(id,user_id,hatching_id,name,date,parents) values($1,$2,$3,$4,$5,$6)',[brood,user(1),id(5,1),'Höstkullen','2026-09-01',JSON.stringify(parents)]);
  const snapshot=(await one('select parents from brood_origins where id=$1',[brood])).parents;
  check(snapshot[0].name,'Blomma'); check(snapshot[0].origin_genbank_number,'GB-123');
  await db.query('update hens set brood_origin_id=$1 where id=$2',[brood,hen(4)]);
  check(await one('select mother_id,father_id from hens where id=$1',[hen(4)]),{mother_id:null,father_id:null});
  await rejects(() => db.query('update hens set brood_origin_id=$1 where id=$2',[brood,hen(1)]), /egen kull/);
  await rejects(() => db.query('update brood_origins set parents=$1 where id=$2',[JSON.stringify([...parents,{hen_id:hen(4),role:'mother'}]),brood]), /egen kull/);
  await rejects(() => db.query('update brood_origins set parents=$1 where id=$2',[JSON.stringify([{hen_id:hen(5),role:'mother'}]),brood]), /inte tillgänglig/);
  await rejects(() => db.query('update brood_origins set parents=$1 where id=$2',[JSON.stringify([{hen_id:hen(3),role:'mother'}]),brood]), /kön/);
  await db.query('update hens set name=$1,origin_genbank_number=$2 where id=$3',['Nytt namn','GB-999',hen(1)]);
  await db.query('delete from hens where id=$1',[hen(2)]);
  await db.query('update brood_origins set name=$1,parents=$2 where id=$3',['Uppdaterat namn',JSON.stringify(parents),brood]);
  check((await one('select parents from brood_origins where id=$1',[brood])).parents,snapshot);
  await db.query('delete from hatchings where id=$1',[id(5,1)]);
  check((await one('select hatching_id from brood_origins where id=$1',[brood])).hatching_id,null);
  await asUser(4);
  check((await one('select count(*)::int n from brood_origins')).n,1);
  check((await db.query("update brood_origins set name='Viewer edit' returning id")).rows.length,0);
  await asUser(3);
  check((await one('select count(*)::int n from brood_origins')).n,0);
  await rejects(() => db.query('update hens set brood_origin_id=$1 where id=$2',[brood,hen(5)]), /inte tillgänglig/);
  await db.exec('reset role; set role anon');
  await rejects(() => save([]), /permission denied/);
  await db.exec('reset role');
  await db.query('delete from auth.users where id=$1',[user(1)]);
  check((await one('select brood_origin_id from hens where id=$1',[hen(4)])).brood_origin_id,null);
  console.log(`PASS: ${checks} database assertions (atomic saves, shared/private access, image validation, historical parent snapshots, uncertain ancestry).`);
} finally { await db.close(); }
