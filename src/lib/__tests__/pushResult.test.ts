import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { pushDelivered } from '../../../supabase/functions/_shared/pushResult';

describe('pushDelivered', () => {
  it('räknar bara notiser som faktiskt lämnades över', () => {
    expect(pushDelivered({ data: { sent: 1, web_sent: 1, native_sent: 0 }, error: null })).toBe(true);
    expect(pushDelivered({ data: { sent: 3 }, error: null })).toBe(true);
  });

  it('säger nej när send-push svarade 200 men inget gick fram', () => {
    // Död prenumeration som just rensades, eller web push utan nycklar.
    expect(pushDelivered({ data: { sent: 0, pruned: 1 }, error: null })).toBe(false);
    expect(pushDelivered({ data: { sent: 0 }, error: null })).toBe(false);
  });

  it('säger nej vid fel eller oväntat svar', () => {
    expect(pushDelivered({ data: null, error: new Error('Edge Function returned a non-2xx status code') })).toBe(false);
    expect(pushDelivered({ data: { sent: 2 }, error: { message: 'timeout' } })).toBe(false);
    expect(pushDelivered({ data: { error: 'Web push unavailable' }, error: null })).toBe(false);
    expect(pushDelivered({ data: { sent: '1' }, error: null })).toBe(false);
    expect(pushDelivered({ data: null, error: null })).toBe(false);
    expect(pushDelivered(null)).toBe(false);
    expect(pushDelivered(undefined)).toBe(false);
  });
});

describe('daily-egg-reminder', () => {
  const source = readFileSync('supabase/functions/daily-egg-reminder/index.ts', 'utf8');

  it('hoppar bara över mejlet när notisen bevisligen gick fram', () => {
    expect(source).toContain('pushed = pushDelivered(pushResponse);');
    // Mejlet byggs efter push-försöket, och det enda som hoppar över det är `pushed`.
    const pushBlock = source.slice(source.indexOf('let pushed = false;'), source.indexOf('const subject ='));
    expect(pushBlock.match(/continue;/g)).toHaveLength(1);
    expect(pushBlock).toMatch(/if \(pushed\) \{\s*sent\+\+;\s*continue;\s*\}/);
  });

  it('försöker med push även för den som bara har appen', () => {
    expect(source).toContain('supabase.from("device_tokens")');
    expect(source).toContain('supabase.from("push_subscriptions")');
  });
});
