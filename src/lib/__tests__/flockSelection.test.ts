import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_FLOCK_NAME,
  readActiveFlockId,
  resolveFlockIdForHenCreate,
  writeActiveFlockId,
} from '@/lib/flockSelection';

describe('resolveFlockIdForHenCreate', () => {
  const honsuset = { id: 'flock-honsuset', name: 'Hönshuset' };
  const minFlock = { id: 'flock-default', name: DEFAULT_FLOCK_NAME };
  const garden = { id: 'flock-garden', name: 'Stora hönsgården' };

  it('använder det flock-id användaren valt i formuläret', () => {
    expect(
      resolveFlockIdForHenCreate({
        explicitFlockId: garden.id,
        preferredFlockId: honsuset.id,
        flocks: [honsuset, garden],
      }),
    ).toBe(garden.id);
  });

  it('använder onboarding-/aktiv flock när formuläret är tomt', () => {
    expect(
      resolveFlockIdForHenCreate({
        explicitFlockId: '',
        preferredFlockId: honsuset.id,
        flocks: [minFlock, honsuset],
      }),
    ).toBe(honsuset.id);
  });

  it('föredrar namngiven flock framför tyst skapad Min flock', () => {
    expect(
      resolveFlockIdForHenCreate({
        flocks: [minFlock, honsuset],
      }),
    ).toBe(honsuset.id);
  });

  it('returnerar null när det inte finns någon flock – då får default skapas', () => {
    expect(resolveFlockIdForHenCreate({ flocks: [] })).toBeNull();
  });

  it('ignorerar ett preferred-id som inte längre finns', () => {
    expect(
      resolveFlockIdForHenCreate({
        preferredFlockId: 'missing',
        flocks: [honsuset],
      }),
    ).toBe(honsuset.id);
  });
});

describe('active flock storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sparar och läser tillbaka onboarding-vald flock per användare', () => {
    writeActiveFlockId('user-1', 'flock-honsuset');
    expect(readActiveFlockId('user-1')).toBe('flock-honsuset');
    expect(readActiveFlockId('user-2')).toBeNull();
  });
});
