export type D1Primitive = null | string | number | boolean | ArrayBuffer;

export interface D1Result<Row = Record<string, unknown>> {
  success: boolean;
  results?: Row[];
  meta?: Record<string, unknown>;
  error?: string;
}

export interface D1PreparedStatement {
  bind(...values: D1Primitive[]): D1PreparedStatement;
  first<Row = Record<string, unknown>>(columnName?: string): Promise<Row | null>;
  run<Row = Record<string, unknown>>(): Promise<D1Result<Row>>;
  all<Row = Record<string, unknown>>(): Promise<D1Result<Row>>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<Row = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<Array<D1Result<Row>>>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

export interface AppEnvironment {
  DB: D1Database;
  APP_ENV?: string;
  APP_ORIGIN?: string;
  SESSION_TTL_DAYS?: string;
  OWNER_PASSWORD?: string;
  IP_HASH_SECRET?: string;
  MUSIC_API_URL?: string;
  QWEATHER_API_KEY?: string;
  QWEATHER_API_HOST?: string;
  WALLHAVEN_API_KEY?: string;
  GITHUB_REPOSITORY?: string;
  GITHUB_TOKEN?: string;
  DEFAULT_LATITUDE?: string;
  DEFAULT_LONGITUDE?: string;
  DEFAULT_CITY?: string;
}

export interface PagesContext<Environment extends AppEnvironment = AppEnvironment> {
  request: Request;
  env: Environment;
  params?: Record<string, string | string[]>;
  waitUntil?: (promise: Promise<unknown>) => void;
}
