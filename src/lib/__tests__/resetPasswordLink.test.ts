import { describe, expect, it } from 'vitest';
import { getRecoveryLinkStatus } from '@/lib/resetPasswordLink';

describe('getRecoveryLinkStatus', () => {
  it('behandlar tom URL som saknad länk', () => {
    expect(getRecoveryLinkStatus('', '')).toBe('missing');
    expect(getRecoveryLinkStatus('?', '#')).toBe('missing');
    expect(getRecoveryLinkStatus('/reset-password', '')).toBe('missing');
  });

  it('ignorerar tomma token-värden', () => {
    expect(getRecoveryLinkStatus('?code=', '')).toBe('missing');
    expect(getRecoveryLinkStatus('?token_hash=   ', '')).toBe('missing');
    expect(getRecoveryLinkStatus('', '#access_token=&type=recovery')).toBe('missing');
  });

  it('hittar PKCE-kod i query', () => {
    expect(getRecoveryLinkStatus('?code=abc123', '')).toBe('present');
  });

  it('hittar token_hash och token i query', () => {
    expect(getRecoveryLinkStatus('?token_hash=xyz&type=recovery', '')).toBe('present');
    expect(getRecoveryLinkStatus('?token=xyz&type=recovery', '')).toBe('present');
  });

  it('hittar implicit recovery-hash', () => {
    expect(getRecoveryLinkStatus('', '#access_token=aaa&refresh_token=bbb&type=recovery')).toBe('present');
  });

  it('behandlar error i hash eller query som ogiltig länk', () => {
    expect(
      getRecoveryLinkStatus('', '#error=access_denied&error_code=otp_expired&error_description=expired'),
    ).toBe('error');
    expect(getRecoveryLinkStatus('?error=access_denied', '')).toBe('error');
  });

  it('prioriterar error framför token om båda finns', () => {
    expect(getRecoveryLinkStatus('?code=abc&error=access_denied', '')).toBe('error');
  });
});
