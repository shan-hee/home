export interface WeatherApiResponse {
  city: string;
  weather: string;
  temperature: number;
  winddirection: string;
  windpower: string;
  source: "open-meteo" | "met-norway";
  updatedAt: string;
}
