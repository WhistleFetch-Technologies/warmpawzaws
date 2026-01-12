/**
 * Reusable hook for API data fetching with loading and error states
 * Eliminates code duplication across admin pages
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient, RateLimitError } from '@/lib/api-client';

export interface UseApiDataOptions<T> {
  endpoint: string;
  params?: Record<string, string | number | boolean>;
  dataKey?: string; // Key to extract from response (e.g., 'banners', 'regions')
  enabled?: boolean; // Whether to fetch on mount
  onSuccess?: (data: T[]) => void;
  onError?: (error: Error) => void;
}

export interface UseApiDataReturn<T> {
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
  const isRateLimitedRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    // Don't fetch if we're currently rate limited
    if (isRateLimitedRef.current) {
      return;
    }

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
      isRateLimitedRef.current = false; // Reset rate limit flag on success
    } catch (err: any) {
      // Handle rate limiting errors specially
      if (err instanceof RateLimitError) {
        isRateLimitedRef.current = true;
        const retryAfter = err.retryAfter || 5000;
        const waitSeconds = Math.ceil(retryAfter / 1000);
        
        const errorMessage = `Rate limit exceeded. Please wait ${waitSeconds} second(s) before retrying.`;
        setError(errorMessage);
        onError?.(err);
        console.warn(`Rate limited for ${endpoint}. Waiting ${waitSeconds}s before allowing retry.`);
        
        // Clear any existing timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        // Allow retry after the wait period
        retryTimeoutRef.current = setTimeout(() => {
          isRateLimitedRef.current = false;
          setError(null);
        }, retryAfter);
        
        return; // Don't set loading to false immediately - keep it in a "waiting" state
      }
      
      // Handle other errors normally
      let errorMessage = err.message || `Failed to load data from ${endpoint}`;
      
      // Provide more helpful error messages
      if (errorMessage.includes('Endpoint not found') || errorMessage.includes('404')) {
        errorMessage = `API endpoint not found: ${endpoint}. Please check if the route is configured in API Gateway.`;
      } else if (errorMessage.includes('API_BASE_URL')) {
        errorMessage = 'API configuration error. Please check runtime-config.js or environment variables.';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = `Network error: Unable to reach API server. Please check your connection and ensure the API Gateway is accessible.`;
      }
      
      setError(errorMessage);
      onError?.(err);
      console.error(`❌ Error loading data from ${endpoint}:`, err);
      console.error(`   Error message: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [endpoint, params, dataKey, onSuccess, onError]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Memoize params to prevent unnecessary re-renders
  const paramsString = params ? JSON.stringify(params) : '';
  
  useEffect(() => {
    if (enabled && !isRateLimitedRef.current) {
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

