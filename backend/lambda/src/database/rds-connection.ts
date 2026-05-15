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

import type { Pool, PoolClient, QueryResult } from 'pg';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// ============================================================================
// CONFIGURATION
// ============================================================================

const DB_HOST = process.env.DB_HOST || process.env.RDS_HOSTNAME || process.env.AURORA_PROXY_ENDPOINT;
const DB_PORT = parseInt(process.env.DB_PORT || '5432', 10);
const DB_NAME = process.env.DB_NAME || process.env.RDS_DB_NAME || process.env.AURORA_DATABASE;
const DB_SECRET_ARN = process.env.DB_SECRET_ARN || process.env.AURORA_SECRET_ARN;

// Database credentials (will be fetched from Secrets Manager)
let DB_USER: string | undefined = process.env.DB_USER || process.env.RDS_USERNAME;
let DB_PASSWORD: string | undefined = process.env.DB_PASSWORD || process.env.RDS_PASSWORD;

if (!DB_HOST || !DB_NAME) {
  throw new Error('Missing required RDS environment variables: DB_HOST, DB_NAME');
}

// ============================================================================
// SECRETS MANAGER CLIENT
// ============================================================================

const secretsClient = new SecretsManagerClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

/**
 * Fetch database credentials from AWS Secrets Manager
 */
async function fetchDbCredentials(): Promise<void> {
  if (DB_USER && DB_PASSWORD) {
    // Credentials already available
    return;
  }

  if (!DB_SECRET_ARN) {
    throw new Error('DB_SECRET_ARN not provided and credentials not in environment');
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: DB_SECRET_ARN });
    const response = await secretsClient.send(command);

    if (!response.SecretString) {
      throw new Error('Secret value is empty');
    }

    const secret = JSON.parse(response.SecretString);
    DB_USER = secret.username || secret.Username || secret.user;
    DB_PASSWORD = secret.password || secret.Password;

    if (!DB_USER || !DB_PASSWORD) {
      throw new Error('Failed to parse username/password from secret');
    }

    console.log('[DB] Successfully fetched credentials from Secrets Manager');
  } catch (error) {
    console.error('[DB] Failed to fetch credentials from Secrets Manager:', error);
    throw new Error('Failed to retrieve database credentials');
  }
}

// ============================================================================
// CONNECTION POOL
// ============================================================================

let pool: Pool | null = null;
let pgModulePromise: Promise<any> | null = null;

/**
 * Load 'pg' module in an ESM-safe way.
 * Node 20 + ESM can error if CommonJS paths are required at init time.
 * Dynamic import defers resolution and allows the bundler/runtime to pick the right entry.
 */
async function getPgModule(): Promise<any> {
  if (!pgModulePromise) {
    pgModulePromise = import('pg');
  }
  return pgModulePromise;
}

/**
 * Get or create the PostgreSQL connection pool
 * Uses singleton pattern for connection pooling
 */
