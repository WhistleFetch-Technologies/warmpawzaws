/**
 * ============================================================================
 * SQL-SAFE OPERATIONS - Wrapper around SQL with timeout protection
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Converted from KV-safe to SQL-safe operations
 * 
 * This module prevents database timeout issues by:
 * 1. Adding timeout protection to all SQL operations
 * 2. Providing retry logic with exponential backoff
 * 3. Graceful error handling
 * 4. Logging for debugging
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Converted all KV operations to SQL operations
 * - Uses `platform_settings` table for key-value storage
 * - Provides safe wrappers for SQL queries
 * 
 * Date: 2025-01-28
 * Migration: Batch 17 - KV to SQL (10 KV operations removed)
 * ============================================================================
 */

import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const DEFAULT_TIMEOUT_MS = 8000;
const RETRY_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1000;

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
    console.error(`❌ [SQL-SAFE] ${operationName} failed:`, error);
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
      
      const delay = RETRY_DELAY_MS * Math.pow(2, i);
      console.warn(`⚠️ [SQL-SAFE] ${operationName} failed (attempt ${i + 1}/${attempts + 1}), retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry failed');
}

/**
 * Safe get operation (from platform_settings)
 */
export async function safeGet(
  key: string,
  options: { timeout?: number; retries?: number } = {}
): Promise<any> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = options;
  
  return withRetry(
    () => withTimeout(
      (async () => {
        const { data, error } = await db
          .from('platform_settings')
          .select('setting_value')
          .eq('setting_key', key)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          throw error;
        }
        
        return data?.setting_value || null;
      })(),
      timeout,
      `get(${key})`
    ),
    `get(${key})`,
    retries
  );
}

/**
 * Safe set operation (to platform_settings)
 */
export async function safeSet(
  key: string,
  value: any,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = options;
  
  return withRetry(
    () => withTimeout(
      db
        .from('platform_settings')
        .upsert({
          setting_key: key,
          setting_value: value,
          setting_type: typeof value === 'object' ? 'object' : 'string',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        })
        .then(() => {}),
      timeout,
      `set(${key})`
    ),
    `set(${key})`,
    retries
  );
}

/**
 * Safe delete operation
 */
export async function safeDel(
  key: string,
  options: { timeout?: number; retries?: number } = {}
): Promise<void> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = RETRY_ATTEMPTS } = options;
  
  return withRetry(
    () => withTimeout(
      db
        .from('platform_settings')
        .delete()
        .eq('setting_key', key)
        .then(() => {}),
      timeout,
      `del(${key})`
    ),
    `del(${key})`,
    retries
  );
}

/**
 * Safe getByPrefix operation
 */
export async function safeGetByPrefix(
  prefix: string,
  options: { timeout?: number; retries?: number; limit?: number } = {}
): Promise<any[]> {
  const { timeout = DEFAULT_TIMEOUT_MS, retries = 1, limit } = options;
  
  try {
    const results = await withRetry(
      () => withTimeout(
        (async () => {
          const { data, error } = await db
            .from('platform_settings')
            .select('setting_key, setting_value')
            .like('setting_key', `${prefix}%`)
            .limit(limit || 1000);
          
          if (error) throw error;
          
          return (data || []).map((item: any) => ({
            key: item.setting_key,
            value: item.setting_value
          }));
        })(),
        timeout,
        `getByPrefix(${prefix})`
      ),
      `getByPrefix(${prefix})`,
      retries
    );
    
    if (limit && results.length > limit) {
      console.warn(`⚠️ [SQL-SAFE] getByPrefix(${prefix}) returned ${results.length} results, limiting to ${limit}`);
      return results.slice(0, limit);
    }
    
    return results;
  } catch (error) {
    console.error(`❌ [SQL-SAFE] getByPrefix(${prefix}) failed permanently, returning empty array`);
    return [];
  }
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
    console.warn(`⚠️ [SQL-SAFE] tryGet(${key}) failed, returning default value`);
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
    console.error(`❌ [SQL-SAFE] trySet(${key}) failed:`, error);
    return false;
  }
}

console.log('✅ SQL-Safe operations (SQL-only) loaded');

