import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { BrandSettings, Category, StoreSettings } from '../types';

export const queryKeys = {
  dashboard: ['dashboard'] as const,
  products: ['products'] as const,
  categories: ['categories'] as const,
  stock: ['stock'] as const,
  sales: ['sales'] as const,
  settings: ['settings'] as const,
  brand: ['settings', 'brand'] as const,
  users: ['users'] as const,
};

export function useBrandSettings() {
  return useQuery({
    queryKey: queryKeys.brand,
    queryFn: async () => (await api.get<{ data: BrandSettings }>('/settings/brand')).data.data,
    staleTime: 5 * 60_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: async () => (await api.get<{ data: StoreSettings }>('/settings')).data.data,
    staleTime: 5 * 60_000,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async () => (await api.get<{ data: Category[] }>('/categories')).data.data,
    staleTime: 5 * 60_000,
  });
}
