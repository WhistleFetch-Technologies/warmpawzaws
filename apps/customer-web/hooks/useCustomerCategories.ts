'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { getIcon } from '@/lib/icon-utils';

export interface ApiCategory {
  id: string;
  category_id: string;
  name: string;
  description?: string;
  icon?: string;
  icon_color?: string;
  display_order?: number;
}

/** Map category_id from catalog to CustomerHomeWrapper screen type (so navigation works). */
export const categoryIdToScreen: Record<string, string> = {
  veterinary: 'vet',
  grooming: 'grooming',
  training: 'training',
  boarding: 'boarding',
  walking: 'walker',
  diagnostic: 'lab-diagnostics',
  pharmacy: 'pharmacy',
  emergency: 'ambulance',
  wellness: 'nutritionist',
  specialty: 'insurance',
  adoption: 'adoption',
  shop: 'shop',
  marketplace: 'shop',
  nutrition: 'nutritionist',
  resort: 'resort',
  cafe: 'cafes',
  photography: 'photography',
  breeder: 'breeder',
  relocation: 'relocation',
  holiday: 'holiday',
  sunset: 'sunset',
  insurance: 'insurance',
};

export interface QuickServiceTile {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  screen: string;
  categoryId: string;
}

/** Map backend icon_color (e.g. text-blue-500) to Tailwind bg/label class for tiles. */
export function iconColorToBg(colorClass: string | undefined): string {
  if (!colorClass) return 'bg-gray-100 text-gray-600';
  const m: Record<string, string> = {
    'text-blue-500': 'bg-blue-100 text-blue-600', 'text-blue-600': 'bg-blue-100 text-blue-600',
    'text-green-500': 'bg-green-100 text-green-600', 'text-green-600': 'bg-green-100 text-green-600',
    'text-orange-500': 'bg-orange-100 text-orange-600', 'text-orange-600': 'bg-orange-100 text-orange-600',
    'text-red-500': 'bg-red-100 text-red-600', 'text-red-600': 'bg-red-100 text-red-600',
    'text-purple-500': 'bg-purple-100 text-purple-600', 'text-purple-600': 'bg-purple-100 text-purple-600',
    'text-pink-500': 'bg-pink-100 text-pink-600', 'text-pink-600': 'bg-pink-100 text-pink-600',
    'text-amber-500': 'bg-amber-100 text-amber-600', 'text-amber-600': 'bg-amber-100 text-amber-600',
    'text-teal-500': 'bg-teal-100 text-teal-600', 'text-teal-600': 'bg-teal-100 text-teal-600',
    'text-cyan-500': 'bg-cyan-100 text-cyan-600', 'text-cyan-600': 'bg-cyan-100 text-cyan-600',
    'text-indigo-500': 'bg-indigo-100 text-indigo-600', 'text-indigo-600': 'bg-indigo-100 text-indigo-600',
    'text-gray-500': 'bg-gray-100 text-gray-600', 'text-gray-600': 'bg-gray-100 text-gray-600',
  };
  return m[colorClass] || 'bg-gray-100 text-gray-600';
}

export function useCustomerCategories() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [quickServiceTiles, setQuickServiceTiles] = useState<QuickServiceTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get<{ success?: boolean; categories?: ApiCategory[] }>('/service-catalog/categories');
      const list = (res as any)?.categories ?? [];
      setCategories(Array.isArray(list) ? list : []);

      const tiles: QuickServiceTile[] = (Array.isArray(list) ? list : []).map((cat: ApiCategory) => {
        const screen = categoryIdToScreen[cat.category_id] ?? cat.category_id;
        const IconComponent = getIcon(cat.icon);
        return {
          icon: IconComponent,
          label: cat.name || cat.category_id,
          color: iconColorToBg(cat.icon_color),
          screen,
          categoryId: cat.category_id,
        };
      });
      setQuickServiceTiles(tiles);
    } catch (e: any) {
      console.warn('[useCustomerCategories] Failed to load categories:', e?.message);
      setError(e?.message ?? 'Failed to load categories');
      setCategories([]);
      setQuickServiceTiles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    quickServiceTiles,
    loading,
    error,
    refetch: fetchCategories,
  };
}
