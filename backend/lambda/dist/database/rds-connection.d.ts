/**
 * ============================================================================
 * AWS RDS POSTGRESQL CONNECTION MODULE
 * ============================================================================
 *
 * Replaces Supabase client with direct RDS PostgreSQL connection
 * Uses pg (node-postgres) for connection pooling and query execution
 *
 * ENFORCEMENT RULES:
 * 1. ✅ ALL database access MUST go through this module
 * 2. ✅ ALL queries MUST use prepared statements
 * 3. ✅ Connection pooling is managed automatically
 * 4. ✅ Transactions MUST use explicit transaction boundaries
 *
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda + RDS
 * ============================================================================
 */
import { Pool, PoolClient, QueryResult } from 'pg';
/**
 * Get or create the PostgreSQL connection pool
 * Uses singleton pattern for connection pooling
 */
export declare function getRdsPool(): Promise<Pool>;
/**
 * Get a client from the pool for transaction use
 */
export declare function getClient(): Promise<PoolClient>;
/**
 * Execute a query with parameters (prepared statement)
 */
export declare function query(text: string, params?: any[]): Promise<QueryResult<any>>;
/**
 * Execute a SELECT query
 */
export declare function select(table: string, filters?: Record<string, any>, options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    columns?: string[];
}): Promise<any[]>;
/**
 * Execute an INSERT query
 */
export declare function insert(table: string, data: any | any[]): Promise<any[]>;
/**
 * Execute an UPDATE query
 */
export declare function update(table: string, filters: Record<string, any>, data: any): Promise<any[]>;
/**
 * Execute a DELETE query
 */
export declare function deleteRows(table: string, filters: Record<string, any>): Promise<number>;
/**
 * Execute an UPSERT query
 */
export declare function upsert(table: string, data: any | any[], conflictColumn?: string): Promise<any[]>;
/**
 * Execute a function within a database transaction
 */
export declare function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T>;
/**
 * Check database connection health
 */
export declare function checkDbHealth(): Promise<boolean>;
export declare class DatabaseError extends Error {
    code?: string | undefined;
    details?: any | undefined;
    constructor(message: string, code?: string | undefined, details?: any | undefined);
}
/**
 * Handle database errors consistently
 */
export declare function handleDbError(error: any): never;
export { Pool, PoolClient, QueryResult };
export type { Pool as PoolType, PoolClient as PoolClientType };
//# sourceMappingURL=rds-connection.d.ts.map