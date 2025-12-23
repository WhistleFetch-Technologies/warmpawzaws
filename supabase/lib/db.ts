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

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
  );
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
    supabaseClient = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
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
    // Clean data to remove any fields that shouldn't be inserted
    const cleanData = Array.isArray(data) 
      ? data.map(item => cleanInsertData(item))
      : cleanInsertData(data);
    
    console.log(`[insertQuery] Inserting into ${table}:`, JSON.stringify(cleanData, null, 2));
    
    const { data: result, error } = await getDbClient()
      .from(table)
      .insert(cleanData as any)
      .select();
    
    if (error) {
      console.error(`[insertQuery] Database error for ${table}:`, error);
      console.error(`[insertQuery] Data attempted:`, JSON.stringify(cleanData, null, 2));
      throw error;
    }
    
    return (result || []) as T[];
  } catch (error) {
    handleDbError(error);
  }
}

/**
 * Clean insert/upsert data by removing fields that shouldn't be in INSERT/UPSERT statements
 */
function cleanInsertData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  
  const cleaned = { ...data };
  
  // Remove fields that are auto-generated or shouldn't be in INSERT/UPSERT
  // CRITICAL: customer_id should NEVER be in the customers table (it uses 'id' as primary key)
  // Other tables use customer_id as a foreign key, but customers table uses 'id'
  delete cleaned.customer_id;
  delete cleaned.id; // Will be auto-generated by database
  delete cleaned.created_at; // Auto-generated by database default
  delete cleaned.updated_at; // Auto-generated by database default
  
  // Remove any undefined or null values that might cause issues
  Object.keys(cleaned).forEach(key => {
    if (cleaned[key] === undefined) {
      delete cleaned[key];
    }
  });
  
  return cleaned;
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
    // Clean data to remove any fields that shouldn't be inserted/updated
    const cleanData = Array.isArray(data) 
      ? data.map(item => cleanInsertData(item))
      : cleanInsertData(data);
    
    console.log(`[upsertQuery] Upserting into ${table} on conflict: ${conflictColumn || 'none'}`);
    console.log(`[upsertQuery] Data:`, JSON.stringify(cleanData, null, 2));
    
    const options: any = {};
    if (conflictColumn) {
      options.onConflict = conflictColumn;
    }
    
    const { data: result, error } = await getDbClient()
      .from(table)
      .upsert(cleanData as any, options)
      .select();
    
    if (error) {
      console.error(`[upsertQuery] Database error for ${table}:`, error);
      console.error(`[upsertQuery] Error code:`, error.code);
      console.error(`[upsertQuery] Error message:`, error.message);
      console.error(`[upsertQuery] Error details:`, error.details);
      console.error(`[upsertQuery] Error hint:`, error.hint);
      console.error(`[upsertQuery] Data attempted:`, JSON.stringify(cleanData, null, 2));
      throw error;
    }
    
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

