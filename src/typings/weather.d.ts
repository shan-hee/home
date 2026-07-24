export interface WeatherApiResponse {
  city: string;
  weather: string;
  temperature: number;
  winddirection: string;
  windpower: string;
  source: "open-meteo" | "met-norway";
  updatedAt: string;
}

export interface WeatherLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface GeocodingResult extends WeatherLocation {
  id: string;
  admin1: string;
  country: string;
}

export interface GeocodingApiResponse {
  results: GeocodingResult[];
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
