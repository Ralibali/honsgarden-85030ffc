import { describe, expect, it, vi } from 'vitest';
import {
  buildMapsUrl,
  buildSwishLink,
  eggOrderDateTime,
  eggOrderStatusLabels,
  eggOrderSteps,
} from '@/lib/eggOrderPortal';

describe('egg order portal helpers', () => {
  it('contains the complete customer status flow', () => {
    expect(eggOrderSteps).toEqual(['reserved', 'confirmed', 'paid', 'packed', 'ready', 'picked_up']);
    expect(eggOrderStatusLabels.ready).toBe('Klar att hämtas');
  });

  it('creates a locked Swish payment link', () => {
    const link = buildSwishLink({
      swish_number: '070-123 45 67',
      total_amount: 120,
      booking_reference: 'AGD-12345',
    });
    expect(link.startsWith('swish://payment?data=')).toBe(true);
    const payload = JSON.parse(decodeURIComponent(link.split('data=')[1]));
    expect(payload.payee.value).toBe('0701234567');
    expect(payload.amount.value).toBe(120);
    expect(payload.amount.editable).toBe(false);
    expect(payload.message.value).toBe('AGD-12345');
  });

  it('creates map links from coordinates without exposing unrelated data', () => {
    const google = buildMapsUrl({ latitude: 58.4, longitude: 15.6, customer_email: 'private@example.com' });
    const apple = buildMapsUrl({ latitude: 58.4, longitude: 15.6 }, true);
    expect(google).toContain('58.4%2C15.6');
    expect(google).not.toContain('private');
    expect(apple).toContain('maps.apple.com');
  });

  it('formats missing pickup time safely', () => {
    expect(eggOrderDateTime(null)).toBe('Inte vald');
  });
});
