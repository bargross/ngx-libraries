export interface HttpRequestConfig {
  method: string;
  url: string;
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}
