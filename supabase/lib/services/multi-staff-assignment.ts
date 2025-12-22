/**
 * ============================================================================
 * MULTI-STAFF ASSIGNMENT SERVICE
 * ============================================================================
 * 
 * Handles assignment of multiple staff members to bookings
 * Supports primary, secondary, and backup staff assignments
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";
import type { Booking } from "../repositories/bookings.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface StaffAssignment {
  booking_id: string;
  staff_id: string;
  assignment_type: 'primary' | 'secondary' | 'backup';
  assigned_at: string;
  accepted_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
}

// ============================================================================
// ASSIGNMENT LOGIC
// ============================================================================

/**
 * Assign multiple staff members to a booking
 */
export async function assignStaffToBooking(
  bookingId: string,
  staffIds: string[],
  assignmentTypes: ('primary' | 'secondary' | 'backup')[] = ['primary']
): Promise<StaffAssignment[]> {
  const client = getDbClient();
  const bookingsRepo = getBookingsRepository();
  
  // Verify booking exists
  const booking = await bookingsRepo.findById(bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  
  // Create assignments
  const assignments: StaffAssignment[] = [];
  
  for (let i = 0; i < staffIds.length; i++) {
    const staffId = staffIds[i];
    const assignmentType = assignmentTypes[i] || (i === 0 ? 'primary' : 'secondary');
    
    // Check if assignment already exists
    const { data: existing } = await client
      .from('booking_staff_assignments')
      .select('*')
      .eq('booking_id', bookingId)
      .eq('staff_id', staffId)
      .maybeSingle();
    
    if (existing) {
      assignments.push(existing as StaffAssignment);
      continue;
    }
    
    // Create new assignment
    const { data: assignment, error } = await client
      .from('booking_staff_assignments')
      .insert({
        booking_id: bookingId,
        staff_id: staffId,
        assignment_type: assignmentType,
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      console.error(`[MultiStaff] Error assigning staff ${staffId} to booking ${bookingId}:`, error);
      continue;
    }
    
    assignments.push(assignment as StaffAssignment);
  }
  
  // Update booking with primary staff if not set
  if (assignments.length > 0 && !booking.staff_id) {
    const primaryAssignment = assignments.find(a => a.assignment_type === 'primary');
    if (primaryAssignment) {
      await bookingsRepo.update(bookingId, {
        staff_id: primaryAssignment.staff_id,
      });
    }
  }
  
  return assignments;
}

/**
 * Accept staff assignment
 */
export async function acceptStaffAssignment(
  bookingId: string,
  staffId: string
): Promise<StaffAssignment> {
  const client = getDbClient();
  
  const { data: assignment, error } = await client
    .from('booking_staff_assignments')
    .update({
      accepted_at: new Date().toISOString(),
    })
    .eq('booking_id', bookingId)
    .eq('staff_id', staffId)
    .select()
    .single();
  
  if (error || !assignment) {
    throw new Error(`Assignment not found or update failed: ${error?.message || 'Unknown error'}`);
  }
  
  return assignment as StaffAssignment;
}

/**
 * Reject staff assignment
 */
export async function rejectStaffAssignment(
  bookingId: string,
  staffId: string,
  reason?: string
): Promise<StaffAssignment> {
  const client = getDbClient();
  
  const { data: assignment, error } = await client
    .from('booking_staff_assignments')
    .update({
      rejected_at: new Date().toISOString(),
      rejection_reason: reason || null,
    })
    .eq('booking_id', bookingId)
    .eq('staff_id', staffId)
    .select()
    .single();
  
  if (error || !assignment) {
    throw new Error(`Assignment not found or update failed: ${error?.message || 'Unknown error'}`);
  }
  
  // If primary staff rejected, try to assign backup
  if (assignment.assignment_type === 'primary') {
    await tryAssignBackupStaff(bookingId);
  }
  
  return assignment as StaffAssignment;
}

/**
 * Try to assign backup staff if primary rejected
 */
async function tryAssignBackupStaff(bookingId: string): Promise<void> {
  const client = getDbClient();
  
  // Find backup staff assignments
  const { data: backupAssignments } = await client
    .from('booking_staff_assignments')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('assignment_type', 'backup')
    .is('accepted_at', null)
    .is('rejected_at', null)
    .order('assigned_at', { ascending: true })
    .limit(1);
  
  if (backupAssignments && backupAssignments.length > 0) {
    const backup = backupAssignments[0];
    // Promote backup to primary
    await client
      .from('booking_staff_assignments')
      .update({
        assignment_type: 'primary',
        accepted_at: new Date().toISOString(),
      })
      .eq('id', backup.id);
    
    // Update booking
    const bookingsRepo = getBookingsRepository();
    await bookingsRepo.update(bookingId, {
      staff_id: backup.staff_id,
    });
  }
}

/**
 * Get all staff assignments for a booking
 */
export async function getBookingStaffAssignments(bookingId: string): Promise<StaffAssignment[]> {
  const client = getDbClient();
  
  const { data: assignments, error } = await client
    .from('booking_staff_assignments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('assignment_type', { ascending: true })
    .order('assigned_at', { ascending: true });
  
  if (error) {
    throw new Error(`Error fetching assignments: ${error.message}`);
  }
  
  return (assignments || []) as StaffAssignment[];
}

/**
 * Get all bookings for a staff member
 */
export async function getStaffBookings(
  staffId: string,
  options?: { status?: string; date?: string }
): Promise<Booking[]> {
  const client = getDbClient();
  
  let query = client
    .from('booking_staff_assignments')
    .select('bookings(*)')
    .eq('staff_id', staffId)
    .is('rejected_at', null);
  
  if (options?.status) {
    query = query.eq('bookings.status', options.status);
  }
  
  if (options?.date) {
    query = query.eq('bookings.booking_date', options.date);
  }
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Error fetching staff bookings: ${error.message}`);
  }
  
  // Extract bookings from join result
  const bookings = (data || [])
    .map((item: any) => item.bookings)
    .filter((b: any) => b !== null) as Booking[];
  
  return bookings;
}

