import React, { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DailySummaryModal } from '@/components/DailySummaryModal';
const summary = vi.hoisted(() => vi.fn(async () => ({ eggs: 5 })));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'summary-user' } }) }));
vi.mock('@/lib/api', () => ({ api: { getYesterdaySummary: summary } }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T12:00:00')); localStorage.clear(); summary.mockClear(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it('opens once per day through StrictMode and remounts, then again next day', async () => {
  const first = render(<StrictMode><DailySummaryModal /></StrictMode>);
  await act(async () => { await vi.advanceTimersByTimeAsync(900); });
  expect(summary).toHaveBeenCalledTimes(1);
  first.unmount();
  const second = render(<DailySummaryModal />);
  await act(async () => { await vi.advanceTimersByTimeAsync(900); });
  expect(summary).toHaveBeenCalledTimes(1);
  second.unmount();
  vi.setSystemTime(new Date('2026-09-24T12:00:00'));
  render(<DailySummaryModal />);
  await act(async () => { await vi.advanceTimersByTimeAsync(900); });
  expect(summary).toHaveBeenCalledTimes(2);
});
