import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForPwaUpdate } from '../pwaUpdate';

const installed = '2026-11-24T08:00:00.000Z';
afterEach(() => vi.unstubAllGlobals());

describe('web app version check', () => {
  it.each([[installed, false], ['2026-11-25T08:00:00.000Z', true]] as const)(
    'compares the deployed build %s without a service worker',
    async (buildTime, hasUpdate) => {
      vi.stubGlobal('__BUILD_TIME__', installed);
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ buildTime })));
      expect(await checkForPwaUpdate()).toEqual({ hasUpdate });
      expect(fetch).toHaveBeenCalledWith('/app-version.json', expect.objectContaining({ cache: 'no-store' }));
    },
  );
  it.each([Response.json({}), new Response('<html>'), new Error('offline')])(
    'reports an unavailable version without claiming the app is current',
    async response => {
      const request = vi.fn();
      if (response instanceof Error) request.mockRejectedValue(response);
      else request.mockResolvedValue(response);
      vi.stubGlobal('fetch', request);
      expect((await checkForPwaUpdate()).error).toBeTruthy();
    },
  );
});
