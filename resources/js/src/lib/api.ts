import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'kopipos.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errors?: Record<string, string[]> }>) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    const message =
      error.response?.data?.message ??
      (error.code === 'ERR_NETWORK' ? 'Tidak dapat terhubung ke server.' : 'Terjadi kesalahan.');
    const wrapped = new Error(message) as Error & {
      status?: number;
      errors?: Record<string, string[]>;
    };
    wrapped.status = error.response?.status;
    wrapped.errors = error.response?.data?.errors;
    return Promise.reject(wrapped);
  },
);

export function fieldErrors(error: unknown): Record<string, string[]> {
  const err = error as { errors?: Record<string, string[]> } | null;
  return err?.errors ?? {};
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan.';
}
