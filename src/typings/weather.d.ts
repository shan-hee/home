export interface WeatherApiResponse {
  city: string;
  latitude: number;
  longitude: number;
  weather: string;
  temperature: number;
  winddirection: string;
  windpower: string;
  source: "open-meteo" | "met-norway";
  updatedAt: string;
}

export interface WeatherAlert {
  id: string;
  title: string;
  type: string;
  level: string;
  text: string;
  startAt: string | null;
  endAt: string | null;
}

export interface WeatherAlertsResponse {
  alerts: WeatherAlert[];
  configured: boolean;
}
