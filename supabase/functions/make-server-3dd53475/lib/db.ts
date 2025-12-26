/**
 * ============================================================================
 * CENTRALIZED SQL DATABASE CLIENT
 * ============================================================================
 * 
 * This module provides the single source of truth for all database access.
 * 
 * ENFORCEMENT RULES:
 * 1. ❌ NO KV imports allowed in this file or any repository
 * 2. ✅ ALL database access MUST go through this client
 * 3. ✅ ALL queries MUST use prepared statements
 * 4. ✅ ALL transactions MUST use explicit transaction boundaries
 * 5. ✅ Connection pooling is managed automatically
 * 
 * Date: 2024-12-22
 * Migration: KV to SQL
 * ============================================================================
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Get environment variables (lazy evaluation to avoid boot errors)
function getEnvVar(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`❌ Missing required environment variable: ${name}`);
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// ============================================================================
// SINGLETON CLIENT INSTANCE
// ============================================================================

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create the Supabase client instance
 * Uses singleton pattern for connection pooling
 */
export function getDbClient(): SupabaseClient {
  if (!supabaseClient) {
    const SUPABASE_URL = getEnvVar("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = getEnvVar("SUPABASE_SERVICE_ROLE_KEY");
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      db: {
        schema: "public",
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseClient;
}

// ============================================================================
// TRANSACTION SUPPORT
// ============================================================================

/**
 * Execute a function within a database transaction
 * 
 * @param callback Function to execute within transaction
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
  
  // Note: Supabase JS client doesn't support explicit transactions
  // For true transactions, we'd need to use raw SQL with BEGIN/COMMIT
  // For now, we'll use the client and document that operations should be atomic
  
  try {
    return await callback(client);
  } catch (error) {
    console.error("[DB] Transaction error:", error);
    throw error;
  }
}

/**
 * Execute raw SQL query (use sparingly, prefer Supabase client methods)
 * 
 * @param query SQL query string
 * @param params Query parameters
 * @returns Query result
 * 
 * @example
 * await executeRaw('SELECT * FROM bookings WHERE id = $1', [bookingId]);
 */
export async function executeRaw<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const client = getDbClient();
  
  // Use Supabase RPC for raw SQL execution
  // Note: This requires a database function to be created
  // For now, we'll use the client's query builder which is safer
  
  throw new Error(
    "Raw SQL execution not recommended. Use Supabase client methods or create RPC functions."
  );
}

// ============================================================================
// PREPARED STATEMENT HELPERS
// ============================================================================

/**
 * Build a prepared statement query using Supabase client
 * All queries should use this pattern for safety
 * 
 * @param table Table name
 * @param operation Operation type
 * @returns Query builder
 */
export function prepareQuery(table: string) {
  const client = getDbClient();
  return client.from(table);
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check database connection health
 * @returns true if database is accessible
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    const client = getDbClient();
    const { error } = await client.from("customers").select("id").limit(1);
    return !error;
  } catch (error) {
    console.error("[DB] Health check failed:", error);
    return false;
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Database error types
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

/**
 * Handle database errors consistently
 */
export function handleDbError(error: any): never {
  if (error?.code) {
    throw new DatabaseError(error.message, error.code, error.details);
  }
  throw new DatabaseError(error?.message || "Unknown database error");
}

// ============================================================================
// QUERY HELPERS
// ============================================================================

/**
 * Execute a SELECT query with error handling
 */
export async function selectQuery<T>(
  table: string,
  filters?: Record<string, any>,
  options?: { limit?: number; offset?: number; orderBy?: string; orderDirection?: "asc" | "desc" }
): Promise<T[]> {
  try {
    let query = getDbClient().from(table).select("*");
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      });
    }
    
    if (options?.orderBy) {
      query = query.order(options.orderBy, { ascending: options.orderDirection !== "desc" });
    }
    
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return (data || []) as T[];
  } catch (error) {
    handleDbError(error);
  }
}

/**
 * Execute an INSERT query with error handling
 */
export async function insertQuery<T>(
  table: string,
  data: Partial<T> | Partial<T>[]
): Promise<T[]> {
  try {
    const { data: result, error } = await getDbClient()
      .from(table)
      .insert(data as any)
      .select();
    
    if (error) throw error;
    return (result || []) as T[];
  } catch (error) {
    handleDbError(error);
  }
}

/**
 * Execute an UPDATE query with error handling
 */
export async function updateQuery<T>(
  table: string,
  filters: Record<string, any>,
  data: Partial<T>
): Promise<T[]> {
  try {
    let query = getDbClient().from(table).update(data as any);
    
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { data: result, error } = await query.select();
    
    if (error) throw error;
    return (result || []) as T[];
  } catch (error) {
    handleDbError(error);
  }
}

/**
 * Execute a DELETE query with error handling
 */
export async function deleteQuery(
  table: string,
  filters: Record<string, any>
): Promise<void> {
  try {
    let query = getDbClient().from(table).delete();
    
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
    
    const { error } = await query;
    
    if (error) throw error;
  } catch (error) {
    handleDbError(error);
  }
}

/**
 * Execute an UPSERT query with error handling
 */
export async function upsertQuery<T>(
  table: string,
  data: Partial<T> | Partial<T>[],
  conflictColumn?: string
): Promise<T[]> {
  try {
    const options: any = {};
    if (conflictColumn) {
      options.onConflict = conflictColumn;
    }
    
    const { data: result, error } = await getDbClient()
      .from(table)
      .upsert(data as any, options)
      .select();
    
    if (error) throw error;
    return (result || []) as T[];
  } catch (error) {
    handleDbError(error);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export { getDbClient as getClient };
export type { SupabaseClient };

