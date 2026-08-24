import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FarmWeather {
  tempCurrent: number | null;
  tempMin7d: number | null;
  tempMax7d: number | null;
  precipSum7d: number | null;
  hasFrostSoon: boolean;
  hasHeatwaveSoon: boolean;
}

async function getCoords(): Promise<{ lat: number; lon: number } | null> {
  const { data } = await supabase
    .from('coop_settings')
    .select('latitude, longitude')
    .limit(1)
    .maybeSingle();
  if (data?.latitude != null && data?.longitude != null) {
    return { lat: Number(data.latitude), lon: Number(data.longitude) };
  }
  return null;
}

async function fetchFarmWeather(): Promise<FarmWeather | null> {
  const coords = await getCoords();
  if (!coords) return null;
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}` +
    `&current=temperature_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=auto&forecast_days=7`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const j = await res.json();
  const tMax: number[] = j?.daily?.temperature_2m_max ?? [];
  const tMin: number[] = j?.daily?.temperature_2m_min ?? [];
  const precip: number[] = j?.daily?.precipitation_sum ?? [];
  return {
    tempCurrent: j?.current?.temperature_2m ?? null,
    tempMin7d: tMin.length ? Math.min(...tMin) : null,
    tempMax7d: tMax.length ? Math.max(...tMax) : null,
    precipSum7d: precip.length ? precip.reduce((s, x) => s + (x ?? 0), 0) : null,
    hasFrostSoon: tMin.some((t) => t <= 0),
    hasHeatwaveSoon: tMax.some((t) => t >= 28),
  };
}

export function useFarmWeather(enabled = true) {
  return useQuery({
    queryKey: ['farm-weather'],
    queryFn: fetchFarmWeather,
    enabled,
    staleTime: 60 * 60_000, // 1h
    retry: false,
  });
}
