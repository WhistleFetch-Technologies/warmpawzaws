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
  const retryCountRef = useRef(0);
  const lastErrorRef = useRef<Error | null>(null);

  // Use refs to track if we've already fetched to prevent infinite loops
  const hasFetchedRef = useRef(false);
  const isFetchingRef = useRef(false);
  const shouldAutoRetryRef = useRef(false);

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
  
  // Store callbacks in refs to prevent dependency issues
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  
  useEffect(() => {
    onSuccessRef.current = onSuccess;
    onErrorRef.current = onError;
  }, [onSuccess, onError]);
  
  // Update fetchData to use refs
  const fetchDataStable = useCallback(async (isManualRetry = false) => {
    // Don't fetch if we're currently rate limited or already fetching (unless manual retry)
    if (!isManualRetry && (isRateLimitedRef.current || isFetchingRef.current)) {
      return;
    }

    // If rate limited and not a manual retry, don't proceed
    if (!isManualRetry && isRateLimitedRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      setLoading(true);
      setError(null);
      lastErrorRef.current = null;

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
      onSuccessRef.current?.(extractedData);
      isRateLimitedRef.current = false; // Reset rate limit flag on success
      retryCountRef.current = 0; // Reset retry count on success
      hasFetchedRef.current = true;
      shouldAutoRetryRef.current = false;
    } catch (err: any) {
      lastErrorRef.current = err;
      
      // Handle rate limiting errors specially - NO automatic retry
      if (err instanceof RateLimitError) {
        isRateLimitedRef.current = true;
        const retryAfter = err.retryAfter || 5000;
        const waitSeconds = Math.ceil(retryAfter / 1000);
        
        const errorMessage = `Rate limit exceeded. Please wait ${waitSeconds} second(s) before retrying.`;
        setError(errorMessage);
        onErrorRef.current?.(err);
        console.warn(`Rate limited for ${endpoint}. Waiting ${waitSeconds}s before allowing retry.`);
        
        // Clear any existing timeout
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current);
        }
        
        // Clear rate limit flag after wait period, but DON'T auto-retry
        retryTimeoutRef.current = setTimeout(() => {
          isRateLimitedRef.current = false;
          retryCountRef.current = 0;
          // Don't automatically retry - user must manually retry or component must re-mount
        }, retryAfter);
        
        setLoading(false);
        isFetchingRef.current = false;
        return; // Exit early - no automatic retry
      }
      
      // Handle 503 Service Unavailable with exponential backoff (max 3 retries)
      if (err.message?.includes('Service Unavailable') || err.message?.includes('503')) {
        retryCountRef.current += 1;
        
        if (retryCountRef.current <= 3 && shouldAutoRetryRef.current) {
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCountRef.current - 1), 10000); // 1s, 2s, 4s, max 10s
          console.warn(`Service unavailable for ${endpoint}. Retrying in ${backoffDelay}ms (attempt ${retryCountRef.current}/3)...`);
          
          if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
          }
          
          retryTimeoutRef.current = setTimeout(() => {
            fetchDataStable(true); // Manual retry flag
          }, backoffDelay);
          
          setLoading(true); // Keep loading during retry
          return;
        } else {
          // Max retries reached or auto-retry disabled
          const errorMessage = 'Service temporarily unavailable. Please try again later.';
          setError(errorMessage);
          onErrorRef.current?.(err);
          console.error(`❌ Service unavailable for ${endpoint} after ${retryCountRef.current} attempts`);
          setData([]);
          setLoading(false);
          isFetchingRef.current = false;
          return;
        }
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
      onErrorRef.current?.(err);
      console.error(`❌ Error loading data from ${endpoint}:`, err);
      console.error(`   Error message: ${errorMessage}`);
      // Set empty data on error to prevent infinite loading
      setData([]);
      retryCountRef.current = 0; // Reset retry count for non-retryable errors
    } finally {
      // Only set loading to false if we're not in a retry state
      if (!shouldAutoRetryRef.current || retryCountRef.current > 3) {
        setLoading(false);
      }
      isFetchingRef.current = false;
    }
  }, [endpoint, paramsString, dataKey]); // Stable dependencies only
  
  // Only fetch once on mount or when endpoint/params change
  useEffect(() => {
    if (enabled && !isRateLimitedRef.current && !isFetchingRef.current && !hasFetchedRef.current) {
      // Reset state for new fetch
      hasFetchedRef.current = false;
      retryCountRef.current = 0;
      shouldAutoRetryRef.current = true; // Allow auto-retry for initial fetch
      fetchDataStable(false);
    }
  }, [enabled, endpoint, paramsString]); // Removed fetchDataStable from deps to prevent loops

  // Manual refetch function that resets rate limit state
  const refetch = useCallback(async () => {
    // Clear rate limit state for manual retry
    isRateLimitedRef.current = false;
    retryCountRef.current = 0;
    shouldAutoRetryRef.current = true;
    hasFetchedRef.current = false;
    
    // Clear any pending timeouts
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    await fetchDataStable(true);
  }, [fetchDataStable]);

  return {
    data,
    loading,
    error,
    refetch,
    setData,
  };
}

