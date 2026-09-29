import { spawnSync } from 'node:child_process';
const requested = process.argv[2];
if (requested && !['ios', 'android'].includes(requested)) throw new Error('Expected ios or android.');
for (const platform of requested ? [requested] : ['ios', 'android']) {
  const result = spawnSync(process.execPath, ['node_modules/@capacitor/cli/bin/capacitor', 'sync', platform], {
    stdio: 'inherit',
    env: { ...process.env, HONSGARDEN_NATIVE_PLATFORM: platform },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
