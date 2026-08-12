import type { HttpMethod, HttpRequestConfig } from '../types';
import { httpClient, ApiError } from './httpClient';

export { ApiError };

export interface ApiClientRequest<TRequest = unknown> {
  url: string;
  method?: HttpMethod;
  data?: TRequest;
  params?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  retryCount?: number;
  idempotencyKey?: string;
  skipAuth?: boolean;
}

/**
 * Contract-driven facade over the single HTTP transport.
 * Domain APIs should use this facade instead of implementing fetch logic.
 */
export class ApiClient<TRequest = unknown, TResponse = unknown> {
  request(config: ApiClientRequest<TRequest>): Promise<TResponse> {
    return httpClient.request<TResponse>(config as HttpRequestConfig);
  }

  get<T = TResponse>(url: string, config?: Omit<ApiClientRequest<never>, 'url' | 'method' | 'data'>): Promise<T> {
    return httpClient.get<T>(url, config as Omit<HttpRequestConfig, 'url' | 'method'>);
  }

  post<T = TResponse>(url: string, data: TRequest, config?: Omit<ApiClientRequest<TRequest>, 'url' | 'method' | 'data'>): Promise<T> {
    return httpClient.post<T>(url, data, config as Omit<HttpRequestConfig, 'url' | 'method' | 'data'>);
  }

  put<T = TResponse>(url: string, data: TRequest, config?: Omit<ApiClientRequest<TRequest>, 'url' | 'method' | 'data'>): Promise<T> {
    return httpClient.put<T>(url, data, config as Omit<HttpRequestConfig, 'url' | 'method' | 'data'>);
  }

  patch<T = TResponse>(url: string, data: TRequest, config?: Omit<ApiClientRequest<TRequest>, 'url' | 'method' | 'data'>): Promise<T> {
    return httpClient.patch<T>(url, data, config as Omit<HttpRequestConfig, 'url' | 'method' | 'data'>);
  }

  delete<T = TResponse>(url: string, config?: Omit<ApiClientRequest<never>, 'url' | 'method' | 'data'>): Promise<T> {
    return httpClient.delete<T>(url, config as Omit<HttpRequestConfig, 'url' | 'method'>);
  }
}

export const apiClient = new ApiClient();
