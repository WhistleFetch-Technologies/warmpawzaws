"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseError = void 0;
exports.getDbClient = getDbClient;
exports.getClient = getClient;
exports.withTransaction = withTransaction;
exports.executeRaw = executeRaw;
exports.selectQuery = selectQuery;
exports.insertQuery = insertQuery;
exports.updateQuery = updateQuery;
exports.deleteQuery = deleteQuery;
exports.upsertQuery = upsertQuery;
exports.handleDbError = handleDbError;
exports.checkDbHealth = checkDbHealth;
const pg_1 = require("pg");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
// ============================================================================
// CONFIGURATION
// ============================================================================
// Get environment variables (lazy evaluation to avoid boot errors)
function getEnvVar(name, defaultValue) {
    const value = process.env[name] || defaultValue;
    if (!value && !defaultValue) {
        console.error(`❌ Missing required environment variable: ${name}`);
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value || defaultValue || '';
}
// ============================================================================
// SINGLETON POOL INSTANCE
// ============================================================================
let pool = null;
let credentials = null;
let initializationPromise = null;
/**
 * Get database credentials from AWS Secrets Manager
 */
async function getCredentialsFromSecretsManager() {
    const secretArn = process.env.AURORA_SECRET_ARN;
    if (!secretArn) {
        console.warn('⚠️  AURORA_SECRET_ARN not set, using environment variables as fallback');
        return {
            username: process.env.AURORA_USER || 'warmpawz_admin',
            password: process.env.AURORA_PASSWORD || '',
        };
    }
    // Return cached credentials if available
    if (credentials) {
        return credentials;
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
        credentials = {
            username: secret.username || 'warmpawz_admin',
            password: secret.password || '',
        };
        console.log('✅ Database credentials retrieved from Secrets Manager');
        return credentials;
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
 */
async function initializePool() {
    if (initializationPromise) {
        return initializationPromise;
    }
    if (pool) {
        return;
    }
    initializationPromise = (async () => {
        try {
            const dbCredentials = await getCredentialsFromSecretsManager();
            // Get RDS Proxy endpoint (preferred) or fallback to direct endpoint
            const host = process.env.AURORA_PROXY_ENDPOINT || process.env.AURORA_HOST || 'localhost';
            const port = parseInt(process.env.AURORA_PORT || '5432', 10);
            const database = process.env.AURORA_DATABASE || 'warmpawz';
            const poolConfig = {
                host,
                port,
                database,
                user: dbCredentials.username,
                password: dbCredentials.password,
                max: parseInt(process.env.AURORA_POOL_MAX || '20', 10),
                idleTimeoutMillis: parseInt(process.env.AURORA_IDLE_TIMEOUT || '30000', 10),
                connectionTimeoutMillis: parseInt(process.env.AURORA_CONNECTION_TIMEOUT || '2000', 10),
                ssl: process.env.AURORA_SSL === 'true' ? { rejectUnauthorized: false } : false,
            };
            console.log(`🔌 Initializing Aurora RDS connection pool...`);
            console.log(`   Host: ${host}`);
            console.log(`   Database: ${database}`);
            console.log(`   User: ${dbCredentials.username}`);
            pool = new pg_1.Pool(poolConfig);
            // Handle pool errors
            pool.on('error', (err) => {
                console.error('❌ Unexpected error on idle database client:', err);
            });
            pool.on('connect', () => {
                console.log('✅ Database client connected to Aurora RDS');
            });
            // Test connection
            const client = await pool.connect();
            await client.query('SELECT 1');
            client.release();
            console.log('✅ Aurora RDS connection pool initialized successfully');
        }
        catch (error) {
            console.error('❌ Failed to initialize database connection pool:', error);
            pool = null;
            initializationPromise = null;
            throw error;
        }
    })();
    return initializationPromise;
}
/**
 * Get or create the pg Pool instance
 * Uses singleton pattern for connection pooling
 */
async function getDbClient() {
    if (!pool) {
        await initializePool();
    }
    if (!pool) {
        throw new Error('Database pool not initialized');
    }
    return pool;
}
/**
 * Get a client from the pool for transactions
 * IMPORTANT: Must call client.release() when done
 */
async function getClient() {
    const pool = await getDbClient();
    return await pool.connect();
}
// ============================================================================
// TRANSACTION SUPPORT
// ============================================================================
/**
 * Execute a function within a database transaction
 */
async function withTransaction(callback) {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('[DB] Transaction error, rolled back:', error);
        throw error;
    }
    finally {
        client.release();
    }
}
/**
 * Execute raw SQL query
 */
async function executeRaw(query, params = []) {
    const pool = await getDbClient();
    const result = await pool.query(query, params);
    return result.rows;
}
// ============================================================================
// QUERY BUILDING HELPERS
// ============================================================================
/**
 * Build WHERE clause from filters
 */
function buildWhereClause(filters) {
    if (!filters || Object.keys(filters).length === 0) {
        return { clause: '', params: [] };
    }
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
            conditions.push(`${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }
    }
    return {
        clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
        params,
    };
}
/**
 * Build ORDER BY clause
 */
function buildOrderByClause(orderBy, orderDirection) {
    if (!orderBy)
        return '';
    const direction = orderDirection === 'desc' ? 'DESC' : 'ASC';
    return `ORDER BY ${orderBy} ${direction}`;
}
/**
 * Build LIMIT/OFFSET clause
 */
function buildLimitClause(limit, offset) {
    const parts = [];
    if (limit)
        parts.push(`LIMIT ${limit}`);
    if (offset)
        parts.push(`OFFSET ${offset}`);
    return parts.join(' ');
}
// ============================================================================
// QUERY HELPERS (Maintains backward compatibility)
// ============================================================================
/**
 * Execute a SELECT query with error handling
 */
async function selectQuery(table, filters, options) {
    try {
        const { clause: whereClause, params: whereParams } = buildWhereClause(filters || {});
        const orderByClause = buildOrderByClause(options?.orderBy, options?.orderDirection);
        const limitClause = buildLimitClause(options?.limit, options?.offset);
        const query = `
      SELECT * FROM ${table}
      ${whereClause}
      ${orderByClause}
      ${limitClause}
    `.trim();
        const result = await executeRaw(query, whereParams);
        return result;
    }
    catch (error) {
        return handleDbError(error);
    }
}
/**
 * Execute an INSERT query with error handling
 */
async function insertQuery(table, data) {
    try {
        const dataArray = Array.isArray(data) ? data : [data];
        if (dataArray.length === 0)
            return [];
        const firstItem = dataArray[0];
        const columns = Object.keys(firstItem);
        const values = [];
        const params = [];
        let paramIndex = 1;
        for (const item of dataArray) {
            const rowValues = [];
            for (const column of columns) {
                rowValues.push(`$${paramIndex}`);
                params.push(item[column]);
                paramIndex++;
            }
            values.push(`(${rowValues.join(', ')})`);
        }
        const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${values.join(', ')}
      RETURNING *
    `;
        const result = await executeRaw(query, params);
        return result;
    }
    catch (error) {
        return handleDbError(error);
    }
}
/**
 * Execute an UPDATE query with error handling
 */
async function updateQuery(table, filters, data) {
    try {
        const { clause: whereClause, params: whereParams } = buildWhereClause(filters);
        if (!whereClause) {
            throw new Error('UPDATE query requires filters to prevent accidental full table updates');
        }
        const updateColumns = Object.keys(data);
        if (updateColumns.length === 0) {
            throw new Error('UPDATE query requires at least one field to update');
        }
        // Build SET clause with parameterized values
        const updateValues = Object.values(data);
        const setClause = updateColumns
            .map((col, index) => `${col} = $${index + 1}`)
            .join(', ');
        // Build WHERE clause with correct parameter indices (after SET params)
        const whereConditions = [];
        let paramIndex = updateValues.length + 1;
        const whereValues = [];
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                whereConditions.push(`${key} = $${paramIndex}`);
                whereValues.push(value);
                paramIndex++;
            }
        }
        // Combine all parameters: update values first, then where values
        const params = [...updateValues, ...whereValues];
        const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereConditions.join(' AND ')}
      RETURNING *
    `;
        const result = await executeRaw(query, params);
        return result;
    }
    catch (error) {
        return handleDbError(error);
    }
}
/**
 * Execute a DELETE query with error handling
 */
async function deleteQuery(table, filters) {
    try {
        const { clause: whereClause, params } = buildWhereClause(filters);
        if (!whereClause) {
            throw new Error('DELETE query requires filters to prevent accidental full table deletes');
        }
        const query = `DELETE FROM ${table} ${whereClause}`;
        await executeRaw(query, params);
    }
    catch (error) {
        handleDbError(error); // DELETE doesn't return, so just throw
        throw error; // TypeScript needs explicit throw
    }
}
/**
 * Execute an UPSERT query with error handling
 */
async function upsertQuery(table, data, conflictColumn) {
    try {
        const dataArray = Array.isArray(data) ? data : [data];
        if (dataArray.length === 0)
            return [];
        const firstItem = dataArray[0];
        const columns = Object.keys(firstItem);
        const values = [];
        const params = [];
        let paramIndex = 1;
        for (const item of dataArray) {
            const rowValues = [];
            for (const column of columns) {
                rowValues.push(`$${paramIndex}`);
                params.push(item[column]);
                paramIndex++;
            }
            values.push(`(${rowValues.join(', ')})`);
        }
        const conflictCol = conflictColumn || 'id';
        const updateClause = columns
            .filter(col => col !== conflictCol)
            .map(col => `${col} = EXCLUDED.${col}`)
            .join(', ');
        const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES ${values.join(', ')}
      ON CONFLICT (${conflictCol}) DO UPDATE SET ${updateClause}
      RETURNING *
    `;
        const result = await executeRaw(query, params);
        return result;
    }
    catch (error) {
        return handleDbError(error);
    }
}
// ============================================================================
// ERROR HANDLING
// ============================================================================
/**
 * Database error types
 */
class DatabaseError extends Error {
    code;
    details;
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'DatabaseError';
    }
}
exports.DatabaseError = DatabaseError;
/**
 * Handle database errors consistently
 */
function handleDbError(error) {
    if (error instanceof DatabaseError) {
        throw error;
    }
    const message = error?.message || 'Unknown database error';
    const code = error?.code || 'UNKNOWN_ERROR';
    throw new DatabaseError(message, code, error);
}
// ============================================================================
// HEALTH CHECK
// ============================================================================
/**
 * Check database connection health
 */
async function checkDbHealth() {
    try {
        await executeRaw('SELECT 1');
        return true;
    }
    catch (error) {
        console.error('[DB] Health check failed:', error);
        return false;
    }
}
//# sourceMappingURL=db.js.map