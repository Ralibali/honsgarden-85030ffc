import { isInternationalDomain } from '@/lib/brand';
import { withRequestTimeout } from '@/lib/requestTimeout';
import { reverseGeocodeCity } from '@/lib/reverseGeocode';

export type WeatherSettings = { city?: string | null; postal_code?: string | null };

/** Saved farm location takes precedence over the device's location. Never invent a city. */
export async function resolveWeatherLocation(settings?: WeatherSettings | null) {
  const terms = [...new Set([settings?.postal_code?.trim(), settings?.city?.trim()].filter((term): term is string => !!term))];
  if (terms.length) {
    for (const term of terms) {
      const params = new URLSearchParams({ name: term, count: '5', language: 'sv', format: 'json' });
      if (!isInternationalDomain()) params.set('countryCode', 'SE');
      const data = await withRequestTimeout(async (signal) => {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, { signal });
        if (!response.ok) throw new Error('Kunde inte hitta gårdens ort. Försök igen.');
        return response.json();
      });
      const place = data.results?.find((result: { latitude?: number; longitude?: number }) => Number.isFinite(result.latitude) && Number.isFinite(result.longitude));
      if (place) return { lat: Number(place.latitude), lon: Number(place.longitude), city: String(place.name), source: 'farm' as const };
    }
    throw new Error('Gårdens ort hittades inte. Kontrollera ort och postnummer i Inställningar.');
  }

  const position = await withRequestTimeout(() => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Fyll i gårdens ort i Inställningar för att visa rätt väder.'));
    navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Fyll i gårdens ort i Inställningar eller tillåt platsåtkomst för att visa rätt väder.')), { timeout: 5000, maximumAge: 10 * 60 * 1000 });
  }), 6_000);
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const city = await withRequestTimeout(() => reverseGeocodeCity(lat, lon), 5_000).catch(() => null);
  return { lat, lon, city: city || 'Din nuvarande plats', source: 'device' as const };
}
