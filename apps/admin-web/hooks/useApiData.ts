/**
 * Reusable hook for API data fetching with loading and error states
 * Eliminates code duplication across admin pages
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

interface UseApiDataOptions<T> {
  endpoint: string;
  params?: Record<string, string | number | boolean>;
  dataKey?: string; // Key to extract from response (e.g., 'banners', 'regions')
  enabled?: boolean; // Whether to fetch on mount
  onSuccess?: (data: T[]) => void;
  onError?: (error: Error) => void;
}

interface UseApiDataReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
}

export function useApiData<T = any>({
  endpoint,
  params,
  dataKey,
  enabled = true,
  onSuccess,
  onError,
}: UseApiDataOptions<T>): UseApiDataReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, String(value));
          }
        });
      }

      const url = queryParams.toString()
        ? `${endpoint}?${queryParams.toString()}`
        : endpoint;

      const response = await apiClient.get<any>(url);

      // Extract data from response (handle various response formats)
      let extractedData: T[] = [];
      if (dataKey && response[dataKey]) {
        extractedData = response[dataKey];
      } else if (Array.isArray(response)) {
        extractedData = response;
      } else if (response.data && Array.isArray(response.data)) {
        extractedData = response.data;
      } else {
        extractedData = [];
      }

      setData(extractedData);
      onSuccess?.(extractedData);
    } catch (err: any) {
      const errorMessage = err.message || `Failed to load data from ${endpoint}`;
      setError(errorMessage);
      onError?.(err);
      console.error(`Error loading data from ${endpoint}:`, err);
    } finally {
      setLoading(false);
    }
  }, [endpoint, params, dataKey, onSuccess, onError]);

  useEffect(() => {
    if (enabled) {
      fetchData();
    }
  }, [enabled, fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData,
  };
}

