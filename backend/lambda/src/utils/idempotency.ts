/**
 * ============================================================================
 * IDEMPOTENCY UTILITIES (SCHEMA-AGNOSTIC)
 * ============================================================================
 * 
 * Provides idempotency key checking and storage for replay-safe operations.
 * 
 * NOTE: This module gracefully handles missing database tables.
 * If idempotency_keys table doesn't exist, operations proceed without
 * idempotency protection (fail-open for availability).
 * 
 * Date: 2026-01-03
 * ============================================================================
 */

import { query } from '../database/rds-connection';

// Cache whether the idempotency table exists (checked once per Lambda cold start)
let tableExists: boolean | null = null;

export interface IdempotencyResult {
  exists: boolean;
  response?: any;
  httpStatus?: number;
  entityId?: string;
}

/**
 * Check if idempotency_keys table exists in the database
 */
async function checkTableExists(): Promise<boolean> {
  if (tableExists !== null) {
    return tableExists;
  }

  try {
    const result = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'idempotency_keys'
      ) as exists`
    );
    tableExists = result.rows[0]?.exists === true;
    
    if (!tableExists) {
      console.warn('[IDEMPOTENCY] Table idempotency_keys not found - idempotency checks disabled');
    }
    
    return tableExists;
  } catch (error) {
    console.warn('[IDEMPOTENCY] Could not check table existence:', error);
    tableExists = false;
    return false;
  }
}

/**
 * Check if an idempotency key exists and return cached response
 */
export async function checkIdempotencyKey(key: string): Promise<IdempotencyResult> {
  if (!key) {
    return { exists: false };
  }

  // Check if table exists
  const hasTable = await checkTableExists();
  if (!hasTable) {
    return { exists: false };
  }

  try {
    const result = await query(
      `SELECT entity_id, response, http_status 
       FROM idempotency_keys 
       WHERE key = $1 AND expires_at > NOW()`,
      [key]
    );

    if (result.rows.length > 0) {
      const row = result.rows[0];
      return {
        exists: true,
        response: row.response,
        httpStatus: row.http_status,
        entityId: row.entity_id,
      };
    }

    return { exists: false };
  } catch (error) {
    console.error('[IDEMPOTENCY] Error checking key:', error);
    // On error, assume key doesn't exist (fail-open for availability)
    return { exists: false };
  }
}

/**
 * Store idempotency key with response for future duplicate requests
 */
export async function storeIdempotencyKey(
  key: string,
  entityType: string,
  entityId: string,
  response: any,
  httpStatus: number = 200,
  expiryHours: number = 24
): Promise<void> {
  if (!key) return;

  // Check if table exists
  const hasTable = await checkTableExists();
  if (!hasTable) {
    return; // Silently skip if table doesn't exist
  }

  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    await query(
      `INSERT INTO idempotency_keys (key, entity_type, entity_id, response, http_status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (key) DO NOTHING`,
      [key, entityType, entityId, JSON.stringify(response), httpStatus, expiresAt]
    );
  } catch (error) {
    console.error('[IDEMPOTENCY] Error storing key:', error);
    // Don't fail the request if idempotency storage fails
  }
}

/**
 * Wrapper function to make any handler idempotent
 */
export async function withIdempotency<T>(
  idempotencyKey: string | undefined,
  entityType: string,
  handler: () => Promise<{ data: T; status: number }>
): Promise<{ data: T; status: number; cached: boolean }> {
  // If no idempotency key provided, just execute handler
  if (!idempotencyKey) {
    const result = await handler();
    return { ...result, cached: false };
  }

  // Check if we've seen this key before
  const existing = await checkIdempotencyKey(idempotencyKey);
  if (existing.exists) {
    return {
      data: existing.response,
      status: existing.httpStatus || 200,
      cached: true,
    };
  }

  // Execute handler
  const result = await handler();

  // Store result for future duplicate requests
  if (result.data && (result.data as any).id) {
    await storeIdempotencyKey(
      idempotencyKey,
      entityType,
      (result.data as any).id,
      result.data,
      result.status
    );
  }

  return { ...result, cached: false };
}

/**
 * Generate deterministic hash for request payload (for additional verification)
 */
export function hashRequest(payload: any): string {
  const crypto = require('crypto');
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
