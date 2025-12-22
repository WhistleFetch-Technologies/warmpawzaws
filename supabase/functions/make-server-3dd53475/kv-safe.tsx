/**
 * KV Safe Operations - Wrapper around kv_store with timeout protection
 * 
 * This module prevents database timeout issues by:
 * 1. Adding timeout protection to all KV operations
 * 2. Providing retry logic with exponential backoff
 * 3. Graceful error handling
 * 4. Logging for debugging
 */

import * as kv from "./kv_store.tsx";

const DEFAULT_TIMEOUT_MS = 8000; // 8 seconds timeout
const RETRY_ATTEMPTS = 2; // Retry failed operations twice
const RETRY_DELAY_MS = 1000; // Initial retry delay

/**
 * Execute a function with timeout protection
 */
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  operationName: string = 'operation'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => 
    setTimeout(() => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)), timeoutMs)
  );

  try {
    return await Promise.race([operation, timeoutPromise]);
  } catch (error) {
    console.error(`❌ [KV-SAFE] ${operationName} failed:`, error);
    throw error;
  }
}

/**
 * Execute with retry logic
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  attempts: number = RETRY_ATTEMPTS
): Promise<T> {
  for (let i = 0; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isLastAttempt = i === attempts;
      const isTimeout = error.message?.includes('timeout');
      
      if (isLastAttempt || !isTimeout) {
        throw error;
      }
      
      // Wait before retry with exponential backoff
      const delay = RETRY_DELAY_MS * Math.pow(2, i);
      console.warn(`⚠️ [KV-SAFE] ${operationName} failed (attempt ${i + 1}/${attempts + 1}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry failed');
}

/**
 * Safe get operation with timeout protection
 */
export async function safeGet(
  key: string,
  options: { timeout?: number; retries?: number } = {}
): Promise<any> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = options;
  
  return withRetry(
    () => withTimeout(
      kv.get(key),
      timeout,
      `get(${key})`
    ),
    `get(${key})`,
    retries
  );
}

/**
 * Safe set operation with timeout protection
 */
export async function safeSet(
  key: string,
  value: any,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = options;
  
  return withRetry(
    () => withTimeout(
      kv.set(key, value),
      timeout,
      `set(${key})`
    ),
    `set(${key})`,
    retries
  );
}

/**
 * Safe delete operation with timeout protection
 */
export async function safeDel(
  key: string,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = options;
  
  return withRetry(
    () => withTimeout(
      kv.del(key),
      timeout,
      `del(${key})`
    ),
    `del(${key})`,
    retries
  );
}

/**
 * Safe getByPrefix with timeout protection and limit
 */
export async function safeGetByPrefix(
  prefix: string,
  options: { timeout?: number; retries?: number; limit?: number } = {}
): Promise<any[]> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = 1, limit } = options; // Only 1 retry for expensive queries
  
  try {
    const results = await withRetry(
      () => withTimeout(
        kv.getByPrefix(prefix),
        timeout,
        `getByPrefix(${prefix})`
      ),
      `getByPrefix(${prefix})`,
      retries
    );
    
    // Apply limit if specified
    if (limit && results.length > limit) {
      console.warn(`⚠️ [KV-SAFE] getByPrefix(${prefix}) returned ${results.length} results, limiting to ${limit}`);
      return results.slice(0, limit);
    }
    
    return results;
  } catch (error) {
    console.error(`❌ [KV-SAFE] getByPrefix(${prefix}) failed permanently, returning empty array`);
    return []; // Return empty array on failure to prevent crashes
  }
}

/**
 * Safe mget operation with timeout protection
 */
export async function safeMget(
  keys: string[],
  options: { timeout?: number; retries?: number } = {}
): Promise<any[]> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = options;
  
  // Split large batches to prevent timeouts
  const BATCH_SIZE = 100;
  if (keys.length > BATCH_SIZE) {
    console.warn(`⚠️ [KV-SAFE] mget with ${keys.length} keys, splitting into batches of ${BATCH_SIZE}`);
    
    const results: any[] = [];
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      const batchResults = await withRetry(
        () => withTimeout(
          kv.mget(batch),
          timeout,
          `mget(batch ${i / BATCH_SIZE + 1})`
        ),
        `mget(batch ${i / BATCH_SIZE + 1})`,
        retries
      );
      results.push(...batchResults);
    }
    return results;
  }
  
  return withRetry(
    () => withTimeout(
      kv.mget(keys),
      timeout,
      `mget(${keys.length} keys)`
    ),
    `mget(${keys.length} keys)`,
    retries
  );
}

/**
 * Safe mset operation with timeout protection
 */
export async function safeMset(
  keys: string[],
  values: any[],
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = options;
  
  // Split large batches to prevent timeouts
  const BATCH_SIZE = 50;
  if (keys.length > BATCH_SIZE) {
    console.warn(`⚠️ [KV-SAFE] mset with ${keys.length} items, splitting into batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batchKeys = keys.slice(i, i + BATCH_SIZE);
      const batchValues = values.slice(i, i + BATCH_SIZE);
      await withRetry(
        () => withTimeout(
          kv.mset(batchKeys, batchValues),
          timeout,
          `mset(batch ${i / BATCH_SIZE + 1})`
        ),
        `mset(batch ${i / BATCH_SIZE + 1})`,
        retries
      );
    }
    return;
  }
  
  return withRetry(
    () => withTimeout(
      kv.mset(keys, values),
      timeout,
      `mset(${keys.length} items)`
    ),
    `mset(${keys.length} items)`,
    retries
  );
}

/**
 * Safe mdel operation with timeout protection
 */
export async function safeMdel(
  keys: string[],
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = options;
  
  // Split large batches
  const BATCH_SIZE = 100;
  if (keys.length > BATCH_SIZE) {
    console.warn(`⚠️ [KV-SAFE] mdel with ${keys.length} keys, splitting into batches of ${BATCH_SIZE}`);
    
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batch = keys.slice(i, i + BATCH_SIZE);
      await withRetry(
        () => withTimeout(
          kv.mdel(batch),
          timeout,
          `mdel(batch ${i / BATCH_SIZE + 1})`
        ),
        `mdel(batch ${i / BATCH_SIZE + 1})`,
        retries
      );
    }
    return;
  }
  
  return withRetry(
    () => withTimeout(
      kv.mdel(keys),
      timeout,
      `mdel(${keys.length} keys)`
    ),
    `mdel(${keys.length} keys)`,
    retries
  );
}

/**
 * Try to get a value, return default on failure
 */
export async function tryGet<T = any>(
  key: string,
  defaultValue: T,
  options: { timeout?: number } = {}
): Promise<T> {
  try {
    const value = await safeGet(key, options);
    return value !== undefined && value !== null ? value : defaultValue;
  } catch (error) {
    console.warn(`⚠️ [KV-SAFE] tryGet(${key}) failed, returning default value`);
    return defaultValue;
  }
}

/**
 * Try to set a value, log on failure but don't crash
 */
export async function trySet(
  key: string,
  value: any,
  options: { timeout?: number } = {}
): Promise<boolean> {
  try {
    await safeSet(key, value, options);
    return true;
  } catch (error) {
    console.error(`❌ [KV-SAFE] trySet(${key}) failed:`, error);
    return false;
  }
}
