// Real Auth + REST + Storage checks. Only run against an isolated schema copy.
// Creates disposable users; credentials stay in memory and are never printed.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}; see docs/releases/pr72.md`);
  return value;
};
const url = new URL(required('DIARY_QA_URL'));
const ref = required('DIARY_QA_PROJECT_REF');
assert.match(ref, /^[a-z]{20}$/);
assert.equal(url.origin, `https://${ref}.supabase.co`);
assert.equal(url.pathname, '/');
assert.equal(url.search + url.hash + url.username + url.password, '');
assert.notEqual(ref, 'sikbymtrbhrofysgkqsj', 'This runner refuses the production project');
assert.equal(required('DIARY_QA_CONFIRM'), 'isolated-test-project');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const anonKey = required('DIARY_QA_ANON_KEY');
const admin = createClient(url.origin, required('DIARY_QA_SERVICE_ROLE_KEY'), options);
const client = () => createClient(url.origin, anonKey, options);
const runId = randomUUID();
console.log(`PR72 isolated QA run ${runId}; project ${ref}`);
const actors = [];
const objectPaths = new Set();
const entry = randomUUID(), brood = randomUUID();
let checks = 0;
async function ok(result, label) {
  const { data, error } = await result;
  // Print only the step and code, never server payloads, tokens or signed URLs.
  if (error) throw new Error(`${label}: ${error.code ?? error.statusCode ?? error.name ?? 'request failed'}`);
  return data;
}
function check(value, label) { assert.ok(value, label); checks++; }
async function denied(result, label) {
  const { error } = await result;
  check(Boolean(error), label);
}
const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const bucket = c => c.storage.from('diary-photos');
async function upload(actor, target = entry, body = photo, contentType = 'image/png') {
  const path = `${actor.id}/${target}/${randomUUID()}.png`;
  objectPaths.add(path); // Include attempted uploads in cleanup after a lost response.
  await ok(bucket(actor.client).upload(path, body, { contentType, upsert: false }), 'upload');
  return path;
}
const save = (actor, paths, hens, isNew = false) => actor.client.rpc('save_diary_entry', {
  _id: entry, _is_new: isNew, _date: '2026-09-01', _description: `PR72 QA ${runId}`,
  _hen_ids: hens, _image_paths: paths, _milestone: 'arrival',
});

