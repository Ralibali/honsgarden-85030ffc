import { afterEach, expect, it, vi } from 'vitest';
import { loginDestination, pendingLoginDestination, rememberLoginDestination } from '../loginDestination';

afterEach(() => {
  vi.useRealTimers();
  sessionStorage.clear();
});

it('keeps the intended app view, marketplace or invitation', () => {
  const invite = '/inbjudan/' + 'a'.repeat(64);
  for (const path of ['/app/eggs?log=1', '/marknad/ny', invite]) {
    expect(loginDestination(path)).toBe(path);
  }
  for (const path of ['https://example.com', '//example.com', '/login', '/app#access_token=callback']) {
    expect(loginDestination(path)).toBeNull();
  }
});

it('restores the destination in the same tab until used or expired', () => {
  vi.useFakeTimers();
  rememberLoginDestination('/marknad/ny');
  expect(pendingLoginDestination()).toBe('/marknad/ny');
  vi.advanceTimersByTime(60 * 60 * 1000);
  expect(pendingLoginDestination()).toBeNull();
  rememberLoginDestination('/app/eggs');
  rememberLoginDestination(null);
  expect(pendingLoginDestination()).toBeNull();
});
