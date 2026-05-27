'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

export interface TrendingProblem {
  problemId: string;
  title: string;
  description: string;
  searchCount: number;
  trend: 'up' | 'down' | 'stable';
  /** API field name; value is role_id (e.g. veterinarian, groomer). */
  category?: string;
}

function dedupeTrendingProblems(raw: TrendingProblem[]): TrendingProblem[] {
  const validTrending = raw.filter(
    (item) =>
      item &&
      typeof item === 'object' &&
      item.title &&
      typeof item.title === 'string' &&
      item.title.trim() !== ''
  );

  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  return validTrending.filter((item) => {
    if (item.problemId && typeof item.problemId === 'string') {
      if (seenIds.has(item.problemId)) return false;
      seenIds.add(item.problemId);
      return true;
    }
    const titleKey = (item.title || '').toLowerCase().trim();
    if (seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    return true;
  });
}

/** Ranked trending problems from GET /customer/problems/trending. */
export function useTrendingProblems(limit = 5) {
  const [items, setItems] = useState<TrendingProblem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await apiClient.get<{
          trending?: TrendingProblem[];
          data?: { trending?: TrendingProblem[] };
        }>('/customer/problems/trending');
        if (cancelled) return;
        const rawTrending = data.data?.trending || data.trending || [];
        setItems(dedupeTrendingProblems(rawTrending).slice(0, limit));
      } catch (error) {
        console.error('Error fetching trending problems:', error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { items, loading };
}
