/**
 * ============================================================================
 * AURORA RDS DATABASE CLIENT (pg Pool)
 * ============================================================================
 *
 * This module provides database access using pg Pool for Aurora RDS PostgreSQL.
 *
 * MIGRATION: Supabase → Aurora RDS
 * - Replaces Supabase client with pg Pool
 * - Uses raw SQL queries with parameterized statements
 * - Maintains same API for backward compatibility
 *
 * ENFORCEMENT RULES:
 * 1. ❌ NO Supabase imports allowed
 * 2. ✅ ALL database access MUST go through this client
 * 3. ✅ ALL queries MUST use parameterized statements ($1, $2, etc.)
 * 4. ✅ ALL transactions MUST use explicit transaction boundaries
 * 5. ✅ Connection pooling is managed automatically
 *
 * Date: 2025-01-27
 * Agent: Agent 2 (Lambda Migration)
 * Migration: Supabase → Aurora RDS PostgreSQL
 * ============================================================================
 */
import { Pool, PoolClient } from 'pg';
/**
 * Get or create the pg Pool instance
 * Uses singleton pattern for connection pooling
 */
export declare function getDbClient(): Promise<Pool>;
/**
 * Get a client from the pool for transactions
 * IMPORTANT: Must call client.release() when done
 */
export declare function getClient(): Promise<PoolClient>;
/**
 * Execute a function within a database transaction
 */
export declare function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
/**
 * Execute raw SQL query
 */
export declare function executeRaw<T = any>(query: string, params?: any[]): Promise<T[]>;
/**
 * Execute a SELECT query with error handling
 */
export declare function selectQuery<T>(table: string, filters?: Record<string, any>, options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'asc' | 'desc';
}): Promise<T[]>;
/**
 * Execute an INSERT query with error handling
 */
export declare function insertQuery<T>(table: string, data: Partial<T> | Partial<T>[]): Promise<T[]>;
/**
 * Execute an UPDATE query with error handling
 */
export declare function updateQuery<T>(table: string, filters: Record<string, any>, data: Partial<T>): Promise<T[]>;
/**
 * Execute a DELETE query with error handling
 */
export declare function deleteQuery(table: string, filters: Record<string, any>): Promise<void>;
/**
 * Execute an UPSERT query with error handling
 */
export declare function upsertQuery<T>(table: string, data: Partial<T> | Partial<T>[], conflictColumn?: string): Promise<T[]>;
/**
 * Database error types
 */
export declare class DatabaseError extends Error {
    code?: string;
    details?: any;
    constructor(message: string, code?: string, details?: any);
}
/**
 * Handle database errors consistently
 */
export declare function handleDbError(error: any): never;
/**
 * Check database connection health
 */
export declare function checkDbHealth(): Promise<boolean>;
export type { Pool, PoolClient };
//# sourceMappingURL=db.d.ts.map