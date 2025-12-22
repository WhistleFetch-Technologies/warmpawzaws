/**
 * ============================================================================
 * PACKAGE MILESTONE TRACKING
 * ============================================================================
 * 
 * Handles milestone tracking for multi-day/session packages
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface PackageMilestone {
  id: string;
  booking_id: string;
  milestone_number: number;
  milestone_type: 'session' | 'day' | 'week' | 'month';
  scheduled_date: string;
  scheduled_time?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
  completed_at?: string | null;
  completed_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MILESTONE HANDLERS
// ============================================================================

/**
 * Create milestones for package booking
 */
export async function createPackageMilestones(
  bookingId: string,
  milestoneConfig: {
    total_milestones: number;
    milestone_type: 'session' | 'day' | 'week' | 'month';
    start_date: string;
    start_time?: string;
  }
): Promise<PackageMilestone[]> {
  const client = getDbClient();
  const bookingsRepo = getBookingsRepository();
  
  // Verify booking exists and is a package
  const booking = await bookingsRepo.findById(bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  
  if (!booking.is_package) {
    throw new Error(`Booking is not a package: ${bookingId}`);
  }
  
  const milestones: PackageMilestone[] = [];
  const startDate = new Date(milestoneConfig.start_date);
  
  for (let i = 1; i <= milestoneConfig.total_milestones; i++) {
    const scheduledDate = new Date(startDate);
    
    // Calculate date based on milestone type
    switch (milestoneConfig.milestone_type) {
      case 'session':
        // Sessions are typically daily or every few days
        scheduledDate.setDate(startDate.getDate() + (i - 1));
        break;
      case 'day':
        scheduledDate.setDate(startDate.getDate() + (i - 1));
        break;
      case 'week':
        scheduledDate.setDate(startDate.getDate() + ((i - 1) * 7));
        break;
      case 'month':
        scheduledDate.setMonth(startDate.getMonth() + (i - 1));
        break;
    }
    
    const { data: milestone, error } = await client
      .from('package_milestones')
      .insert({
        booking_id: bookingId,
        milestone_number: i,
        milestone_type: milestoneConfig.milestone_type,
        scheduled_date: scheduledDate.toISOString().split('T')[0],
        scheduled_time: milestoneConfig.start_time || null,
        status: 'pending',
      })
      .select()
      .single();
    
    if (error || !milestone) {
      console.error(`Error creating milestone ${i}:`, error);
      continue;
    }
    
    milestones.push(milestone as PackageMilestone);
  }
  
  return milestones;
}

/**
 * Complete milestone
 */
export async function completeMilestone(
  milestoneId: string,
  completedBy: string,
  notes?: string
): Promise<PackageMilestone> {
  const client = getDbClient();
  
  const { data: milestone, error: getError } = await client
    .from('package_milestones')
    .select('*, bookings(*)')
    .eq('id', milestoneId)
    .single();
  
  if (getError || !milestone) {
    throw new Error(`Milestone not found: ${milestoneId}`);
  }
  
  // Update milestone
  const { data: updated, error: updateError } = await client
    .from('package_milestones')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: completedBy,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', milestoneId)
    .select()
    .single();
  
  if (updateError || !updated) {
    throw new Error(`Failed to complete milestone: ${updateError?.message || 'Unknown error'}`);
  }
  
  // Check if all milestones are completed
  const { data: allMilestones } = await client
    .from('package_milestones')
    .select('status')
    .eq('booking_id', milestone.booking_id);
  
  const allCompleted = allMilestones?.every((m: any) => m.status === 'completed');
  const someCompleted = allMilestones?.some((m: any) => m.status === 'completed');
  
  // Update booking status
  const bookingsRepo = getBookingsRepository();
  if (allCompleted) {
    await bookingsRepo.update(milestone.booking_id, {
      status: 'completed',
    });
  } else if (someCompleted) {
    await bookingsRepo.update(milestone.booking_id, {
      status: 'partially_completed',
    });
  }
  
  return updated as PackageMilestone;
}

/**
 * Get milestones for booking
 */
export async function getBookingMilestones(bookingId: string): Promise<PackageMilestone[]> {
  const client = getDbClient();
  
  const { data: milestones, error } = await client
    .from('package_milestones')
    .select('*')
    .eq('booking_id', bookingId)
    .order('milestone_number', { ascending: true });
  
  if (error) {
    throw new Error(`Error fetching milestones: ${error.message}`);
  }
  
  return (milestones || []) as PackageMilestone[];
}

/**
 * Get next pending milestone
 */
export async function getNextPendingMilestone(bookingId: string): Promise<PackageMilestone | null> {
  const client = getDbClient();
  
  const { data: milestone, error } = await client
    .from('package_milestones')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('status', 'pending')
    .order('milestone_number', { ascending: true })
    .limit(1)
    .maybeSingle();
  
  if (error) {
    throw new Error(`Error fetching next milestone: ${error.message}`);
  }
  
  return milestone as PackageMilestone | null;
}

