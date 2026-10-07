import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveWeatherLocation } from '@/lib/weatherLocation';
vi.mock('@/lib/brand', () => ({ isInternationalDomain: () => false }));
vi.mock('@/lib/reverseGeocode', () => ({ reverseGeocodeCity: vi.fn() }));
afterEach(() => vi.unstubAllGlobals());

describe('farm weather location', () => {
  it('uses the saved farm location before device geolocation', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ name: 'Linköping', latitude: 58.41, longitude: 15.62 }] }) });
    vi.stubGlobal('fetch', fetch);
    const location = await resolveWeatherLocation({ city: 'Linköping', postal_code: '58220' });
    expect(location).toEqual({ lat: 58.41, lon: 15.62, city: 'Linköping', source: 'farm' });
    expect(String(fetch.mock.calls[0][0])).toContain('name=58220');
  });

  it('tries the city when the postcode has no result', async () => {
    const fetch = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ results: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [{ name: 'Linköping', latitude: 58.41, longitude: 15.62 }] }) });
    vi.stubGlobal('fetch', fetch);
    expect((await resolveWeatherLocation({ city: 'Linköping', postal_code: '58220' })).city).toBe('Linköping');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('asks for a valid saved location instead of falling back to Stockholm', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }));
    await expect(resolveWeatherLocation({ city: 'Okänd ort' })).rejects.toThrow('Kontrollera ort och postnummer');
  });

  it('does not invent a location when permission is denied', async () => {
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (_: unknown, fail: () => void) => fail() } });
    await expect(resolveWeatherLocation({})).rejects.toThrow('Fyll i gårdens ort');
  });
});
