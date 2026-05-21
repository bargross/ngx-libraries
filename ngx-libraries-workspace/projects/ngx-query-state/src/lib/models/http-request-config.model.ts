import { HttpMethod } from "../enums/http-method.enum";

export interface HttpRequestConfig {
  method: HttpMethod;
  url: string;
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  withCredentials?: boolean;
}
