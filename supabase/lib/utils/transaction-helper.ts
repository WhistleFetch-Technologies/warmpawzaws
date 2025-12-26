/**
 * ============================================================================
 * TRANSACTION HELPER - ENHANCED
 * ============================================================================
 * 
 * Provides transactional safety for multi-step operations
 * 
 * IMPORTANT LIMITATIONS:
 * - Supabase JS client doesn't support explicit BEGIN/COMMIT/ROLLBACK
 * - Each Supabase client operation is atomic per request
 * - For true multi-step transactions, use RPC functions (see withRPCTransaction)
 * 
 * This helper provides:
 * - Better error handling and rollback simulation
 * - Operation ordering guarantees
 * - Error propagation with context
 * 
 * Date: 2025-01-27
 * Enhanced: 2025-01-27 (Task 1.26)
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * Transaction context for tracking operations
 */
interface TransactionContext {
  operations: Array<{ type: string; table?: string; description: string }>;
  startTime: number;
}

/**
 * Execute operations with transactional safety
 * 
 * NOTE: This provides application-level transaction safety.
 * For true database transactions, use `withRPCTransaction` with database functions.
 * 
 * @param callback Function to execute with transaction context
 * @returns Result of callback function
 * 
 * @example
 * await withTransaction(async (client) => {
 *   await client.from('bookings').insert({...});
 *   await client.from('payments').insert({...});
 * });
 */
export async function withTransaction<T>(
  callback: (client: SupabaseClient) => Promise<T>
): Promise<T> {
  const client = getDbClient();
  const context: TransactionContext = {
    operations: [],
    startTime: Date.now(),
  };
  
  try {
    console.log('🔄 [TRANSACTION] Starting transaction...');
    const result = await callback(client);
    const duration = Date.now() - context.startTime;
    console.log(`✅ [TRANSACTION] Completed successfully in ${duration}ms (${context.operations.length} operations)`);
    return result;
  } catch (error) {
    const duration = Date.now() - context.startTime;
    console.error(`❌ [TRANSACTION] Failed after ${duration}ms (${context.operations.length} operations)`);
    console.error(`❌ [TRANSACTION] Operations attempted:`, context.operations);
    console.error(`❌ [TRANSACTION] Error:`, error);
    
    // In a real transaction, this would trigger ROLLBACK
    // For now, we just propagate the error
    throw new TransactionError(
      `Transaction failed: ${error instanceof Error ? error.message : String(error)}`,
      context.operations,
      error
    );
  }
}

/**
 * Execute operations using a database RPC function for true transactions
 * 
 * This is the recommended approach for critical operations that require
 * true atomicity (e.g., payment + booking update).
 * 
 * The RPC function must be created in the database and handle BEGIN/COMMIT/ROLLBACK.
 * 
 * @param functionName Name of the RPC function
 * @param params Parameters to pass to the RPC function
 * @returns Result from RPC function
 * 
 * @example
 * // Database function: create_payment_with_booking(payment_data, booking_data)
 * await withRPCTransaction('create_payment_with_booking', {
 *   payment_data: {...},
 *   booking_data: {...}
 * });
 */
export async function withRPCTransaction<T = any>(
  functionName: string,
  params: Record<string, any> = {}
): Promise<T> {
  const client = getDbClient();
  
  try {
    console.log(`🔄 [RPC-TRANSACTION] Calling ${functionName}...`);
    const { data, error } = await client.rpc(functionName, params);
    
    if (error) {
      console.error(`❌ [RPC-TRANSACTION] ${functionName} failed:`, error);
      throw new TransactionError(
        `RPC transaction failed: ${error.message}`,
        [{ type: 'rpc', description: `${functionName}(${JSON.stringify(params)})` }],
        error
      );
    }
    
    console.log(`✅ [RPC-TRANSACTION] ${functionName} completed successfully`);
    return data as T;
  } catch (error) {
    if (error instanceof TransactionError) {
      throw error;
    }
    throw new TransactionError(
      `RPC transaction error: ${error instanceof Error ? error.message : String(error)}`,
      [{ type: 'rpc', description: functionName }],
      error
    );
  }
}

/**
 * Transaction error with context
 */
export class TransactionError extends Error {
  constructor(
    message: string,
    public operations: Array<{ type: string; table?: string; description: string }>,
    public originalError?: any
  ) {
    super(message);
    this.name = "TransactionError";
  }
  
  /**
   * Get a human-readable error message with context
   */
  getDetailedMessage(): string {
    return `${this.message}\nOperations: ${JSON.stringify(this.operations, null, 2)}`;
  }
}

/**
 * Helper to track operations in transaction context
 * (For future use with operation tracking)
 */
export function trackOperation(
  context: TransactionContext,
  type: string,
  table?: string,
  description?: string
): void {
  context.operations.push({
    type,
    table,
    description: description || `${type} on ${table || 'unknown'}`,
  });
}

/**
 * Execute multiple operations in sequence with error handling
 * 
 * This ensures operations are executed in order and stops on first error.
 * 
 * @param operations Array of async operations to execute
 * @returns Array of results
 */
export async function executeSequentially<T>(
  operations: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];
  
  for (let i = 0; i < operations.length; i++) {
    try {
      const result = await operations[i]();
      results.push(result);
    } catch (error) {
      console.error(`❌ [SEQUENTIAL] Operation ${i + 1}/${operations.length} failed:`, error);
      // Stop execution on first error
      throw new TransactionError(
        `Sequential operation ${i + 1} failed: ${error instanceof Error ? error.message : String(error)}`,
        [{ type: 'sequential', description: `Operation ${i + 1}` }],
        error
      );
    }
  }
  
  return results;
}

/**
 * Retry a transaction operation with exponential backoff
 * 
 * Useful for handling transient database errors.
 * 
 * @param operation Operation to retry
 * @param maxRetries Maximum number of retries (default: 3)
 * @param initialDelay Initial delay in ms (default: 100)
 * @returns Result of operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 100
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      console.warn(`⚠️ [RETRY] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

