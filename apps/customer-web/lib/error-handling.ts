/**
 * Error Handling & Retry Logic for Customer Web App
 * Phase 4: Error Handling Enhancement
 */

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN', 'Failed to fetch'],
};

export class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public isRetryable: boolean = false,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: any, config: RetryConfig): boolean {
  // Network errors
  if (
    error.message?.includes('Failed to fetch') ||
    error.message?.includes('NetworkError') ||
    config.retryableErrors.some(e => error.message?.includes(e))
  ) {
    return true;
  }

  // HTTP status codes
  if (error.statusCode && config.retryableStatusCodes.includes(error.statusCode)) {
    return true;
  }

  return false;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute request with retry logic and exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if error is retryable
      if (!isRetryableError(error, retryConfig) || attempt === retryConfig.maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        retryConfig.baseDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt),
        retryConfig.maxDelayMs
      );
      
      // Add jitter (±25%)
      const jitter = delay * 0.25 * (Math.random() * 2 - 1);
      const totalDelay = delay + jitter;

      console.log(`[RETRY] Attempt ${attempt + 1}/${retryConfig.maxRetries} failed, retrying in ${Math.round(totalDelay)}ms...`);
      await sleep(totalDelay);
    }
  }

  throw lastError || new ApiError('All retry attempts failed', 'RETRY_EXHAUSTED', undefined, false);
}

/**
 * Enhanced fetch with timeout and retry
 */
export async function resilientFetch(
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {}
): Promise<Response> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

  return withRetry(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if response is retryable
      if (!response.ok) {
        const isRetryable = retryConfig.retryableStatusCodes.includes(response.status);
        const error = new ApiError(
          `HTTP ${response.status}`,
          response.status >= 500 ? 'server_error' : 'client_error',
          response.status,
          isRetryable
        );
        throw error;
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      // Handle abort (timeout)
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout', 'timeout', undefined, true, error);
      }

      // Re-throw if already ApiError
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle network errors
      if (
        error.message?.includes('Failed to fetch') ||
        error.message?.includes('NetworkError') ||
        retryConfig.retryableErrors.some(e => error.message?.includes(e))
      ) {
        throw new ApiError(
          error.message || 'Network error',
          'network_error',
          undefined,
          true,
          error
        );
      }

      throw error;
    }
  }, retryConfig);
}

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
    return navigator.onLine;
  }
  return true; // Assume online if can't determine
}

/**
 * Queue request for offline retry
 */
export class OfflineQueue {
  private queue: Array<{
    id: string;
    url: string;
    method: string;
    body?: string;
    headers?: Record<string, string>;
    timestamp: number;
  }> = [];

  constructor() {
    // Load queue from localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('offline_queue');
        if (stored) {
          this.queue = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Failed to load offline queue:', e);
      }
    }
  }

  addRequest(request: {
    url: string;
    method: string;
    body?: string;
    headers?: Record<string, string>;
  }): void {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.queue.push({
      id,
      ...request,
      timestamp: Date.now(),
    });
    this.saveQueue();
  }

  getPendingRequests() {
    return this.queue;
  }

  removeRequest(id: string): void {
    this.queue = this.queue.filter(req => req.id !== id);
    this.saveQueue();
  }

  clearQueue(): void {
    this.queue = [];
    this.saveQueue();
  }

  private saveQueue(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('offline_queue', JSON.stringify(this.queue));
      } catch (e) {
        console.warn('Failed to save offline queue:', e);
      }
    }
  }

  async sync(): Promise<{ synced: number; failed: number }> {
    const result = { synced: 0, failed: 0 };

    if (!isOnline()) {
      return result;
    }

    const requests = [...this.queue];
    
    for (const request of requests) {
      try {
        const response = await resilientFetch(request.url, {
          method: request.method as any,
          headers: request.headers,
          body: request.body,
        });

        if (response.ok) {
          this.removeRequest(request.id);
          result.synced++;
        } else {
          result.failed++;
        }
      } catch (error) {
        console.warn(`[OfflineQueue] Failed to sync request ${request.id}:`, error);
        result.failed++;
      }
    }

    return result;
  }
}

