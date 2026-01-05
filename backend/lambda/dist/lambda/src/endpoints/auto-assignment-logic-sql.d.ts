/**
 * ============================================================================
 * AUTO-ASSIGNMENT LOGIC FOR BOOKINGS - SQL-ONLY VERSION
 * ============================================================================
 *
 * Implements smart assignment for instant tele and home services:
 * - Instant Tele: Assign from candidate pool after payment
 * - Home Service: Auto-assign staff in radius & available
 * - Fallback: "Request accepted - vendor to assign"
 *
 * ✅ SQL-ONLY: All operations use SQL repositories
 *
 * Date: 2025-01-28
 * Migration: Supabase → Lambda
 * ============================================================================
 */
import { Hono } from 'hono';
interface AssignmentResult {
    success: boolean;
    assignedStaffId?: string;
    assignedStaffName?: string;
    assignedStaffPhoto?: string;
    assignmentMethod: 'auto' | 'manual_pending';
    message: string;
    fallbackReason?: string;
    estimatedAssignmentTime?: string;
}
/**
 * Auto-assign for Instant Tele bookings
 * Called after payment is successful
 */
declare function assignInstantTele(bookingId: string, candidateStaffIds: string[]): Promise<AssignmentResult>;
/**
 * Auto-assign for Home Service bookings
 * Called immediately upon booking creation
 */
declare function assignHomeService(bookingId: string, serviceId: string, customerLocation: {
    latitude: number;
    longitude: number;
}, scheduledDateTime: string): Promise<AssignmentResult>;
/**
 * Lambda Endpoint: Auto-assign instant tele
 */
export declare function autoAssignmentLogicEndpoints(app: Hono): void;
export { assignInstantTele, assignHomeService };
//# sourceMappingURL=auto-assignment-logic-sql.d.ts.map