
'use server';
/**
 * @fileOverview A weather fetching agent.
 *
 * This file is now a placeholder. The weather fetching logic has been moved 
 * to a secure Cloud Function. See functions/src/lib/weather.ts.
 * The client-side code in timesheet/client-page.tsx now calls this new function.
 */
import { WeatherInputSchema, WeatherOutputSchema, type WeatherInput, type WeatherOutput } from '../schemas/weather';

/**
 * DEPRECATED: This function is no longer in use.
 * The logic has been moved to a callable Cloud Function for security and stability.
 * @param input The location for which to fetch weather data.
 * @returns A promise that resolves to the weather data.
 */
export async function getWeather(input: WeatherInput): Promise<WeatherOutput> {
    console.warn("DEPRECATED: getWeather is no longer in use. Please use the getWeatherFromLocation cloud function.");
    throw new Error("getWeather Genkit flow is deprecated.");
}
