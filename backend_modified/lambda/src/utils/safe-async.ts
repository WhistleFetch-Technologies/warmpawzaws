/**
 * ============================================================================
 * SAFE ASYNC UTILITIES
 * ============================================================================
 * 
 * Utilities for handling async operations without silent failures
 * 
 * Date: 2025-01-28
 * Security Enhancement - Replace .catch(() => {}) patterns
 * ============================================================================
 */

/**
 * Safely execute an async operation with proper error logging
 * Use this instead of .catch(() => {})
 */
export async function safeAsync<T>(
  operation: () => Promise<T>,
  context: string,
  options: {
    defaultValue?: T;
    logLevel?: 'error' | 'warn' | 'info';
    rethrow?: boolean;
  } = {}
): Promise<T | undefined> {
  const { defaultValue, logLevel = 'warn', rethrow = false } = options;
  
  try {
    return await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const logFn = logLevel === 'error' ? console.error 
                 : logLevel === 'warn' ? console.warn 
                 : console.log;
    
    logFn(`[SafeAsync] ${context} failed:`, message);
    
    if (rethrow) {
      throw error;
    }
    
    return defaultValue;
  }
}

/**
 * Safely execute a non-critical async operation (fire and forget)
 * Logs errors but doesn't throw
 */
export function fireAndForget(
  operation: () => Promise<unknown>,
  context: string
): void {
  operation().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[FireAndForget] ${context} failed:`, message);
  });
}

/**
 * Wrap a query that can fail gracefully with a fallback
 */
export async function safeQuery<T>(
  queryFn: () => Promise<{ rows: T[] }>,
  context: string,
  fallback: T[] = []
): Promise<T[]> {
  try {
    const result = await queryFn();
    return result.rows;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[SafeQuery] ${context} failed:`, message);
    return fallback;
  }
}

/**
 * Retry an operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelayMs = 100, maxDelayMs = 5000 } = options;
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        console.error(`[WithRetry] ${context} failed after ${maxRetries} attempts:`, lastError.message);
        throw lastError;
      }
      
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      console.warn(`[WithRetry] ${context} attempt ${attempt} failed, retrying in ${delay}ms:`, lastError.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Unknown error');
}
