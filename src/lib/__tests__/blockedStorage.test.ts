import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';

const originalLocal = Object.getOwnPropertyDescriptor(window, 'localStorage')!;
const originalSession = Object.getOwnPropertyDescriptor(window, 'sessionStorage')!;
const bootstrap = new DOMParser().parseFromString(readFileSync('index.html', 'utf8'), 'text/html')
  .querySelector('#storage-fallback')!.textContent!;

afterEach(() => {
  Object.defineProperty(window, 'localStorage', originalLocal);
  Object.defineProperty(window, 'sessionStorage', originalSession);
  vi.restoreAllMocks();
});

it('preserves working browser storage', () => {
  const persistent = window.localStorage;
  const perTab = window.sessionStorage;
  window.eval(bootstrap);
  expect(window.localStorage).toBe(persistent);
  expect(window.sessionStorage).toBe(perTab);
});

it.each(['property', 'reads'])('loads the real auth SDK when browser storage blocks %s', async blocked => {
  const perTab = window.sessionStorage;
  const persistent = window.localStorage;
  const deny = () => { throw new DOMException('Storage blocked', 'SecurityError'); };
  if (blocked === 'property') Object.defineProperty(window, 'localStorage', { configurable: true, get: deny });
  else {
    const get = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(this: Storage, key) {
      return this === persistent ? deny() : get.call(this, key);
    });
  }
  window.eval(bootstrap);
  expect(window.sessionStorage).toBe(perTab);
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient('https://example.supabase.co', 'example-key', {
    auth: { storage: window.localStorage, autoRefreshToken: false, detectSessionInUrl: false },
  });
  expect((await client.auth.getSession()).data.session).toBeNull();
  window.localStorage.setItem('key', 'value');
  expect(window.localStorage.getItem('key')).toBe('value');
  window.localStorage.removeItem('key');
  expect(window.localStorage.getItem('key')).toBeNull();
});
