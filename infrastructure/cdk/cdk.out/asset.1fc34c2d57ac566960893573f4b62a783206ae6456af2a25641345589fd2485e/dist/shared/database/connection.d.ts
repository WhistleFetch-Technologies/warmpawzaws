import { Pool, PoolConfig } from 'pg';
/**
 * Database connection pool for Aurora RDS PostgreSQL
 * Uses RDS Proxy endpoint and AWS Secrets Manager for credentials
 *
 * Lambda Environment Variables Required:
 * - AURORA_PROXY_ENDPOINT: RDS Proxy endpoint (from CDK)
 * - AURORA_SECRET_ARN: Secrets Manager ARN for database credentials
 * - AURORA_DATABASE: Database name (default: 'warmpawz')
 * - AWS_REGION: AWS region (automatically set by Lambda runtime)
 */
declare class DatabaseConnection {
    private static instance;
    private pool;
    private credentials;
    private initializationPromise;
    private constructor();
    static getInstance(): DatabaseConnection;
    /**
     * Get database credentials from AWS Secrets Manager
     */
    private getCredentialsFromSecretsManager;
    /**
     * Initialize database connection pool
     * This is async because we need to fetch credentials from Secrets Manager
     */
    initialize(config?: PoolConfig): Promise<void>;
    /**
     * Internal initialization logic
     */
    private _initialize;
    /**
     * Get database connection pool
     * Ensures pool is initialized before returning
     */
    getPool(): Promise<Pool>;
    /**
     * Get pool synchronously (for backward compatibility)
     * WARNING: May throw if pool is not initialized
     */
    getPoolSync(): Pool;
    /**
     * Close database connection pool
     */
    close(): Promise<void>;
    /**
     * Health check - test database connection
     */
    healthCheck(): Promise<boolean>;
    /**
     * Reset connection (useful for testing or reconnection)
     */
    reset(): Promise<void>;
}
export declare const db: DatabaseConnection;
export {};
//# sourceMappingURL=connection.d.ts.map