import { describe, expect, it } from 'vitest';
import { pushNotificationPath } from '../pushNotificationPath';

describe('notification destinations', () => {
  it.each([null, {}, 'https://example.com/app', '//example.com/app', '/app/../../login', '/application', '/app\\evil'])('rejects %j', value => {
    expect(pushNotificationPath(value)).toBeNull();
  });
  it('keeps a destination inside the signed-in app', () => {
    expect(pushNotificationPath('/app/dagbok?day=2026-09-08#entry')).toBe('/app/dagbok?day=2026-09-08#entry');
  });
});