try {
  const config = await ok(admin.storage.getBucket('diary-photos'), 'migrated bucket');
  check(config.public === false && Number(config.file_size_limit) === 5242880, 'private 5 MiB bucket');
  for (const role of ['owner', 'editor', 'viewer', 'outsider']) {
    const password = randomBytes(32).toString('base64url');
    const email = `pr72-${runId}-${role}@honsgarden.test`;
    const { user } = await ok(admin.auth.admin.createUser({
      email, password, email_confirm: true, app_metadata: { pr72_qa_run: runId },
    }), `create ${role}`);
    const actor = { id: user.id, role, client: client() };
    actors.push(actor);
    const login = await ok(actor.client.auth.signInWithPassword({ email, password }), `login ${role}`);
    check(login.user.id === actor.id, `real ${role} session`);
  }
  const [owner, editor, viewer, outsider] = actors;
  let farm = await ok(admin.from('coop_settings').select('id').eq('user_id', owner.id).maybeSingle(), 'find QA farm');
  if (!farm) farm = await ok(admin.from('coop_settings').insert({ user_id: owner.id, coop_name: `PR72 QA ${runId}` }).select('id').single(), 'create QA farm');
  await ok(admin.from('farm_members').upsert([
    { farm_id: farm.id, user_id: owner.id, role: 'owner' },
    { farm_id: farm.id, user_id: editor.id, role: 'editor' },
    { farm_id: farm.id, user_id: viewer.id, role: 'viewer' },
  ], { onConflict: 'farm_id,user_id' }), 'share QA farm');
  const hens = await ok(owner.client.from('hens').insert([
    { user_id: owner.id, name: 'QA Blomma', hen_type: 'hen', origin_genbank_number: 'QA-123', birth_date: '2024-01-01' },
    { user_id: owner.id, name: 'QA Ture', hen_type: 'rooster', birth_date: '2024-01-01' },
  ]).select('id,hen_type'), 'create QA hens');
  const henIds = hens.map(h => h.id);
  const ownerPath = await upload(owner);
  await denied(bucket(editor.client).createSignedUrl(ownerPath, 60), 'unattached draft is private');
  await ok(save(owner, [ownerPath], henIds, true), 'save owner diary');
  await ok(save(owner, [ownerPath], henIds, true), 'retry same diary ID');
  const links = await ok(editor.client.from('diary_entry_hens').select('hen_id').eq('entry_id', entry), 'shared links');
  check(links.length === 2, 'one saved entry links both hens');
  for (const actor of [owner, editor, viewer]) {
    const signed = await ok(bucket(actor.client).createSignedUrl(ownerPath, 60), `${actor.role} signed URL`);
    const response = await fetch(signed.signedUrl);
    check(response.ok && Buffer.from(await response.arrayBuffer()).equals(photo), `${actor.role} real image bytes`);
  }
  for (const actor of [outsider.client, client()]) {
    await denied(bucket(actor).download(ownerPath), 'outsider/anon cannot download');
    await denied(bucket(actor).createSignedUrl(ownerPath, 60), 'outsider/anon cannot mint URL');
  }
  const publicResponse = await fetch(`${url.origin}/storage/v1/object/public/diary-photos/${ownerPath}`);
  check(!publicResponse.ok, 'no public object URL');
  const hidden = await ok(outsider.client.from('health_logs').select('id').eq('id', entry), 'outsider diary query');
  check(hidden.length === 0, 'outsider cannot read entry');
  await denied(save(outsider, [], []), 'outsider cannot edit entry');
  const foreignPath = `${owner.id}/${entry}/${randomUUID()}.png`;
  objectPaths.add(foreignPath);
  await denied(bucket(outsider.client).upload(foreignPath, photo, { contentType: 'image/png' }), 'cannot upload to another user');
  const wrongType = `${owner.id}/${entry}/${randomUUID()}.txt`;
  const tooLarge = `${owner.id}/${entry}/${randomUUID()}.png`;
  objectPaths.add(wrongType); objectPaths.add(tooLarge);
  await denied(bucket(owner.client).upload(wrongType, 'test', { contentType: 'text/plain' }), 'MIME limit');
  await denied(bucket(owner.client).upload(tooLarge, Buffer.alloc(5242881), { contentType: 'image/png' }), 'size limit');
  await bucket(owner.client).remove([ownerPath]);
  await ok(bucket(owner.client).download(ownerPath), 'attached object survives deletion attempt');
  checks++;
  const editorPath = await upload(editor);
  await ok(save(editor, [ownerPath, editorPath], henIds), 'shared editor adds own photo');
  await denied(editor.client.rpc('detach_diary_photos_for_deleted_uploader', { _user_id: owner.id }), 'cleanup RPC is server-only');
  await ok(admin.rpc('detach_diary_photos_for_deleted_uploader', { _user_id: editor.id }), 'detach deleted uploader');
  const kept = await ok(owner.client.from('health_logs').select('image_paths,description').eq('id', entry).single(), 'surviving entry');
  check(kept.image_paths.length === 1 && kept.image_paths[0] === ownerPath, 'other uploader survives account cleanup');
  await ok(bucket(editor.client).remove([editorPath]), 'remove detached editor image');
  await denied(bucket(editor.client).download(editorPath), 'removed blob is absent');

  await ok(owner.client.from('brood_origins').insert({ id: brood, user_id: owner.id, name: 'QA kull', date: '2026-09-01',
    parents: hens.map(h => ({ hen_id: h.id, role: h.hen_type === 'rooster' ? 'father' : 'mother' })),
  }), 'save parent snapshot');
  const visible = await ok(viewer.client.from('brood_origins').select('parents').eq('id', brood).single(), 'viewer reads brood');
  check(visible.parents.length === 2, 'parent group readable');
  const blockedWrite = await ok(viewer.client.from('brood_origins').update({ name: 'Forbidden' }).eq('id', brood).select('id'), 'viewer update');
  check(blockedWrite.length === 0, 'viewer cannot change brood');
  const hiddenBrood = await ok(outsider.client.from('brood_origins').select('id').eq('id', brood), 'outsider brood query');
  check(hiddenBrood.length === 0, 'brood stays within farm');

  await ok(save(editor, [], henIds), 'shared member detaches owner image');
  await denied(bucket(editor.client).download(ownerPath), 'member loses access after detachment');
  // SELECT no longer exposes the detached object to the member; uploader cleans it.
  await ok(bucket(owner.client).remove([ownerPath]), 'uploader removes detached object');
  await denied(bucket(owner.client).download(ownerPath), 'detached owner blob is absent');
  console.log(`PASS: ${checks} live Auth/REST/Storage checks. Run ${runId}. Browser, backup and account endpoints still require the release checklist.`);
} finally {
  // Limit cleanup to this run's generated IDs and paths; never touch existing users.
  const cleanupErrors = [];
  const clean = async (operation, label) => {
    try { await ok(operation(), label); } catch { cleanupErrors.push(label); }
  };
  await clean(() => admin.from('health_logs').delete().eq('id', entry), 'QA entry');
  await clean(() => admin.from('brood_origins').delete().eq('id', brood), 'QA brood');
  if (objectPaths.size) await clean(() => bucket(admin).remove([...objectPaths]), 'QA objects');
  for (const actor of actors.toReversed()) {
    for (const table of ['hens', 'farm_members', 'coop_settings']) {
      await clean(() => admin.from(table).delete().eq('user_id', actor.id), `QA ${actor.role} ${table}`);
    }
    await clean(() => actor.client.auth.signOut(), `QA ${actor.role} logout`);
    await clean(() => admin.auth.admin.deleteUser(actor.id), `QA ${actor.role} account`);
  }
  if (cleanupErrors.length) {
    console.error(`Cleanup incomplete for run ${runId}: ${cleanupErrors.join(', ')}. Inspect only users tagged app_metadata.pr72_qa_run=${runId}.`);
    process.exitCode = 1;
  }
}
