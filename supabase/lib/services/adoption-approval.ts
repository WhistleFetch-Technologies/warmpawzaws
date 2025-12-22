/**
 * ============================================================================
 * ADOPTION APPROVAL WORKFLOW
 * ============================================================================
 * 
 * Handles adoption application approval and rejection
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import { getBookingsRepository } from "../repositories/bookings.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface AdoptionApplication {
  id: string;
  booking_id: string;
  customer_id: string;
  pet_id: string;
  application_status: 'pending' | 'approved' | 'rejected' | 'completed';
  application_data: any;
  submitted_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  approval_reason?: string | null;
  rejection_reason?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ADOPTION HANDLERS
// ============================================================================

/**
 * Create adoption application
 */
export async function createAdoptionApplication(
  bookingId: string,
  applicationData: {
    pet_id: string;
    application_data: any;
  }
): Promise<AdoptionApplication> {
  const client = getDbClient();
  const bookingsRepo = getBookingsRepository();
  
  // Get booking
  const booking = await bookingsRepo.findById(bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${bookingId}`);
  }
  
  // Create application
  const { data: application, error } = await client
    .from('adoption_applications')
    .insert({
      booking_id: bookingId,
      customer_id: booking.customer_id,
      pet_id: applicationData.pet_id,
      application_data: applicationData.application_data,
      application_status: 'pending',
    })
    .select()
    .single();
  
  if (error || !application) {
    throw new Error(`Failed to create adoption application: ${error?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  await bookingsRepo.update(bookingId, {
    status: 'pending',
  });
  
  return application as AdoptionApplication;
}

/**
 * Approve adoption application
 */
export async function approveAdoption(
  applicationId: string,
  reviewedBy: string,
  approvalReason?: string
): Promise<AdoptionApplication> {
  const client = getDbClient();
  
  const { data: application, error: getError } = await client
    .from('adoption_applications')
    .select('*')
    .eq('id', applicationId)
    .single();
  
  if (getError || !application) {
    throw new Error(`Application not found: ${applicationId}`);
  }
  
  if (application.application_status !== 'pending') {
    throw new Error(`Application is not in pending status`);
  }
  
  // Update application
  const { data: updated, error: updateError } = await client
    .from('adoption_applications')
    .update({
      application_status: 'approved',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      approval_reason: approvalReason || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single();
  
  if (updateError || !updated) {
    throw new Error(`Failed to approve adoption: ${updateError?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  const bookingsRepo = getBookingsRepository();
  await bookingsRepo.update(updated.booking_id, {
    status: 'approved',
  });
  
  return updated as AdoptionApplication;
}

/**
 * Reject adoption application
 */
export async function rejectAdoption(
  applicationId: string,
  reviewedBy: string,
  rejectionReason: string
): Promise<AdoptionApplication> {
  const client = getDbClient();
  
  const { data: application, error: getError } = await client
    .from('adoption_applications')
    .select('*')
    .eq('id', applicationId)
    .single();
  
  if (getError || !application) {
    throw new Error(`Application not found: ${applicationId}`);
  }
  
  if (application.application_status !== 'pending') {
    throw new Error(`Application is not in pending status`);
  }
  
  // Update application
  const { data: updated, error: updateError } = await client
    .from('adoption_applications')
    .update({
      application_status: 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: reviewedBy,
      rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single();
  
  if (updateError || !updated) {
    throw new Error(`Failed to reject adoption: ${updateError?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  const bookingsRepo = getBookingsRepository();
  await bookingsRepo.update(updated.booking_id, {
    status: 'rejected',
  });
  
  // Process refund if payment was made
  if (application.application_data?.payment_id) {
    // Trigger refund process
    const { processRefund } = await import("./refund-handlers.ts");
    try {
      await processRefund(application.application_data.payment_id, {
        reason: 'Adoption application rejected',
        refund_to: 'wallet',
      });
    } catch (error) {
      console.error(`[Adoption] Error processing refund:`, error);
    }
  }
  
  return updated as AdoptionApplication;
}

/**
 * Complete adoption (finalize)
 */
export async function completeAdoption(applicationId: string): Promise<AdoptionApplication> {
  const client = getDbClient();
  
  const { data: application, error: getError } = await client
    .from('adoption_applications')
    .select('*')
    .eq('id', applicationId)
    .eq('application_status', 'approved')
    .single();
  
  if (getError || !application) {
    throw new Error(`Approved application not found: ${applicationId}`);
  }
  
  // Update application
  const { data: updated, error: updateError } = await client
    .from('adoption_applications')
    .update({
      application_status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', applicationId)
    .select()
    .single();
  
  if (updateError || !updated) {
    throw new Error(`Failed to complete adoption: ${updateError?.message || 'Unknown error'}`);
  }
  
  // Update booking status
  const bookingsRepo = getBookingsRepository();
  await bookingsRepo.update(updated.booking_id, {
    status: 'completed',
  });
  
  // Transfer pet ownership (update pet record)
  await client
    .from('pets')
    .update({
      customer_id: application.customer_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', application.pet_id);
  
  return updated as AdoptionApplication;
}

/**
 * Get adoption application for booking
 */
export async function getBookingAdoptionApplication(bookingId: string): Promise<AdoptionApplication | null> {
  const client = getDbClient();
  
  const { data: application, error } = await client
    .from('adoption_applications')
    .select('*')
    .eq('booking_id', bookingId)
    .maybeSingle();
  
  if (error) {
    throw new Error(`Error fetching adoption application: ${error.message}`);
  }
  
  return application as AdoptionApplication | null;
}