export async function getRdsPool(): Promise<Pool> {
  if (!pool) {
    console.log('[DB] Initializing RDS connection pool...');
    console.log('[DB] Host:', DB_HOST, 'Port:', DB_PORT, 'Database:', DB_NAME);
    
    // Ensure credentials are fetched before creating pool
    await fetchDbCredentials();

    if (!DB_USER || !DB_PASSWORD) {
      throw new Error('Database credentials not available');
    }

    // ✅ FIX: Reduce pool size to prevent connection exhaustion
    // Lambda functions share the same RDS instance, so we need to be conservative
    // Each Lambda instance can have its own pool, so max: 5 per instance is safer
    // With many concurrent Lambda invocations, even 5 per instance can exhaust RDS
    const poolMax = parseInt(process.env.DB_POOL_MAX || '5', 10);
    const connectionTimeoutMillis = parseInt(
      process.env.DB_CONNECTION_TIMEOUT_MS || '10000',
      10,
    );

    console.log('[DB] Creating connection pool...', { poolMax, connectionTimeoutMillis });

    // ✅ FIX: RDS Proxy doesn't support statement_timeout option
    // Only set statement_timeout if NOT using RDS Proxy (direct RDS connection)
    const isRdsProxy = DB_HOST?.includes('proxy') || DB_HOST?.includes('.proxy.');
    const poolConfig: any = {
      host: DB_HOST,
      port: DB_PORT,
      database: DB_NAME,
      user: DB_USER,
      password: DB_PASSWORD,
      max: poolMax, // Reduced from 50 to 10 to prevent connection exhaustion
      idleTimeoutMillis: 30000,
      // Time to wait when acquiring a connection from the pool (or opening a new one). If all
      // connections are busy (pool exhaustion / RDS at max_connections), this fires ~at this limit.
      connectionTimeoutMillis,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
    
    // Only add statement_timeout for direct RDS connections (not RDS Proxy)
    if (!isRdsProxy) {
      poolConfig.statement_timeout = 45000; // 45 seconds (leave buffer for Lambda 60s timeout)
      console.log('[DB] Using direct RDS connection - statement_timeout enabled');
    } else {
      console.log('[DB] Using RDS Proxy - statement_timeout disabled (not supported)');
    }
    
    const { Pool: PgPool } = await getPgModule();
    pool = new PgPool(poolConfig) as Pool;

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('[DB] Unexpected error on idle client', err);
    });
    
    // ✅ FIX: Set search_path to public on each new connection and monitor pool size
    pool.on('connect', async (client) => {
      try {
        // Set search_path to ensure tables in public schema are found
        await client.query('SET search_path = public, "$user"');
        console.log('[DB] Set search_path to public on new connection');
      } catch (error) {
        console.error('[DB] Failed to set search_path:', error);
        // Don't throw - connection can still work, just log the error
      }
      console.log(`[DB] Pool: ${pool?.totalCount || 0} total, ${pool?.idleCount || 0} idle, ${pool?.waitingCount || 0} waiting`);
    });
    
    // Log pool statistics periodically (only in development to avoid log spam)
    if (process.env.NODE_ENV === 'development' || process.env.LOG_POOL_STATS === 'true') {
      setInterval(() => {
        if (pool) {
          console.log(`[DB] Pool stats - Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
        }
      }, 60000); // Every minute
    }

    // Test connection immediately
    try {
      console.log('[DB] Testing initial connection...');
      const testResult = await pool.query('SELECT 1 as test');
      console.log('[DB] Connection test successful:', testResult.rows[0]);
    } catch (error) {
      console.error('[DB] Initial connection test failed:', error);
      // Don't throw here - let individual queries handle errors
      // This allows the pool to be created even if initial test fails
    }
  }
  return pool;
}

/**
 * Get a client from the pool for transaction use
 */
export async function getClient(): Promise<PoolClient> {
  const pool = await getRdsPool();
  return await pool.connect();
}

// ============================================================================
// QUERY EXECUTION
// ============================================================================

/**
 * Execute a query with parameters (prepared statement)
 */
export async function query(
  text: string,
  params?: any[]
): Promise<QueryResult<any>> {
  const start = Date.now();
  let pool: Pool;
  
  try {
    pool = await getRdsPool();
  } catch (error) {
    console.error('[DB] Failed to get connection pool:', error);
    throw new Error(`Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Query timeout (25s to stay under typical 30s Lambda timeout)
  const QUERY_TIMEOUT_MS = 25000;
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Query exceeded ${QUERY_TIMEOUT_MS}ms timeout. Consider optimizing the query.`));
    }, QUERY_TIMEOUT_MS);
  });
  
  try {
    const queryPromise = pool.query<any>(text, params);
    const result = await Promise.race([queryPromise, timeoutPromise]);
    
    const duration = Date.now() - start;
    
    if (duration > 1000) {
      console.warn(`[DB] Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    
    return result;
  } catch (error: any) {
    const duration = Date.now() - start;
    console.error('[DB] Query error after', duration, 'ms:', error?.message || error);
    console.error('[DB] Error code:', error?.code);
    console.error('[DB] Query:', text.substring(0, 200));
    console.error('[DB] Params:', params?.slice(0, 5)); // Log first 5 params only
    
    // ✅ FIX: Handle connection pool exhaustion specifically
    if (error?.message?.includes('remaining connection slots are reserved') || 
        error?.message?.includes('too many clients already') ||
        error?.code === '53300') {
      console.error('[DB] ⚠️ Connection pool exhausted! Pool stats:', {
        total: pool?.totalCount,
        idle: pool?.idleCount,
        waiting: pool?.waitingCount
      });
      throw new Error('Database connection pool exhausted. Please try again in a moment. If this persists, contact support.');
    }
    
    // Connection checkout / TCP timeout from pg pool (connectionTimeoutMillis, default 10s)
    if (
      error?.message?.includes('Connection terminated due to connection timeout') ||
      error?.message?.includes('timeout exceeded when trying to connect')
    ) {
      throw new Error(
        `Database connection acquisition timed out after ${duration}ms. ` +
          `This usually means the pool could not get a free connection in time (RDS max_connections, high Lambda concurrency, or slow new connects), ` +
          `or the database was unreachable from Lambda (VPC/security group). It is not the same as a slow SQL query. ` +
          `Original: ${error.message}`
      );
    }

    // Our explicit query-statement race timeout (QUERY_TIMEOUT_MS)
    if (error?.message?.includes('Query exceeded')) {
      throw new Error(
        `Query timeout: ${error.message}. Query took ${duration}ms. Consider optimizing or adding indexes.`
      );
    }
    
    // Provide more helpful error messages
    if (error?.code === 'ETIMEDOUT' || error?.code === 'ECONNREFUSED') {
      throw new Error(`Database connection timeout or refused. Check RDS availability and security groups. Original: ${error.message}`);
    }
    if (error?.code === 'ENOTFOUND') {
      throw new Error(`Database host not found: ${DB_HOST}. Check DB_HOST environment variable.`);
    }
    
    throw error;
  }
}

/**
 * Execute a SELECT query
 */
export async function select(
  table: string,
  filters?: Record<string, any>,
  options?: {
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: 'ASC' | 'DESC';
    columns?: string[];
  }
): Promise<any[]> {
  const columns = options?.columns || ['*'];
  let queryText = `SELECT ${columns.join(', ')} FROM ${table}`;
  const params: any[] = [];
  let paramIndex = 1;

  // Add WHERE clause
  if (filters && Object.keys(filters).length > 0) {
    const conditions: string[] = [];
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        // Auto-detect UUID columns (id, *_id) and cast appropriately
        // This prevents "operator does not exist: uuid = text" errors
        if (key === 'id' || key.endsWith('_id')) {
          // Try to detect if it's a UUID format (basic check)
          const isLikelyUuid = typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
          if (isLikelyUuid) {
            // Use UUID type directly - PostgreSQL will handle conversion
            conditions.push(`${key} = $${paramIndex}::uuid`);
          } else {
            // For non-UUID values, cast both sides to text to avoid type mismatch
            conditions.push(`CAST(${key} AS TEXT) = CAST($${paramIndex} AS TEXT)`);
          }
        } else {
          conditions.push(`${key} = $${paramIndex}`);
        }
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
    // Check if orderBy already contains direction (DESC/ASC)
    const orderByLower = options.orderBy.toLowerCase().trim();
    const hasDirection = /\s+(desc|asc)\s*$/i.test(options.orderBy);
    
    if (hasDirection) {
      // orderBy already contains direction, use it as-is
      queryText += ` ORDER BY ${options.orderBy}`;
    } else {
      // Use orderDirection if provided, otherwise default to ASC
      queryText += ` ORDER BY ${options.orderBy} ${options.orderDirection || 'ASC'}`;
    }
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
 * Migration 617 adds support_tickets.attachments; many RDS DBs never ran it.
 * Older Lambdas may still INSERT/UPDATE a top-level `attachments` JSONB column → PG error.
 * Merge into metadata.attachments and drop the column so rows work with or without 617.
 */
function normalizeSupportTicketsRowForInsertOrUpdate(row: Record<string, any>): Record<string, any> {
  if (!row || typeof row !== 'object' || !Object.prototype.hasOwnProperty.call(row, 'attachments')) {
    return row;
  }
  const out = { ...row };
  const top = out.attachments;
  delete out.attachments;
  const prevMeta =
    out.metadata != null && typeof out.metadata === 'object' && !Array.isArray(out.metadata)
      ? { ...(out.metadata as Record<string, unknown>) }
      : {};
  const existingAttach = prevMeta.attachments;
  if (!Array.isArray(existingAttach) || existingAttach.length === 0) {
    prevMeta.attachments = Array.isArray(top) ? top : [];
  }
  out.metadata = prevMeta;
  return out;
}

/** Matches support_tickets.category CHECK (053_admin_endpoints_tables). */
const SUPPORT_TICKET_CATEGORIES = new Set([
  'general',
  'technical',
  'billing',
  'account',
  'service',
  'other',
]);

/** UI / legacy labels → valid DB category (avoids 500 on CHECK violation). */
const SUPPORT_TICKET_CATEGORY_ALIASES: Record<string, string> = {
  booking: 'service',
  order: 'other',
  payment: 'billing',
  refund: 'billing',
};

const SUPPORT_TICKET_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const SUPPORT_TICKET_SOURCES = new Set([
  'customer',
  'vendor',
  'ai_chatbot',
  'chat_handoff',
  'admin',
  'system',
]);

const SUPPORT_TICKET_STATUSES = new Set([
  'open',
  'in_progress',
  'resolved',
  'closed',
  'escalated',
  'cancelled',
]);

function normalizeSupportTicketsCheckConstraints(row: Record<string, any>): Record<string, any> {
  const out = { ...row };
  if (Object.prototype.hasOwnProperty.call(out, 'category')) {
    const c = out.category;
    if (c == null || c === '') {
      out.category = 'general';
    } else if (typeof c === 'string') {
      const s = c.trim().toLowerCase();
      if (SUPPORT_TICKET_CATEGORIES.has(s)) {
        out.category = s;
      } else {
        out.category = SUPPORT_TICKET_CATEGORY_ALIASES[s] ?? 'general';
      }
    } else {
      out.category = 'general';
    }
  }
  if (Object.prototype.hasOwnProperty.call(out, 'priority')) {
    const p = out.priority;
    if (p == null || p === '') {
      out.priority = 'medium';
    } else {
      const s = String(p).trim().toLowerCase();
      out.priority = SUPPORT_TICKET_PRIORITIES.has(s) ? s : 'medium';
    }
  }
  if (Object.prototype.hasOwnProperty.call(out, 'source')) {
    const s = out.source;
    if (s == null || s === '') {
      out.source = 'customer';
    } else {
      const k = String(s).trim().toLowerCase();
      out.source = SUPPORT_TICKET_SOURCES.has(k) ? k : 'customer';
    }
  }
  if (Object.prototype.hasOwnProperty.call(out, 'status')) {
    const st = out.status;
    if (st == null || st === '') {
      out.status = 'open';
    } else {
      const k = String(st).trim().toLowerCase();
      out.status = SUPPORT_TICKET_STATUSES.has(k) ? k : 'open';
    }
  }
  return out;
}

/**
 * Migration 013 renamed `products.stock_quantity` → `products.stock`.
 * Map legacy payloads so INSERT/UPDATE never reference a removed column.
 *
 * Always shallow-clones so callers are not mutated. Uses `in` instead of
 * `hasOwnProperty` so non-plain objects still normalize when they expose
 * `stock_quantity` as an own property after spread.
 */
export function normalizeProductsTableRowForPg<T extends Record<string, any>>(row: T): T {
  if (!row || typeof row !== 'object') {
    return row;
  }
  const out = { ...(row as Record<string, any>) };
  if (!('stock_quantity' in out)) {
    return out as T;
  }
  const hasUsableStock =
    out.stock !== undefined && out.stock !== null && out.stock !== '';
  if (!hasUsableStock) {
    const raw = out.stock_quantity;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
    out.stock = Number.isFinite(n) ? n : 0;
  }
  delete out.stock_quantity;
  return out as T;
}

/**
 * Execute an INSERT query
 * ✅ FIX: Properly handle JSONB columns by serializing objects to JSON strings
 */
export async function insert(
  table: string,
  data: any | any[]
): Promise<any[]> {
  let dataArray = Array.isArray(data) ? data : [data];
  if (dataArray.length === 0) return [];

  // SCOPE: support_tickets only — no other tables pass through this branch.
  if (table === 'support_tickets') {
    dataArray = dataArray.map((row) => {
      let merged = normalizeSupportTicketsRowForInsertOrUpdate({ ...row });
      merged = normalizeSupportTicketsCheckConstraints(merged);
      // Never send top-level attachments to PG unless column exists (migration 617); strip defensively.
      if (merged && typeof merged === 'object') delete (merged as Record<string, unknown>).attachments;
      return merged;
    });
  }

  if (table === 'products') {
    dataArray = dataArray.map((row) => {
      const normalized = normalizeProductsTableRowForPg({ ...row });
      if (normalized && typeof normalized === 'object') {
        delete (normalized as Record<string, unknown>).stock_quantity;
      }
      return normalized;
    });
  }

  // support_tickets: never include `attachments` in INSERT column list (local UI often still hits deployed API;
  // this also guards older bundles or stray ...rest payloads).
  const keys =
    table === 'support_tickets'
      ? Object.keys(dataArray[0]).filter((k) => k !== 'attachments')
      : Object.keys(dataArray[0]);
  
  // ✅ FIX: Known JSONB columns that need JSON.stringify and ::jsonb cast
  const jsonbColumns = new Set([
    'application_payload',
    'uploaded_documents',
    'specifications',
    'metadata',
    'images',
    'tags',
    'operating_hours',
    'config',
    'settings',
    'form_data',
    'additional_info',
    'pricing',
    'services_config',
    'notification_preferences',
    'search_vector_data',
    'photos', // reviews.photos — customer review images (JSON array of URLs)
    'channels', // notifications.channels is JSONB
    'data',    // notifications.data is JSONB (booking_id, meeting_id, etc.)
    'cancellation_windows',      // cancellation_policies
    'vendor_cancellation_penalty',
    'no_show_policy',
    'policy_extensions', // vendor_refund_tiers — reschedule / no-show JSON
    'setting_value',             // admin_settings
    'attachments',               // support_tickets (URLs / metadata array)
    'documents',                 // insurance_claims, insurance_policies JSONB arrays
    'coverage',                  // insurance_plans.coverage (019 legacy JSONB)
    'criteria',                  // loyalty_segments.criteria
    'conditions',                // loyalty_action_rules.conditions
    'multiplier_conditions',     // loyalty_action_rules.multiplier_conditions
    'metadata_resolvers',        // action_sources.metadata_resolvers
  ]);
  
  // Also check for columns ending with common JSONB suffixes
  const isJsonbColumn = (key: string): boolean => {
    return jsonbColumns.has(key) || 
           key.endsWith('_config') || 
           key.endsWith('_metadata') || 
           key.endsWith('_payload') ||
           key.endsWith('_data') ||
           key.endsWith('_settings') ||
           key.endsWith('_details') ||
           key.endsWith('_resolvers');
  };
  
  // ✅ FIX: Build placeholders with ::jsonb cast for JSONB columns
  const placeholders = dataArray.map((row, idx) => {
    const start = idx * keys.length + 1;
    return `(${keys.map((key, i) => {
      const value = (row as any)[key];
      // Add ::jsonb cast for JSONB columns that are objects/arrays
      if (isJsonbColumn(key) && value !== null && value !== undefined && typeof value === 'object') {
        return `$${start + i}::jsonb`;
      }
      return `$${start + i}`;
    }).join(', ')})`;
  }).join(', ');

  // ✅ FIX: Serialize JSONB values to JSON strings
  const values = dataArray.flatMap(row => keys.map(key => {
    const value = (row as any)[key];
    // Serialize objects for JSONB columns
    if (isJsonbColumn(key) && value !== null && value !== undefined && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }));
  
  const columns = keys.join(', ');
  const returning = ' RETURNING *';

  const queryText = `INSERT INTO ${table} (${columns}) VALUES ${placeholders}${returning}`;
  const result = await query(queryText, values);
  return result.rows;
}

/**
 * Execute an UPDATE query
 */
export async function update(
  table: string,
  filters: Record<string, any>,
  data: any
): Promise<any[]> {
  let payload = data;
  // SCOPE: support_tickets only — other tables use generic update path unchanged.
  if (table === 'support_tickets' && payload && typeof payload === 'object') {
    payload = normalizeSupportTicketsCheckConstraints(
      normalizeSupportTicketsRowForInsertOrUpdate({ ...payload }),
    );
    delete (payload as Record<string, unknown>).attachments;
  }

  if (table === 'products' && payload && typeof payload === 'object') {
    payload = normalizeProductsTableRowForPg({ ...payload });
    delete (payload as Record<string, unknown>).stock_quantity;
  }

  const setClause: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  // ✅ FIX: Known JSONB columns that need JSON.stringify and ::jsonb cast
  const jsonbColumns = new Set([
    'application_payload',
    'uploaded_documents',
    'specifications',
    'metadata',
    'images',
    'tags',
    'operating_hours',
    'config',
    'settings',
    'form_data',
    'additional_info',
    'pricing',
    'services_config',
    'notification_preferences',
    'search_vector_data',
    'photos', // reviews.photos
    'channels', // notifications.channels is JSONB
    'data',    // notifications.data is JSONB (booking_id, meeting_id, etc.)
    'specializations', // vendors.specializations is JSONB array
    'cancellation_windows',
    'vendor_cancellation_penalty',
    'no_show_policy',
    'policy_extensions', // vendor_refund_tiers — reschedule / no-show JSON
    'setting_value',   // admin_settings
    'attachments',     // support_tickets
    'documents',       // insurance_claims, insurance_policies JSONB arrays
    'criteria',        // loyalty_segments.criteria
    'conditions',      // loyalty_action_rules.conditions
    'multiplier_conditions',
    'metadata_resolvers', // action_sources.metadata_resolvers
  ]);
  
  // Also check for columns ending with common JSONB suffixes
  const isJsonbColumn = (key: string): boolean => {
    return jsonbColumns.has(key) || 
           key.endsWith('_config') || 
           key.endsWith('_metadata') || 
           key.endsWith('_payload') ||
           key.endsWith('_data') ||
           key.endsWith('_settings') ||
           key.endsWith('_details') ||
           key.endsWith('_resolvers');
  };

  // Build SET clause
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined) {
      // ✅ FIX: Handle JSONB columns first (including arrays stored as JSONB like uploaded_documents)
      if (isJsonbColumn(key) && value !== null && typeof value === 'object') {
        try {
          // Serialize to JSON string and cast to JSONB
          setClause.push(`${key} = $${paramIndex}::jsonb`);
          params.push(JSON.stringify(value));
          paramIndex++;
          continue;
        } catch (error) {
          // If JSON.stringify fails (circular reference, etc.), log and skip
          console.error(`❌ [DB] Failed to serialize JSONB column ${key}:`, error);
          throw new Error(`Invalid JSON value for column ${key}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      
      // ✅ Arrays (TEXT[], etc.): pass as-is; node-pg serializes to PG array
      if (Array.isArray(value)) {
        setClause.push(`${key} = $${paramIndex}`);
        params.push(value);
        paramIndex++;
        continue;
      }
      
      // Regular values
      setClause.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }
  }

  // ✅ FIX: Validate that at least one field is being updated
  if (setClause.length === 0) {
    throw new Error('No fields to update. At least one field must be provided.');
  }

  // Build WHERE clause
  const whereClause: string[] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      // ✅ FIX: Auto-detect UUID columns (id, *_id) and cast appropriately
      // This prevents "operator does not exist: uuid = text" errors
      if (key === 'id' || key.endsWith('_id')) {
        // Try to detect if it's a UUID format (basic check)
        const isLikelyUuid = typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
        if (isLikelyUuid) {
          // Use UUID type directly - PostgreSQL will handle conversion
          whereClause.push(`${key} = $${paramIndex}::uuid`);
        } else {
          // For non-UUID values, cast both sides to text to avoid type mismatch
          whereClause.push(`CAST(${key} AS TEXT) = CAST($${paramIndex} AS TEXT)`);
        }
      } else {
        whereClause.push(`${key} = $${paramIndex}`);
      }
      params.push(value);
      paramIndex++;
    }
  }

  // ✅ FIX: Validate that at least one filter condition exists
  if (whereClause.length === 0) {
    throw new Error('No filter conditions provided. At least one filter must be specified for safety.');
  }

  const queryText = `UPDATE ${table} SET ${setClause.join(', ')} WHERE ${whereClause.join(' AND ')} RETURNING *`;
  const result = await query(queryText, params);
  return result.rows;
}

/**
 * Execute a DELETE query
 */
export async function deleteRows(
  table: string,
  filters: Record<string, any>
): Promise<number> {
  const whereClause: string[] = [];
  const params: any[] = [];
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
 * Alias for deleteRows (for backward compatibility)
 */
export const deleteRecord = deleteRows;

/**
 * Execute an UPSERT query
 */
export async function upsert(
  table: string,
  data: any | any[],
  conflictColumn: string = 'id'
): Promise<any[]> {
  let dataArray = Array.isArray(data) ? data : [data];
  if (dataArray.length === 0) return [];

  if (table === 'products') {
    dataArray = dataArray.map((row) => {
      const normalized = normalizeProductsTableRowForPg({ ...row });
      if (normalized && typeof normalized === 'object') {
        delete (normalized as Record<string, unknown>).stock_quantity;
      }
      return normalized;
    });
  }

  const keys = Object.keys(dataArray[0]);
  const placeholders = dataArray.map((_, idx) => {
    const start = idx * keys.length + 1;
    return `(${keys.map((_, i) => `$${start + i}`).join(', ')})`;
  }).join(', ');

  // Serialize JSONB columns (e.g. platform_settings.setting_value) to avoid "invalid input syntax for type json"
  const jsonbKeys = new Set(['setting_value']);
  const values = dataArray.flatMap(row => keys.map(key => {
    const value = (row as any)[key];
    if (jsonbKeys.has(key) && value !== null && value !== undefined && typeof value === 'object') {
      return JSON.stringify(value);
    }
    return value;
  }));
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
 * Execute a function within a database transaction.
 * ✅ FIX: Defensively resets any lingering transaction state before BEGIN
 * to prevent "current transaction is aborted" errors from stale connections.
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  
  try {
    // ✅ CRITICAL FIX: Reset any lingering transaction state from a previously-used connection
    // In PostgreSQL, if a connection was returned to the pool with an aborted transaction,
    // all subsequent queries on it will fail with:
    //   "current transaction is aborted, commands ignored until end of transaction block"
    // A ROLLBACK clears this state. If there's no active transaction, ROLLBACK is a no-op warning.
    try { await client.query('ROLLBACK'); } catch (_) { /* no-op if no active transaction */ }
    
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore rollback errors */ }
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Check database connection health
 * Used by health check endpoint to verify database connectivity
 */
export async function checkDbHealth(): Promise<boolean> {
  try {
    // Try to get connection pool (will create if doesn't exist)
    const pool = await getRdsPool();
    
    // Test with a simple query with timeout
    const testQuery = pool.query('SELECT 1 as health_check');
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), 5000);
    });
    
    await Promise.race([testQuery, timeoutPromise]);
    return true;
  } catch (error) {
    console.error('[DB] Health check failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Handle database errors consistently
 */
export function handleDbError(error: any): never {
  if (error?.code) {
    throw new DatabaseError(error.message, error.code, error.details);
  }
  throw new DatabaseError(error?.message || 'Unknown database error');
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { Pool as PoolType, PoolClient as PoolClientType, QueryResult };

