"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
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
class DatabaseConnection {
    static instance;
    pool = null;
    credentials = null;
    initializationPromise = null;
    constructor() { }
    static getInstance() {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }
    /**
     * Get database credentials from AWS Secrets Manager
     */
    async getCredentialsFromSecretsManager() {
        const secretArn = process.env.AURORA_SECRET_ARN;
        if (!secretArn) {
            console.warn('⚠️  AURORA_SECRET_ARN not set, using environment variables as fallback');
            return {
                username: process.env.AURORA_USER || 'warmpawz_admin',
                password: process.env.AURORA_PASSWORD || '',
            };
        }
        // Return cached credentials if available
        if (this.credentials) {
            return this.credentials;
        }
        try {
            const region = process.env.AWS_REGION || 'ap-south-1';
            const secretsClient = new client_secrets_manager_1.SecretsManagerClient({ region });
            const command = new client_secrets_manager_1.GetSecretValueCommand({
                SecretId: secretArn,
            });
            const response = await secretsClient.send(command);
            if (!response.SecretString) {
                throw new Error('Secret value is empty');
            }
            const secret = JSON.parse(response.SecretString);
            this.credentials = {
                username: secret.username || 'warmpawz_admin',
                password: secret.password || '',
            };
            console.log('✅ Database credentials retrieved from Secrets Manager');
            return this.credentials;
        }
        catch (error) {
            console.error('❌ Error fetching credentials from Secrets Manager:', error);
            // Fallback to environment variables
            return {
                username: process.env.AURORA_USER || 'warmpawz_admin',
                password: process.env.AURORA_PASSWORD || '',
            };
        }
    }
    /**
     * Initialize database connection pool
     * This is async because we need to fetch credentials from Secrets Manager
     */
    async initialize(config) {
        // If already initializing, wait for that promise
        if (this.initializationPromise) {
            return this.initializationPromise;
        }
        // If already initialized, return immediately
        if (this.pool) {
            console.warn('Database pool already initialized');
            return;
        }
        // Create initialization promise
        this.initializationPromise = this._initialize(config);
        return this.initializationPromise;
    }
    /**
     * Internal initialization logic
     */
    async _initialize(config) {
        try {
            // Get credentials from Secrets Manager
            const credentials = await this.getCredentialsFromSecretsManager();
            // Get RDS Proxy endpoint (preferred) or fallback to direct endpoint
            const host = process.env.AURORA_PROXY_ENDPOINT || process.env.AURORA_HOST || 'localhost';
            const port = parseInt(process.env.AURORA_PORT || '5432', 10);
            const database = process.env.AURORA_DATABASE || 'warmpawz';
            const poolConfig = config || {
                host,
                port,
                database,
                user: credentials.username,
                password: credentials.password,
                max: parseInt(process.env.AURORA_POOL_MAX || '20', 10),
                idleTimeoutMillis: parseInt(process.env.AURORA_IDLE_TIMEOUT || '30000', 10),
                connectionTimeoutMillis: parseInt(process.env.AURORA_CONNECTION_TIMEOUT || '2000', 10),
                ssl: process.env.AURORA_SSL === 'true' ? { rejectUnauthorized: false } : false,
            };
            console.log(`🔌 Initializing Aurora RDS connection pool...`);
            console.log(`   Host: ${host}`);
            console.log(`   Database: ${database}`);
            console.log(`   User: ${credentials.username}`);
            this.pool = new pg_1.Pool(poolConfig);
            // Handle pool errors
            this.pool.on('error', (err) => {
                console.error('❌ Unexpected error on idle database client:', err);
            });
            this.pool.on('connect', () => {
                console.log('✅ Database client connected to Aurora RDS');
            });
            // Test connection
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            console.log('✅ Aurora RDS connection pool initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize database connection pool:', error);
            throw error;
        }
    }
    /**
     * Get database connection pool
     * Ensures pool is initialized before returning
     */
    async getPool() {
        if (!this.pool) {
            // Initialize if not already done
            await this.initialize();
        }
        if (!this.pool) {
            throw new Error('Database pool not initialized. Call initialize() first.');
        }
        return this.pool;
    }
    /**
     * Get pool synchronously (for backward compatibility)
     * WARNING: May throw if pool is not initialized
     */
    getPoolSync() {
        if (!this.pool) {
            throw new Error('Database pool not initialized. Call initialize() first.');
        }
        return this.pool;
    }
    /**
     * Close database connection pool
     */
    async close() {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.credentials = null;
            this.initializationPromise = null;
            console.log('✅ Database connection pool closed');
        }
    }
    /**
     * Health check - test database connection
     */
    async healthCheck() {
        try {
            const pool = await this.getPool();
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            return true;
        }
        catch (error) {
            console.error('❌ Database health check failed:', error);
            return false;
        }
    }
    /**
     * Reset connection (useful for testing or reconnection)
     */
    async reset() {
        await this.close();
        await this.initialize();
    }
}
exports.db = DatabaseConnection.getInstance();
//# sourceMappingURL=connection.js.map