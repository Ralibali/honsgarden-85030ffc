import { useEffect } from 'react';

type HeroTime = 'day' | 'dusk' | 'night';
type HeroWeather = 'clear' | 'cloudy' | 'rain' | 'snow';
type HeroSeason = 'spring' | 'summer' | 'autumn' | 'winter';

type IpLocation = {
  success?: boolean;
  latitude?: number;
  longitude?: number;
  city?: string;
  timezone?: { id?: string };
};

type OpenMeteoCurrent = {
  time?: string;
  weather_code?: number;
  is_day?: number;
  precipitation?: number;
  rain?: number;
  snowfall?: number;
  cloud_cover?: number;
};

type OpenMeteoResponse = {
  current?: OpenMeteoCurrent;
  daily?: {
    sunrise?: string[];
    sunset?: string[];
  };
};

const minutesFromIsoLocal = (value?: string) => {
  if (!value) return null;
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
};

const seasonFor = (month: number, latitude = 59): HeroSeason => {
  const northernMonth = latitude >= 0 ? month : ((month + 5) % 12) + 1;
  if (northernMonth >= 3 && northernMonth <= 5) return 'spring';
  if (northernMonth >= 6 && northernMonth <= 8) return 'summer';
  if (northernMonth >= 9 && northernMonth <= 11) return 'autumn';
  return 'winter';
};

const localFallbackTime = (): HeroTime => {
  const hour = new Date().getHours();
  if (hour >= 7 && hour < 18) return 'day';
  if (hour >= 18 && hour < 21) return 'dusk';
  return 'night';
};

const timeFromWeather = (weather: OpenMeteoResponse): HeroTime => {
  const current = weather.current;
  const now = minutesFromIsoLocal(current?.time);
  const sunrise = minutesFromIsoLocal(weather.daily?.sunrise?.[0]);
  const sunset = minutesFromIsoLocal(weather.daily?.sunset?.[0]);

  if (now !== null && sunrise !== null && sunset !== null) {
    if (now >= sunrise - 35 && now <= sunrise + 55) return 'dusk';
    if (now >= sunset - 75 && now <= sunset + 65) return 'dusk';
  }

  return current?.is_day === 0 ? 'night' : 'day';
};

const weatherKind = (current?: OpenMeteoCurrent): HeroWeather => {
  if (!current) return 'clear';

  const code = current.weather_code ?? 0;
  const snowCodes = new Set([71, 73, 75, 77, 85, 86]);
  const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

  if ((current.snowfall ?? 0) > 0 || snowCodes.has(code)) return 'snow';
  if ((current.rain ?? 0) > 0 || (current.precipitation ?? 0) > 0 || rainCodes.has(code)) return 'rain';
  if ((current.cloud_cover ?? 0) >= 58 || [2, 3, 45, 48].includes(code)) return 'cloudy';
  return 'clear';
};

/**
 * Drives the public landing hero from the visitor's approximate IP location.
 * Falls back to the browser clock if either public endpoint is unavailable.
 */
export function useLandingAtmosphere() {
  useEffect(() => {
    const root = document.documentElement;
    const now = new Date();

    root.dataset.heroTime = localFallbackTime();
    root.dataset.heroWeather = 'clear';
    root.dataset.heroSeason = seasonFor(now.getMonth() + 1);

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5500);

    const load = async () => {
      try {
        const geoResponse = await fetch('https://ipwho.is/', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!geoResponse.ok) return;

        const geo = await geoResponse.json() as IpLocation;
        const latitude = Number(geo.latitude);
        const longitude = Number(geo.longitude);
        if (geo.success === false || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

        const params = new URLSearchParams({
          latitude: latitude.toFixed(4),
          longitude: longitude.toFixed(4),
          current: 'weather_code,is_day,precipitation,rain,snowfall,cloud_cover',
          daily: 'sunrise,sunset',
          forecast_days: '1',
          timezone: 'auto',
        });

        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!weatherResponse.ok) return;

        const weather = await weatherResponse.json() as OpenMeteoResponse;
        const currentIso = weather.current?.time;
        const month = currentIso ? Number(currentIso.slice(5, 7)) : now.getMonth() + 1;

        root.dataset.heroTime = timeFromWeather(weather);
        root.dataset.heroWeather = weatherKind(weather.current);
        root.dataset.heroSeason = seasonFor(month, latitude);
        if (geo.city) root.dataset.heroCity = geo.city;
      } catch (error) {
        if ((error as DOMException)?.name !== 'AbortError') {
          console.debug('[landing-atmosphere] fallback active');
        }
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void load();

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
      delete root.dataset.heroCity;
    };
  }, []);
}
