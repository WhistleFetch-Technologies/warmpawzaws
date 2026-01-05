"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pool = exports.DatabaseError = void 0;
exports.getRdsPool = getRdsPool;
exports.getClient = getClient;
exports.query = query;
exports.select = select;
exports.insert = insert;
exports.update = update;
exports.deleteRows = deleteRows;
exports.upsert = upsert;
exports.withTransaction = withTransaction;
exports.checkDbHealth = checkDbHealth;
exports.handleDbError = handleDbError;
const pg_1 = require("pg");
Object.defineProperty(exports, "Pool", { enumerable: true, get: function () { return pg_1.Pool; } });
// ============================================================================
// CONFIGURATION
// ============================================================================
const DB_HOST = process.env.DB_HOST || process.env.RDS_HOSTNAME;
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || process.env.RDS_DB_NAME;
const DB_USER = process.env.DB_USER || process.env.RDS_USERNAME;
const DB_PASSWORD = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;
if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD) {
    throw new Error('Missing required RDS environment variables: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD');
}
// ============================================================================
// CONNECTION POOL
// ============================================================================
let pool = null;
/**
 * Get or create the PostgreSQL connection pool
 * Uses singleton pattern for connection pooling
 */
function getRdsPool() {
    if (!pool) {
        pool = new pg_1.Pool({
            host: DB_HOST,
            port: DB_PORT,
            database: DB_NAME,
            user: DB_USER,
            password: DB_PASSWORD,
            max: 20, // Maximum number of clients in the pool
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
            ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
        });
        // Handle pool errors
        pool.on('error', (err) => {
            console.error('Unexpected error on idle client', err);
        });
    }
    return pool;
}
/**
 * Get a client from the pool for transaction use
 */
async function getClient() {
    const pool = getRdsPool();
    return await pool.connect();
}
// ============================================================================
// QUERY EXECUTION
// ============================================================================
/**
 * Execute a query with parameters (prepared statement)
 */
async function query(text, params) {
    const pool = getRdsPool();
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (duration > 1000) {
            console.warn(`[DB] Slow query (${duration}ms): ${text.substring(0, 100)}`);
        }
        return result;
    }
    catch (error) {
        console.error('[DB] Query error:', error);
        console.error('[DB] Query:', text);
        console.error('[DB] Params:', params);
        throw error;
    }
}
/**
 * Execute a SELECT query
 */
async function select(table, filters, options) {
    const columns = options?.columns || ['*'];
    let queryText = `SELECT ${columns.join(', ')} FROM ${table}`;
    const params = [];
    let paramIndex = 1;
    // Add WHERE clause
    if (filters && Object.keys(filters).length > 0) {
        const conditions = [];
        for (const [key, value] of Object.entries(filters)) {
            if (value !== undefined && value !== null) {
                conditions.push(`${key} = $${paramIndex}`);
                params.push(value);
                paramIndex++;
            }
        }
        if (conditions.length > 0) {
            queryText += ` WHERE ${conditions.join(' AND ')}`;
        }
    }
    // Add ORDER BY
    if (options?.orderBy) {
        queryText += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    }
    // Add LIMIT and OFFSET
    if (options?.limit) {
        queryText += ` LIMIT $${paramIndex}`;
        params.push(options.limit);
        paramIndex++;
    }
    if (options?.offset) {
        queryText += ` OFFSET $${paramIndex}`;
        params.push(options.offset);
    }
    const result = await query(queryText, params);
    return result.rows;
}
/**
 * Execute an INSERT query
 */
async function insert(table, data) {
    const dataArray = Array.isArray(data) ? data : [data];
    if (dataArray.length === 0)
        return [];
    const keys = Object.keys(dataArray[0]);
    const placeholders = dataArray.map((_, idx) => {
        const start = idx * keys.length + 1;
        return `(${keys.map((_, i) => `$${start + i}`).join(', ')})`;
    }).join(', ');
    const values = dataArray.flatMap(row => keys.map(key => row[key]));
    const columns = keys.join(', ');
    const returning = keys.includes('id') ? ' RETURNING *' : ' RETURNING *';
    const queryText = `INSERT INTO ${table} (${columns}) VALUES ${placeholders}${returning}`;
    const result = await query(queryText, values);
    return result.rows;
}
/**
 * Execute an UPDATE query
 */
async function update(table, filters, data) {
    const setClause = [];
    const params = [];
    let paramIndex = 1;
    // Build SET clause
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
            setClause.push(`${key} = $${paramIndex}`);
            params.push(value);
            paramIndex++;
        }
    }
    // Build WHERE clause
    const whereClause = [];
    for (const [key, value] of Object.entries(filters)) {
        whereClause.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
    }
    const queryText = `UPDATE ${table} SET ${setClause.join(', ')} WHERE ${whereClause.join(' AND ')} RETURNING *`;
    const result = await query(queryText, params);
    return result.rows;
}
/**
 * Execute a DELETE query
 */
async function deleteRows(table, filters) {
    const whereClause = [];
    const params = [];
    let paramIndex = 1;
    for (const [key, value] of Object.entries(filters)) {
        whereClause.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
    }
    const queryText = `DELETE FROM ${table} WHERE ${whereClause.join(' AND ')}`;
    const result = await query(queryText, params);
    return result.rowCount || 0;
}
/**
 * Execute an UPSERT query
 */
async function upsert(table, data, conflictColumn = 'id') {
    const dataArray = Array.isArray(data) ? data : [data];
    if (dataArray.length === 0)
        return [];
    const keys = Object.keys(dataArray[0]);
    const placeholders = dataArray.map((_, idx) => {
        const start = idx * keys.length + 1;
        return `(${keys.map((_, i) => `$${start + i}`).join(', ')})`;
    }).join(', ');
    const values = dataArray.flatMap(row => keys.map(key => row[key]));
    const columns = keys.join(', ');
    const updateClause = keys.filter(k => k !== conflictColumn)
        .map(k => `${k} = EXCLUDED.${k}`)
        .join(', ');
    const queryText = `
    INSERT INTO ${table} (${columns}) 
    VALUES ${placeholders}
    ON CONFLICT (${conflictColumn}) 
    DO UPDATE SET ${updateClause}
    RETURNING *
  `;
    const result = await query(queryText, values);
    return result.rows;
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
        throw error;
    }
    finally {
        client.release();
    }
}
// ============================================================================
// HEALTH CHECK
// ============================================================================
/**
 * Check database connection health
 */
async function checkDbHealth() {
    try {
        await query('SELECT 1');
        return true;
    }
    catch (error) {
        console.error('[DB] Health check failed:', error);
        return false;
    }
}
// ============================================================================
// ERROR HANDLING
// ============================================================================
class DatabaseError extends Error {
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
    if (error?.code) {
        throw new DatabaseError(error.message, error.code, error.details);
    }
    throw new DatabaseError(error?.message || 'Unknown database error');
}
//# sourceMappingURL=rds-connection.js.map