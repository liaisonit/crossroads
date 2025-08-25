
'use server';

import type { WeatherOutput } from '@/lib/types';

export async function getWeatherForJob(
  location: string,
  apiKey: string
): Promise<{ data?: WeatherOutput; error?: string }> {
  if (!location) {
    return { error: 'Location is required.' };
  }
  if (!apiKey) {
    return { error: 'Weather API key is missing.' };
  }

  try {
    const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(
      location
    )}`;

    const res = await fetch(url, { cache: 'no-store' });
    const body: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg =
        body?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
      console.error('Weather API error', { location, msg, body });
      return { error: `Weather lookup failed: ${msg}` };
    }

    const cur = body?.current;
    if (!cur) {
      return { error: 'Unexpected WeatherAPI response (no current data).' };
    }

    const temperatureF = Math.round(cur.temp_f);
    const humidity = Number(cur.humidity) || 0;
    const description = cur?.condition?.text || '—';

    // Defensive dewpoint calculation
    let dewpointF = Math.round(cur.dewpoint_f ?? Number.NaN);
    if (Number.isNaN(dewpointF)) {
      const tC = (temperatureF - 32) * (5 / 9);
      const a = 17.27;
      const b = 237.7;
      const gamma = (a * tC) / (b + tC) + Math.log(Math.max(humidity, 1) / 100);
      const dpC = (b * gamma) / (a - gamma);
      dewpointF = Math.round(dpC * (9 / 5) + 32);
    }

    return {
      data: {
        temperature: temperatureF,
        humidity,
        description,
        dewpoint: dewpointF,
      },
    };
  } catch (err: any) {
    console.error('Weather fetch exception', { location, err });
    return { error: err.message || 'Could not retrieve weather data.' };
  }
}
