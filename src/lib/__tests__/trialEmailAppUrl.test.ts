import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  path.resolve(process.cwd(), 'supabase/functions/trial-email-sequence/index.ts'),
  'utf8',
);

describe('trial-email-sequence APP_URL', () => {
  it('points CTAs at production, not Lovable', () => {
    expect(source).toContain('const APP_URL = "https://honsgarden.se";');
    expect(source).toContain('${APP_URL}/app/premium');
    expect(source).not.toContain('honsgarden.lovable.app');
    expect(source).not.toMatch(/const APP_URL = "[^"]+\/";/);
  });
});
