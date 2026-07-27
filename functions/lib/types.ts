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

export interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  httpMetadata?: {
    contentType?: string;
    cacheControl?: string;
  };
}

export interface R2PutResult {
  etag: string;
  httpEtag: string;
}

export interface R2Bucket {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream | Blob,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<R2PutResult>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}

export interface AppEnvironment {
  DB: D1Database;
  WALLPAPER_BUCKET: R2Bucket;
  APP_ENV?: string;
  APP_ORIGIN?: string;
  SESSION_TTL_DAYS?: string;
  OWNER_PASSWORD?: string;
  IP_HASH_SECRET?: string;
  WALLHAVEN_API_KEY?: string;
  QWEATHER_API_KEY?: string;
  QWEATHER_API_HOST?: string;
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
