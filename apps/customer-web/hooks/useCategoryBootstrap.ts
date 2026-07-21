'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export type CategoryBootstrapProblem = {
  id: string;
  title: string;
  roleId?: string;
};

export type CategoryBootstrapStyle = {
  style: string;
  label: string;
};

export type CategoryBootstrapData = {
  category: string | null;
  roleId: string | null;
  styles: CategoryBootstrapStyle[];
  problems: CategoryBootstrapProblem[];
  banner: unknown | null;
};

type UseCategoryBootstrapOptions = {
  category?: string;
  roleId?: string;
  enabled?: boolean;
};

/**
 * Category landing chrome (styles, problems) — no vendor discovery SQL.
 * Progressive loading step 1 before vendor feed.
 */
export function useCategoryBootstrap({
  category,
  roleId,
  enabled = true,
}: UseCategoryBootstrapOptions) {
  const [data, setData] = useState<CategoryBootstrapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || (!category && !roleId)) {
      setData(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (roleId) params.set('roleId', roleId);
        const res = await apiClient.get<{
          success?: boolean;
          category?: string | null;
          roleId?: string | null;
          styles?: CategoryBootstrapStyle[];
          problems?: CategoryBootstrapProblem[];
          banner?: unknown | null;
          error?: string;
        }>(`/customer/discovery/category-bootstrap?${params.toString()}`);
        if (cancelled) return;
        if (res?.success === false) {
          setError(res.error || 'Failed to load category bootstrap');
          setData(null);
          return;
        }
        setData({
          category: res.category ?? category ?? null,
          roleId: res.roleId ?? roleId ?? null,
          styles: Array.isArray(res.styles) ? res.styles : [],
          problems: Array.isArray(res.problems) ? res.problems : [],
          banner: res.banner ?? null,
        });
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load category bootstrap');
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [category, roleId, enabled]);

  return {
    data,
    styles: data?.styles ?? [],
    problems: data?.problems ?? [],
    banner: data?.banner ?? null,
    loading,
    error,
  };
}
