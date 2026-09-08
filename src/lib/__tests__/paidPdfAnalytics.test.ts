import { afterEach, describe, expect, it, vi } from 'vitest';
import { trackPaidPdfDownload } from '../paidPdfAnalytics';

afterEach(() => { delete window.plausible; vi.useRealTimers(); window.history.replaceState({}, '', '/'); });
describe('paid PDF tracking', () => {
  it('sends the product and entry point without purchase tokens or query parameters', async () => {
    window.history.replaceState({}, '', '/guider/mina-forsta-hons/hamta?t=secret&session_id=private');
    const spy = vi.fn((_event, options) => options.callback());
    window.plausible = spy;
    await trackPaidPdfDownload('mina-forsta-hons', 'email_link');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy.mock.calls[0][0]).toBe('Paid PDF Download');
    expect(spy.mock.calls[0][1]).toMatchObject({
      props: { product: 'mina-forsta-hons', source: 'email_link' },
      url: window.location.origin + '/guider/mina-forsta-hons/hamta',
    });
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/secret|private|session_id/);
  });
  it('never blocks delivery when the tracker is unavailable or throws', async () => {
    await trackPaidPdfDownload('klackdagboken', 'thank_you');
    window.plausible = () => { throw new Error('blocked'); };
    await trackPaidPdfDownload('klackdagboken', 'thank_you');
  });
  it('continues after a bounded timeout if the tracker never replies', async () => {
    vi.useFakeTimers(); window.plausible = vi.fn();
    const done = vi.fn();
    const pending = trackPaidPdfDownload('vinterklar-honsgard', 'thank_you').then(done);
    await vi.advanceTimersByTimeAsync(749); expect(done).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); await pending; expect(done).toHaveBeenCalledOnce();
  });
});
