/**
 * Reverse geocoding via Nominatim med sessionStorage-cache.
 *
 * Nominatim har en ToS på max 1 req/sek per IP och uppmanar till cachning.
 * Vi cachar per ~0.01° (≈1.1 km) i sessionStorage så att användaren bara
 * pingar Nominatim när positionen faktiskt ändrats märkbart – inte på
 * varje dashboard-reload.
 */

const CACHE_KEY_PREFIX = 'geo-rev:';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 h (sessionStorage rensas ändå vid stängd flik)

type CacheEntry = { city: string | null; ts: number };

function roundCoord(n: number): string {
  // 2 decimaler ≈ 1.1 km – tillräckligt för stadsnamn
  return n.toFixed(2);
}

function cacheKey(lat: number, lon: number) {
  return `${CACHE_KEY_PREFIX}${roundCoord(lat)},${roundCoord(lon)}`;
}

function readCache(lat: number, lon: number): string | null | undefined {
  try {
    const raw = sessionStorage.getItem(cacheKey(lat, lon));
    if (!raw) return undefined;
    const entry: CacheEntry = JSON.parse(raw);
    if (!entry || typeof entry.ts !== 'number') return undefined;
    if (Date.now() - entry.ts > SESSION_TTL_MS) return undefined;
    return entry.city;
  } catch {
    return undefined;
  }
}

function writeCache(lat: number, lon: number, city: string | null) {
  try {
    const entry: CacheEntry = { city, ts: Date.now() };
    sessionStorage.setItem(cacheKey(lat, lon), JSON.stringify(entry));
  } catch {
    /* ignorera quota-fel – cachning är best-effort */
  }
}

/**
 * Hämtar stadsnamn för givna koordinater. Returnerar null om inget hittas
 * eller om Nominatim är otillgängligt. Cachas i sessionStorage.
 */
export async function reverseGeocodeCity(lat: number, lon: number): Promise<string | null> {
  const cached = readCache(lat, lon);
  if (cached !== undefined) return cached;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=sv`,
    );
    if (!res.ok) {
      writeCache(lat, lon, null);
      return null;
    }
    const data = await res.json();
    const city: string | null =
      data?.address?.city ||
      data?.address?.town ||
      data?.address?.village ||
      data?.address?.municipality ||
      null;
    writeCache(lat, lon, city);
    return city;
  } catch (err) {
    console.warn('[reverseGeocodeCity] Nominatim misslyckades:', err);
    writeCache(lat, lon, null);
    return null;
  }
}
