import { BACKEND_URL } from '../api/backend';
import { getToken, clearToken } from './tokenStorage';

interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
}

interface ApiError {
  status: number;
  message: string;
}

export async function authFetch<T = any>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BACKEND_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearToken();
    throw {
      status: 401,
      message: 'Session expired. Please log in again.',
    } as ApiError;
  }

  if (!response.ok) {
    let message: string;
    try {
      const errorBody = (await response.json()) as Record<string, unknown>;
      message =
        (typeof errorBody.detail === 'string' && errorBody.detail) ||
        (typeof errorBody.message === 'string' && errorBody.message) ||
        response.statusText;
    } catch {
      message = await response.text();
    }
    throw {
      status: response.status,
      message,
    } as ApiError;
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return (await response.json()) as T;
}

export const api = {
  get: <T = any>(endpoint: string, headers?: Record<string, string>) =>
    authFetch<T>(endpoint, { method: 'GET', headers }),

  post: <T = any>(
    endpoint: string,
    body?: any,
    headers?: Record<string, string>,
  ) =>
    authFetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  put: <T = any>(
    endpoint: string,
    body?: any,
    headers?: Record<string, string>,
  ) =>
    authFetch<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  delete: <T = any>(endpoint: string, headers?: Record<string, string>) =>
    authFetch<T>(endpoint, { method: 'DELETE', headers }),
};
