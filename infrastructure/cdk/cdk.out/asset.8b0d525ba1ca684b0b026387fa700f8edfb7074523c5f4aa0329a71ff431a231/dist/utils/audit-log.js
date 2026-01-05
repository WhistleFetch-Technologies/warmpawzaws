"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAuditEntry = logAuditEntry;
exports.logBookingStatusChange = logBookingStatusChange;
exports.logPaymentStatusChange = logPaymentStatusChange;
exports.getAuditHistory = getAuditHistory;
exports.getBookingStatusHistory = getBookingStatusHistory;
exports.calculateChangedFields = calculateChangedFields;
const rds_connection_1 = require("../database/rds-connection");
// Cache table existence checks (per Lambda cold start)
const tableCache = {
    entity_audit_log: null,
    booking_status_history: null,
    payment_status_history: null,
};
/**
 * Check if a table exists in the database
 */
async function checkTableExists(tableName) {
    if (tableCache[tableName] !== null) {
        return tableCache[tableName];
    }
    try {
        const result = await (0, rds_connection_1.query)(`SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      ) as exists`, [tableName]);
        tableCache[tableName] = result.rows[0]?.exists === true;
        if (!tableCache[tableName]) {
            console.warn(`[AUDIT] Table ${tableName} not found - audit logging to this table disabled`);
        }
        return tableCache[tableName];
    }
    catch (error) {
        console.warn(`[AUDIT] Could not check table ${tableName} existence:`, error);
        tableCache[tableName] = false;
        return false;
    }
}
/**
 * Log an audit entry to entity_audit_log table (if it exists)
 */
async function logAuditEntry(entry) {
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
        await (0, rds_connection_1.query)(`INSERT INTO entity_audit_log (
        entity_type, entity_id, action, old_values, new_values, 
        changed_fields, actor_id, actor_type, actor_ip, request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, [
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
        ]);
    }
    catch (error) {
        console.error('[AUDIT] Failed to log audit entry:', error);
        // Don't fail the request if audit logging fails
    }
}
/**
 * Log booking status change to booking_status_history (if it exists)
 * Falls back to console logging if table doesn't exist
 */
async function logBookingStatusChange(bookingId, oldStatus, newStatus, changedById, changedByType, changeReason, metadata) {
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
        await (0, rds_connection_1.query)(`INSERT INTO booking_status_history (
        booking_id, old_status, new_status, changed_by_id, 
        changed_by_type, change_reason, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
            bookingId,
            oldStatus,
            newStatus,
            changedById || null,
            changedByType || null,
            changeReason || null,
            metadata ? JSON.stringify(metadata) : null,
        ]);
    }
    catch (error) {
        console.error('[AUDIT] Failed to log booking status change:', error);
    }
}
/**
 * Log payment status change to payment_status_history (if it exists)
 * Falls back to console logging if table doesn't exist
 */
async function logPaymentStatusChange(paymentId, oldStatus, newStatus, changedByType, razorpayEvent, metadata) {
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
        await (0, rds_connection_1.query)(`INSERT INTO payment_status_history (
        payment_id, old_status, new_status, changed_by_type, 
        razorpay_event, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6)`, [
            paymentId,
            oldStatus,
            newStatus,
            changedByType || null,
            razorpayEvent || null,
            metadata ? JSON.stringify(metadata) : null,
        ]);
    }
    catch (error) {
        console.error('[AUDIT] Failed to log payment status change:', error);
    }
}
/**
 * Get audit history for an entity (returns empty array if table doesn't exist)
 */
async function getAuditHistory(entityType, entityId, limit = 100) {
    const hasTable = await checkTableExists('entity_audit_log');
    if (!hasTable) {
        return [];
    }
    try {
        const result = await (0, rds_connection_1.query)(`SELECT * FROM entity_audit_log 
       WHERE entity_type = $1 AND entity_id = $2 
       ORDER BY event_timestamp DESC 
       LIMIT $3`, [entityType, entityId, limit]);
        return result.rows;
    }
    catch (error) {
        console.error('[AUDIT] Failed to get audit history:', error);
        return [];
    }
}
/**
 * Get booking status history (returns empty array if table doesn't exist)
 */
async function getBookingStatusHistory(bookingId) {
    const hasTable = await checkTableExists('booking_status_history');
    if (!hasTable) {
        return [];
    }
    try {
        const result = await (0, rds_connection_1.query)(`SELECT * FROM booking_status_history 
       WHERE booking_id = $1 
       ORDER BY created_at DESC`, [bookingId]);
        return result.rows;
    }
    catch (error) {
        console.error('[AUDIT] Failed to get booking status history:', error);
        return [];
    }
}
/**
 * Calculate changed fields between old and new values
 */
function calculateChangedFields(oldValues, newValues) {
    const changed = [];
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
//# sourceMappingURL=audit-log.js.map