'use client';

import { useEffect, useState } from 'react';
import {
  fetchCatalogServiceCategories,
  type CatalogServiceCategory,
} from './catalog-categories';

export function useCatalogServiceCategories() {
  const [categories, setCategories] = useState<CatalogServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCatalogServiceCategories()
      .then((rows) => {
        if (cancelled) return;
        setCategories(rows);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setCategories([]);
        setError(err instanceof Error ? err.message : 'Failed to load catalogue categories');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { categories, loading, error };
}
