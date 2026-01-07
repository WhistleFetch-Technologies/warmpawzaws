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
 * Log an audit entry to entity_audit_log table (if it exists)
 */
export declare function logAuditEntry(entry: AuditLogEntry): Promise<void>;
/**
 * Log booking status change to booking_status_history (if it exists)
 * Falls back to console logging if table doesn't exist
 */
export declare function logBookingStatusChange(bookingId: string, oldStatus: string | null, newStatus: string, changedById?: string, changedByType?: string, changeReason?: string, metadata?: any): Promise<void>;
/**
 * Log payment status change to payment_status_history (if it exists)
 * Falls back to console logging if table doesn't exist
 */
export declare function logPaymentStatusChange(paymentId: string, oldStatus: string | null, newStatus: string, changedByType?: string, razorpayEvent?: string, metadata?: any): Promise<void>;
/**
 * Get audit history for an entity (returns empty array if table doesn't exist)
 */
export declare function getAuditHistory(entityType: string, entityId: string, limit?: number): Promise<any[]>;
/**
 * Get booking status history (returns empty array if table doesn't exist)
 */
export declare function getBookingStatusHistory(bookingId: string): Promise<any[]>;
/**
 * Calculate changed fields between old and new values
 */
export declare function calculateChangedFields(oldValues: any, newValues: any): string[];
//# sourceMappingURL=audit-log.d.ts.map