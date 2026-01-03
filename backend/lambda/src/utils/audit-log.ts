/**
 * ============================================================================
 * AUDIT LOG UTILITIES (SCHEMA-AGNOSTIC)
 * ============================================================================
 * 
 * Provides append-only audit logging for compliance and debugging.
 * 
 * NOTE: This module gracefully handles missing database tables.
 * If audit tables don't exist, logging is silently skipped.
 * This allows the code to work with or without audit tables.
 * 
 * Date: 2026-01-03
 * ============================================================================
 */

import { query } from '../database/rds-connection';

// Cache table existence checks (per Lambda cold start)
const tableCache: Record<string, boolean | null> = {
  entity_audit_log: null,
  booking_status_history: null,
  payment_status_history: null,
};

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: any;
  newValues?: any;
  changedFields?: string[];
  actorId?: string;
  actorType?: string;
  actorIp?: string;
  requestId?: string;
}

/**
 * Check if a table exists in the database
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  if (tableCache[tableName] !== null) {
    return tableCache[tableName]!;
  }

  try {
    const result = await query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      ) as exists`,
      [tableName]
    );
    tableCache[tableName] = result.rows[0]?.exists === true;
    
    if (!tableCache[tableName]) {
      console.warn(`[AUDIT] Table ${tableName} not found - audit logging to this table disabled`);
    }
    
    return tableCache[tableName]!;
  } catch (error) {
    console.warn(`[AUDIT] Could not check table ${tableName} existence:`, error);
    tableCache[tableName] = false;
    return false;
  }
}

/**
 * Log an audit entry to entity_audit_log table (if it exists)
 */
export async function logAuditEntry(entry: AuditLogEntry): Promise<void> {
  const hasTable = await checkTableExists('entity_audit_log');
  if (!hasTable) {
    // Log to console as fallback
    console.log('[AUDIT]', JSON.stringify({
      type: entry.entityType,
      id: entry.entityId,
      action: entry.action,
      actor: entry.actorType,
    }));
    return;
  }

  try {
    await query(
      `INSERT INTO entity_audit_log (
        entity_type, entity_id, action, old_values, new_values, 
        changed_fields, actor_id, actor_type, actor_ip, request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        entry.entityType,
        entry.entityId,
        entry.action,
        entry.oldValues ? JSON.stringify(entry.oldValues) : null,
        entry.newValues ? JSON.stringify(entry.newValues) : null,
        entry.changedFields || null,
        entry.actorId || null,
        entry.actorType || null,
        entry.actorIp || null,
        entry.requestId || null,
      ]
    );
  } catch (error) {
    console.error('[AUDIT] Failed to log audit entry:', error);
    // Don't fail the request if audit logging fails
  }
}

/**
 * Log booking status change to booking_status_history (if it exists)
 * Falls back to console logging if table doesn't exist
 */
export async function logBookingStatusChange(
  bookingId: string,
  oldStatus: string | null,
  newStatus: string,
  changedById?: string,
  changedByType?: string,
  changeReason?: string,
  metadata?: any
): Promise<void> {
  // Always log to console for traceability
  console.log('[BOOKING_STATUS]', JSON.stringify({
    bookingId,
    oldStatus,
    newStatus,
    changedByType,
    reason: changeReason,
  }));

  const hasTable = await checkTableExists('booking_status_history');
  if (!hasTable) {
    return; // Already logged to console
  }

  try {
    await query(
      `INSERT INTO booking_status_history (
        booking_id, old_status, new_status, changed_by_id, 
        changed_by_type, change_reason, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        bookingId,
        oldStatus,
        newStatus,
        changedById || null,
        changedByType || null,
        changeReason || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (error) {
    console.error('[AUDIT] Failed to log booking status change:', error);
  }
}

/**
 * Log payment status change to payment_status_history (if it exists)
 * Falls back to console logging if table doesn't exist
 */
export async function logPaymentStatusChange(
  paymentId: string,
  oldStatus: string | null,
  newStatus: string,
  changedByType?: string,
  razorpayEvent?: string,
  metadata?: any
): Promise<void> {
  // Always log to console for traceability
  console.log('[PAYMENT_STATUS]', JSON.stringify({
    paymentId,
    oldStatus,
    newStatus,
    changedByType,
    razorpayEvent,
  }));

  const hasTable = await checkTableExists('payment_status_history');
  if (!hasTable) {
    return; // Already logged to console
  }

  try {
    await query(
      `INSERT INTO payment_status_history (
        payment_id, old_status, new_status, changed_by_type, 
        razorpay_event, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        paymentId,
        oldStatus,
        newStatus,
        changedByType || null,
        razorpayEvent || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (error) {
    console.error('[AUDIT] Failed to log payment status change:', error);
  }
}

/**
 * Get audit history for an entity (returns empty array if table doesn't exist)
 */
export async function getAuditHistory(
  entityType: string,
  entityId: string,
  limit: number = 100
): Promise<any[]> {
  const hasTable = await checkTableExists('entity_audit_log');
  if (!hasTable) {
    return [];
  }

  try {
    const result = await query(
      `SELECT * FROM entity_audit_log 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY event_timestamp DESC 
       LIMIT $3`,
      [entityType, entityId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('[AUDIT] Failed to get audit history:', error);
    return [];
  }
}

/**
 * Get booking status history (returns empty array if table doesn't exist)
 */
export async function getBookingStatusHistory(bookingId: string): Promise<any[]> {
  const hasTable = await checkTableExists('booking_status_history');
  if (!hasTable) {
    return [];
  }

  try {
    const result = await query(
      `SELECT * FROM booking_status_history 
       WHERE booking_id = $1 
       ORDER BY created_at DESC`,
      [bookingId]
    );
    return result.rows;
  } catch (error) {
    console.error('[AUDIT] Failed to get booking status history:', error);
    return [];
  }
}

/**
 * Calculate changed fields between old and new values
 */
export function calculateChangedFields(oldValues: any, newValues: any): string[] {
  const changed: string[] = [];
  
  if (!oldValues) {
    return Object.keys(newValues || {});
  }

  for (const key of Object.keys(newValues || {})) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changed.push(key);
    }
  }

  return changed;
}
