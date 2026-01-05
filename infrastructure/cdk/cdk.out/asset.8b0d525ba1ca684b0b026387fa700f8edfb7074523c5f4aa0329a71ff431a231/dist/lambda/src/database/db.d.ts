/**
 * ============================================================================
 * AURORA RDS DATABASE CLIENT (Lambda Version)
 * ============================================================================
 *
 * This module provides database access using pg Pool for Aurora RDS PostgreSQL.
 *
 * MIGRATION: Supabase → Aurora RDS (Lambda)
 * - Uses Lambda database connection (backend/shared/database/connection.ts)
 * - Provides same API as db-aurora.ts for backward compatibility
 * - Uses AWS RDS Aurora via RDS Proxy
 * - Fetches credentials from AWS Secrets Manager
 *
 * ENFORCEMENT RULES:
 * 1. ❌ NO Supabase imports allowed
 * 2. ✅ ALL database access MUST go through this client
 * 3. ✅ ALL queries MUST use parameterized statements ($1, $2, etc.)
 * 4. ✅ ALL transactions MUST use explicit transaction boundaries
 * 5. ✅ Connection pooling is managed automatically
 *
 * Date: 2025-01-28
 * Agent: Agent 3 (Cognito Integration)
 * Migration: Repository Migration to Lambda
 * ============================================================================
 */
import { Pool, PoolClient, QueryResult } from 'pg';
export type { Pool, PoolClient, QueryResult };
/**
 * Get database connection pool
 * Uses Lambda database connection singleton
 */
export declare function getDbClient(): Promise<Pool>;
/**
 * Get a client from the pool for transactions
 * IMPORTANT: Must call client.release() when done
 */
export declare function getClient(): Promise<PoolClient>;
/**
 * Execute a function within a database transaction
 *
 * @param callback Function to execute within transaction
 * @returns Result of callback function
 *
 * @example
 * await withTransaction(async (client) => {
 *   await client.query('INSERT INTO bookings (...) VALUES (...)');
 *   await client.query('INSERT INTO payments (...) VALUES (...)');
 * });
 */
export declare function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
/**
 * Execute raw SQL query
 *
 * @param query SQL query string with $1, $2, etc. parameters
 * @param params Query parameters
 * @returns Query result
 *
 * @example
 * await executeRaw('SELECT * FROM bookings WHERE id = $1', [bookingId]);
 */
export declare function executeRaw<T = any>(query: string, params?: any[]): Promise<T[]>;
export interface SelectOptions {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
}
/**
 * Select query helper
 *
 * @param table Table name
 * @param filters Filter conditions
 * @param options Query options (limit, offset, orderBy, etc.)
 * @returns Array of results
 *
 * @example
 * const bookings = await selectQuery<Booking>("bookings", { customer_id: "123" }, { limit: 10 });
 */
export declare function selectQuery<T = any>(table: string, filters?: Record<string, any>, options?: SelectOptions): Promise<T[]>;
/**
 * Insert query helper
 *
 * @param table Table name
 * @param data Data to insert
 * @returns Array of inserted rows
 *
 * @example
 * const booking = await insertQuery<Booking>("bookings", { customer_id: "123", ... });
 */
export declare function insertQuery<T = any>(table: string, data: Record<string, any>): Promise<T[]>;
/**
 * Update query helper
 *
 * @param table Table name
 * @param filters Filter conditions
 * @param data Data to update
 * @returns Array of updated rows
 *
 * @example
 * const booking = await updateQuery<Booking>("bookings", { id: "123" }, { status: "completed" });
 */
export declare function updateQuery<T = any>(table: string, filters: Record<string, any>, data: Record<string, any>): Promise<T[]>;
/**
 * Delete query helper
 *
 * @param table Table name
 * @param filters Filter conditions
 * @returns Number of deleted rows
 *
 * @example
 * await deleteQuery("otp_tokens", { phone: "1234567890" });
 */
export declare function deleteQuery(table: string, filters: Record<string, any>): Promise<number>;
/**
 * Upsert query helper (INSERT ... ON CONFLICT)
 *
 * @param table Table name
 * @param data Data to insert/update
 * @param conflictColumn Column to check for conflicts
 * @param updateColumns Columns to update on conflict
 * @returns Array of rows
 *
 * @example
 * const vendor = await upsertQuery<Vendor>("vendors", { id: "123", ... }, "id", ["email", "phone"]);
 */
export declare function upsertQuery<T = any>(table: string, data: Record<string, any>, conflictColumn: string, updateColumns?: string[]): Promise<T[]>;
//# sourceMappingURL=db.d.ts.map