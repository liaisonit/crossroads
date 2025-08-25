
import { z } from 'genkit';

export const WeatherInputSchema = z.object({
  location: z.string().describe('The city and state, e.g. San Francisco, CA'),
});
export type WeatherInput = z.infer<typeof WeatherInputSchema>;

export const WeatherOutputSchema = z.object({
  temperature: z.number().describe('The temperature in Fahrenheit.'),
  humidity: z.number().describe('The humidity percentage.'),
  dewpoint: z.number().describe('The dewpoint in Fahrenheit.'),
  description: z.string().describe('A brief text description of the current weather conditions (e.g., "Partly cloudy").'),
});
export type WeatherOutput = z.infer<typeof WeatherOutputSchema>;
