"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDbClient = getDbClient;
exports.getClient = getClient;
exports.withTransaction = withTransaction;
exports.executeRaw = executeRaw;
exports.selectQuery = selectQuery;
exports.insertQuery = insertQuery;
exports.updateQuery = updateQuery;
exports.deleteQuery = deleteQuery;
exports.upsertQuery = upsertQuery;
const connection_1 = require("../../../shared/database/connection");
/**
 * Get database connection pool
 * Uses Lambda database connection singleton
 */
async function getDbClient() {
    return await connection_1.db.getPool();
}
/**
 * Get a client from the pool for transactions
 * IMPORTANT: Must call client.release() when done
 */
async function getClient() {
    const pool = await connection_1.db.getPool();
    return await pool.connect();
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
 *   await client.query('INSERT INTO bookings (...) VALUES (...)');
 *   await client.query('INSERT INTO payments (...) VALUES (...)');
 * });
 */
async function withTransaction(callback) {
    const client = await getClient();
    try {
        await client.query("BEGIN");
        const result = await callback(client);
        await client.query("COMMIT");
        return result;
    }
    catch (error) {
        await client.query("ROLLBACK");
        console.error("[DB] Transaction error, rolled back:", error);
        throw error;
    }
    finally {
        client.release();
    }
}
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
async function executeRaw(query, params = []) {
    const pool = await connection_1.db.getPool();
    const result = await pool.query(query, params);
    return result.rows;
}
/**
 * Build WHERE clause from filters
 */
function buildWhereClause(filters) {
    const conditions = [];
    const params = [];
    let paramIndex = 1;
    for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null) {
            continue;
        }
        if (Array.isArray(value)) {
            // IN clause
            const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
            conditions.push(`${key} IN (${placeholders})`);
            params.push(...value);
        }
        else {
            conditions.push(`${key} = $${paramIndex++}`);
            params.push(value);
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
function buildOrderByClause(options) {
    if (!options?.orderBy) {
        return '';
    }
    const direction = options.orderDirection?.toUpperCase() || 'ASC';
    return `ORDER BY ${options.orderBy} ${direction}`;
}
/**
 * Build LIMIT/OFFSET clause
 */
function buildLimitClause(options) {
    const parts = [];
    if (options?.limit) {
        parts.push(`LIMIT ${options.limit}`);
    }
    if (options?.offset) {
        parts.push(`OFFSET ${options.offset}`);
    }
    return parts.join(' ');
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
async function selectQuery(table, filters = {}, options) {
    const pool = await connection_1.db.getPool();
    const { clause: whereClause, params } = buildWhereClause(filters);
    const orderByClause = buildOrderByClause(options);
    const limitClause = buildLimitClause(options);
    const query = `
    SELECT * FROM ${table}
    ${whereClause}
    ${orderByClause}
    ${limitClause}
  `.trim();
    const result = await pool.query(query, params);
    return result.rows;
}
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
async function insertQuery(table, data) {
    const pool = await connection_1.db.getPool();
    // Remove undefined values
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, value]) => value !== undefined));
    const columns = Object.keys(cleanData);
    const values = Object.values(cleanData);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    RETURNING *
  `.trim();
    const result = await pool.query(query, values);
    return result.rows;
}
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
async function updateQuery(table, filters, data) {
    const pool = await connection_1.db.getPool();
    // Remove undefined values
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, value]) => value !== undefined));
    if (Object.keys(cleanData).length === 0) {
        return [];
    }
    const { clause: whereClause, params: whereParams } = buildWhereClause(filters);
    const setClause = Object.keys(cleanData)
        .map((key, i) => `${key} = $${whereParams.length + i + 1}`)
        .join(', ');
    const values = [...whereParams, ...Object.values(cleanData)];
    const query = `
    UPDATE ${table}
    SET ${setClause}
    ${whereClause}
    RETURNING *
  `.trim();
    const result = await pool.query(query, values);
    return result.rows;
}
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
async function deleteQuery(table, filters) {
    const pool = await connection_1.db.getPool();
    const { clause: whereClause, params } = buildWhereClause(filters);
    const query = `
    DELETE FROM ${table}
    ${whereClause}
  `.trim();
    const result = await pool.query(query, params);
    return result.rowCount || 0;
}
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
async function upsertQuery(table, data, conflictColumn, updateColumns) {
    const pool = await connection_1.db.getPool();
    // Remove undefined values
    const cleanData = Object.fromEntries(Object.entries(data).filter(([_, value]) => value !== undefined));
    const columns = Object.keys(cleanData);
    const values = Object.values(cleanData);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    // Build UPDATE clause for ON CONFLICT
    const updateClause = updateColumns
        ? updateColumns.map((col, i) => `${col} = $${values.length + i + 1}`).join(', ')
        : columns
            .filter(col => col !== conflictColumn)
            .map((col, i) => `${col} = $${values.length + i + 1}`)
            .join(', ');
    const updateValues = updateColumns
        ? updateColumns.map(col => cleanData[col])
        : columns.filter(col => col !== conflictColumn).map(col => cleanData[col]);
    const query = `
    INSERT INTO ${table} (${columns.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT (${conflictColumn})
    DO UPDATE SET ${updateClause}
    RETURNING *
  `.trim();
    const result = await pool.query(query, [...values, ...updateValues]);
    return result.rows;
}
//# sourceMappingURL=db.js.map