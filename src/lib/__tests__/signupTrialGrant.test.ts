import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260823180000_fix_signup_trial_grant.sql'),
  'utf8',
);

describe('signup trial grant migration', () => {
  it('grants a 7-day trial on both handle_new_user insert levels', () => {
    const trialAssigns = migration.match(/'premium',\s*v_trial_end/g) ?? [];
    expect(trialAssigns.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("now() + interval '7 days'");
    expect(migration).toContain('sync_profile_from_auth');
    expect(migration).toContain('auth.uid() IS NULL');
    expect(migration).toMatch(/INSERT INTO public\.profiles \([\s\S]*subscription_status, premium_expires_at, is_lifetime_premium/);
  });

  it('does not leave the minimal fallback on free defaults', () => {
    expect(migration).not.toMatch(
      /INSERT INTO public\.profiles \(user_id, email, display_name, avatar_url\)\s+VALUES/,
    );
  });
});
