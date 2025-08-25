
"use client";

import { Loader2, AlertTriangle } from "lucide-react";
import type { WeatherOutput } from "@/ai/flows/weather";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Thermometer, Droplets, Wind } from "lucide-react";

type WeatherDisplayProps = {
    weather: WeatherOutput | null;
    isLoading: boolean;
    jobSelected: boolean;
}

export default function WeatherDisplay({ weather, isLoading, jobSelected }: WeatherDisplayProps) {

  if (!jobSelected) {
    return (
        <div className="p-3 rounded-md bg-secondary/50 text-center text-sm text-muted-foreground">
            Select a job to see weather details.
        </div>
    )
  }
  
  if (isLoading) {
    return (
        <div className="p-3 rounded-md bg-secondary/50 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Fetching weather...
        </div>
    )
  }

  if (!weather) {
     return (
        <div className="p-3 rounded-md bg-destructive/10 text-center text-sm text-destructive flex items-center justify-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Could not retrieve weather data.
        </div>
    )
  }

  return (
    <div className="space-y-2 text-sm p-3 rounded-md bg-secondary/50 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
            <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-primary"/>
                <span>{weather.temperature}°F</span>
            </div>
            <div className="flex items-center gap-2">
                <Droplets className="h-4 w-4 text-primary"/>
                <span>{weather.humidity}% Humidity</span>
            </div>
             <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-primary"/>
                <span>{weather.dewpoint}°F Dewpoint</span>
            </div>
        </div>
         <p className="text-xs text-muted-foreground/80 pt-1">{weather.description}</p>
    </div>
  );
}
