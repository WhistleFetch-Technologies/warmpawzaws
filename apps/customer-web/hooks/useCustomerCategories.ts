'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { mapCatalogCategoryIdToCustomerHomeScreen } from '@warmpawz/service-launch-mappings';

/** When `service_categories.name` is empty, show a readable label from `category_id` (e.g. training → Training). */
function displayNameFromCategoryId(categoryId: string): string {
  const raw = String(categoryId || '')
    .trim()
    .replace(/_/g, '-');
  if (!raw) return 'Training';
  return raw
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
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

/** Categories to hide from service tiles (e.g., Physiotherapy should be under vet, not separate tile) */
export const HIDDEN_CATEGORIES: string[] = [
  'physiotherapy',
  'physio',
  'physical_therapy',
];

export interface QuickServiceTile {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  screen: string;
  categoryId: string;
  displayOrder?: number;
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

export function useCustomerCategories(phone?: string | null) {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [quickServiceTiles, setQuickServiceTiles] = useState<QuickServiceTile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (phone) params.set('phone', phone);
      if (typeof window !== 'undefined') {
        try {
          const la = localStorage.getItem('customer_latitude');
          const ln = localStorage.getItem('customer_longitude');
          if (la && ln) {
            params.set('latitude', la);
            params.set('longitude', ln);
          }
        } catch {
          /* ignore */
        }
      }
      const qs = params.toString();
      const url = qs ? `/service-catalog/categories?${qs}` : '/service-catalog/categories';
      const res = await apiClient.get<{ success?: boolean; categories?: ApiCategory[] }>(url);
      const list = (res as any)?.categories ?? [];
      setCategories(Array.isArray(list) ? list : []);

      // ✅ FIX: Filter out hidden categories and deduplicate by screen
      const filteredList = (Array.isArray(list) ? list : []).filter((cat: ApiCategory) => {
        const categoryIdLower = (cat.category_id || '').toLowerCase();
        return !HIDDEN_CATEGORIES.some(hidden => categoryIdLower.includes(hidden.toLowerCase()));
      });

      // Deduplicate by screen (canonical mapping from @warmpawz/service-launch-mappings)
      const seenScreens = new Set<string>();
      const tiles: QuickServiceTile[] = [];
      
      for (const cat of filteredList) {
        const screen =
          mapCatalogCategoryIdToCustomerHomeScreen(cat.category_id) || String(cat.category_id || '').trim();
        
        // Skip if we've already seen this screen (deduplication)
        if (seenScreens.has(screen)) {
          continue;
        }
        
        seenScreens.add(screen);
        const IconComponent = getIcon(cat.icon);
        // Prefer admin-configured `name` (Training, Trainer, etc.); else screen override; else title-case category_id.
        const label = cat.name?.trim() || displayNameFromCategoryId(cat.category_id);
        
        tiles.push({
          icon: IconComponent,
          label,
          color: iconColorToBg(cat.icon_color),
          screen,
          categoryId: cat.category_id,
          displayOrder: cat.display_order != null ? Number(cat.display_order) : undefined,
        });
      }
      
      setQuickServiceTiles(tiles);
    } catch (e: any) {
      console.warn('[useCustomerCategories] Failed to load categories:', e?.message);
      setError(e?.message ?? 'Failed to load categories');
      setCategories([]);
      setQuickServiceTiles([]);
    } finally {
      setLoading(false);
    }
  }, [phone]);

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
