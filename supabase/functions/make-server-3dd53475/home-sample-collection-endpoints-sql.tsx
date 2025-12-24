/**
 * 🏥 HOME SAMPLE COLLECTION ENDPOINTS - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Handles staff assignment and tracking for home diagnostic sample collection
 * 
 * Flow:
 * 1. Customer books diagnostic test with home collection
 * 2. Lab assigns staff member to collect sample
 * 3. Staff receives notification with customer details
 * 4. Staff collects sample (OTP verification)
 * 5. Sample tracked back to lab
 * 6. Results delivered to customer
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDbClient } from "../../lib/db.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getStaffRepository } from "../../lib/repositories/staff.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";

export function homeSampleCollectionEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  const client = getDbClient();
  const vendorsRepo = getVendorsRepository();
  const staffRepo = getStaffRepository();
  const bookingsRepo = getBookingsRepository();

  // ============================================
  // LAB/VENDOR ENDPOINTS - Staff Assignment
  // ============================================

  /**
   * POST /vendor/:vendorId/sample-collection/assign
   * Assign staff to home sample collection booking
   */
  app.post(`${BASE_PATH}/vendor/:vendorId/sample-collection/assign`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const {
        bookingId,
        staffId,
        scheduledDate,
        scheduledTime,
        estimatedDuration,
        notes
      } = await c.req.json();

      console.log(`🏥 [SQL] Assigning staff ${staffId} to sample collection booking ${bookingId}`);

      // Validate booking exists
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized: Booking belongs to different vendor', 403);
      }

      // Validate staff exists and belongs to vendor
      const staff = await staffRepo.findById(staffId);
      if (!staff) {
        return sendError(c, 'Staff not found', 404);
      }

      if (staff.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized: Staff belongs to different vendor', 403);
      }

      // Get customer details
      const customer = await client
        .from('customers')
        .select('*')
        .eq('id', booking.customer_id)
        .single();

      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // Create sample collection assignment
      const assignmentId = `SAMPLE-COLLECT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      const collectionOTP = Math.floor(100000 + Math.random() * 900000).toString();

      const { data: assignment, error: insertError } = await client
        .from('sample_collection_assignments')
        .insert({
          assignment_id: assignmentId,
          booking_id: bookingId,
          vendor_id: vendorId,
          staff_id: staffId,
          customer_id: booking.customer_id,
          customer_name: customer.full_name || 'Customer',
          customer_phone: customer.phone,
          customer_address: booking.address ? JSON.parse(JSON.stringify(booking.address)) : {},
          pet_id: null, // Would need to get from booking if available
          pet_name: null,
          diagnostic_tests: booking.package_details?.tests || [],
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          scheduled_datetime: scheduledDateTime,
          estimated_duration: estimatedDuration || 30,
          status: 'assigned',
          collection_otp: collectionOTP,
          notes: notes || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating assignment:', insertError);
        return sendError(c, insertError, 500);
      }

      console.log(`✅ [SQL] Sample collection assigned: ${assignmentId}`);

      return sendSuccess(c, {
        assignment,
        message: 'Staff assigned successfully'
      });

    } catch (error) {
      console.error('❌ [SQL] Error assigning staff to sample collection:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /vendor/:vendorId/sample-collection/assignments
   * Get all sample collection assignments for vendor
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/sample-collection/assignments`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const status = c.req.query('status');
      const date = c.req.query('date');

      console.log(`🏥 [SQL] Loading sample collection assignments for vendor ${vendorId}`);

      let query = client
        .from('sample_collection_assignments')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('scheduled_datetime', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (date) {
        query = query.eq('scheduled_date', date);
      }

      const { data: assignments, error } = await query;

      if (error) {
        console.error('Error fetching assignments:', error);
        return sendError(c, error, 500);
      }

      console.log(`✅ [SQL] Loaded ${assignments?.length || 0} sample collection assignments`);

      return sendSuccess(c, { assignments: assignments || [], total: assignments?.length || 0 });

    } catch (error) {
      console.error('❌ [SQL] Error loading sample collection assignments:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /vendor/:vendorId/sample-collection/:assignmentId/reassign
   * Reassign to different staff member
   */
  app.put(`${BASE_PATH}/vendor/:vendorId/sample-collection/:assignmentId/reassign`, async (c) => {
    try {
      const { vendorId, assignmentId } = c.req.param();
      const { newStaffId, reason } = await c.req.json();

      const { data: assignment, error: fetchError } = await client
        .from('sample_collection_assignments')
        .select('*')
        .or(`id.eq.${assignmentId},assignment_id.eq.${assignmentId}`)
        .single();

      if (fetchError || !assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      if (assignment.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Get new staff details
      const newStaff = await staffRepo.findById(newStaffId);
      if (!newStaff || newStaff.vendorId !== vendorId) {
        return sendError(c, 'Invalid staff member', 400);
      }

      // Update assignment
      const { data: updatedAssignment, error: updateError } = await client
        .from('sample_collection_assignments')
        .update({
          staff_id: newStaffId,
          notes: reason ? `${assignment.notes || ''}\nReassigned: ${reason}` : assignment.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating assignment:', updateError);
        return sendError(c, updateError, 500);
      }

      console.log(`✅ [SQL] Sample collection reassigned to ${newStaff.name}`);

      return sendSuccess(c, { assignment: updatedAssignment, message: 'Reassigned successfully' });

    } catch (error) {
      console.error('❌ [SQL] Error reassigning sample collection:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // STAFF ENDPOINTS - Collection Management
  // ============================================

  /**
   * GET /staff/:staffId/sample-collections
   * Get all sample collection assignments for staff member
   */
  app.get(`${BASE_PATH}/staff/:staffId/sample-collections`, async (c) => {
    try {
      const { staffId } = c.req.param();
      const status = c.req.query('status');
      const date = c.req.query('date');

      console.log(`🏥 [SQL] Loading sample collections for staff ${staffId}`);

      let query = client
        .from('sample_collection_assignments')
        .select('*')
        .eq('staff_id', staffId)
        .order('scheduled_datetime', { ascending: true });

      if (status) {
        query = query.eq('status', status);
      }

      if (date) {
        query = query.eq('scheduled_date', date);
      }

      const { data: assignments, error } = await query;

      if (error) {
        console.error('Error fetching assignments:', error);
        return sendError(c, error, 500);
      }

      console.log(`✅ [SQL] Loaded ${assignments?.length || 0} assignments`);

      return sendSuccess(c, { assignments: assignments || [], total: assignments?.length || 0 });

    } catch (error) {
      console.error('❌ [SQL] Error loading staff sample collections:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * PUT /staff/sample-collection/:assignmentId/status
   * Update sample collection status (staff app)
   */
  app.put(`${BASE_PATH}/staff/sample-collection/:assignmentId/status`, async (c) => {
    try {
      const { assignmentId } = c.req.param();
      const { staffId, status, location, notes } = await c.req.json();

      const { data: assignment, error: fetchError } = await client
        .from('sample_collection_assignments')
        .select('*')
        .or(`id.eq.${assignmentId},assignment_id.eq.${assignmentId}`)
        .single();

      if (fetchError || !assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      if (assignment.staff_id !== staffId) {
        return sendError(c, 'Unauthorized: This assignment belongs to a different staff member', 403);
      }

      // Update status and timestamp
      const updateData: any = {
        status: status,
        updated_at: new Date().toISOString(),
      };

      if (status === 'in_transit') {
        updateData.departure_time = new Date().toISOString();
      } else if (status === 'arrived') {
        updateData.arrival_time = new Date().toISOString();
      } else if (status === 'collecting') {
        updateData.collection_start_time = new Date().toISOString();
      } else if (status === 'collected') {
        updateData.collection_completed_time = new Date().toISOString();
      } else if (status === 'completed') {
        updateData.completion_time = new Date().toISOString();
      }

      if (location) {
        updateData.current_location = location;
        // Add to route
        const route = assignment.route || [];
        route.push({ ...location, timestamp: new Date().toISOString() });
        updateData.route = route;
      }

      if (notes) {
        updateData.notes = `${assignment.notes || ''}\n${notes}`;
      }

      const { data: updatedAssignment, error: updateError } = await client
        .from('sample_collection_assignments')
        .update(updateData)
        .eq('id', assignment.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating assignment:', updateError);
        return sendError(c, updateError, 500);
      }

      console.log(`✅ [SQL] Sample collection status updated to: ${status}`);

      return sendSuccess(c, { assignment: updatedAssignment, message: 'Status updated successfully' });

    } catch (error) {
      console.error('❌ [SQL] Error updating sample collection status:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /staff/sample-collection/:assignmentId/verify-otp
   * Verify OTP before collecting sample
   */
  app.post(`${BASE_PATH}/staff/sample-collection/:assignmentId/verify-otp`, async (c) => {
    try {
      const { assignmentId } = c.req.param();
      const { staffId, otp } = await c.req.json();

      const { data: assignment, error: fetchError } = await client
        .from('sample_collection_assignments')
        .select('*')
        .or(`id.eq.${assignmentId},assignment_id.eq.${assignmentId}`)
        .single();

      if (fetchError || !assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      if (assignment.staff_id !== staffId) {
        return sendError(c, 'Unauthorized', 403);
      }

      if (assignment.collection_otp !== otp) {
        return sendError(c, 'Invalid OTP', 400);
      }

      if (assignment.otp_verified) {
        return sendError(c, 'OTP already verified', 400);
      }

      // Verify OTP
      const { data: updatedAssignment, error: updateError } = await client
        .from('sample_collection_assignments')
        .update({
          otp_verified: true,
          status: 'collecting',
          collection_start_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating assignment:', updateError);
        return sendError(c, updateError, 500);
      }

      console.log(`✅ [SQL] OTP verified for sample collection ${assignmentId}`);

      return sendSuccess(c, {
        assignment: updatedAssignment,
        message: 'OTP verified successfully. You can now collect the sample.'
      });

    } catch (error) {
      console.error('❌ [SQL] Error verifying OTP:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /staff/sample-collection/:assignmentId/complete
   * Complete sample collection with details
   */
  app.post(`${BASE_PATH}/staff/sample-collection/:assignmentId/complete`, async (c) => {
    try {
      const { assignmentId } = c.req.param();
      const {
        staffId,
        samplesCollected,
        sampleCondition,
        storageTemperature,
        notes,
        photos
      } = await c.req.json();

      const { data: assignment, error: fetchError } = await client
        .from('sample_collection_assignments')
        .select('*')
        .or(`id.eq.${assignmentId},assignment_id.eq.${assignmentId}`)
        .single();

      if (fetchError || !assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      if (assignment.staff_id !== staffId) {
        return sendError(c, 'Unauthorized', 403);
      }

      if (!assignment.otp_verified) {
        return sendError(c, 'OTP must be verified before completing collection', 400);
      }

      // Complete the collection
      const { data: updatedAssignment, error: updateError } = await client
        .from('sample_collection_assignments')
        .update({
          status: 'collected',
          notes: `${assignment.notes || ''}\n${notes || ''}`,
          collection_completed_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating assignment:', updateError);
        return sendError(c, updateError, 500);
      }

      // Update booking status if linked to diagnostic_booking
      if (assignment.diagnostic_booking_id) {
        await client
          .from('diagnostic_bookings')
          .update({
            status: 'sample_collected',
            sample_collection_time: new Date().toISOString(),
          })
          .eq('id', assignment.diagnostic_booking_id);
      }

      console.log(`✅ [SQL] Sample collection completed: ${assignmentId}`);

      return sendSuccess(c, {
        assignment: updatedAssignment,
        message: 'Sample collection completed successfully'
      });

    } catch (error) {
      console.error('❌ [SQL] Error completing sample collection:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /staff/sample-collection/:assignmentId/lab-received
   * Mark sample as received at lab
   */
  app.post(`${BASE_PATH}/staff/sample-collection/:assignmentId/lab-received`, async (c) => {
    try {
      const { assignmentId } = c.req.param();
      const { staffId, receivedBy, condition, notes } = await c.req.json();

      const { data: assignment, error: fetchError } = await client
        .from('sample_collection_assignments')
        .select('*')
        .or(`id.eq.${assignmentId},assignment_id.eq.${assignmentId}`)
        .single();

      if (fetchError || !assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      const { data: updatedAssignment, error: updateError } = await client
        .from('sample_collection_assignments')
        .update({
          status: 'completed',
          notes: `${assignment.notes || ''}\nLab received: ${notes || ''}`,
          completion_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', assignment.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating assignment:', updateError);
        return sendError(c, updateError, 500);
      }

      // Update diagnostic booking if linked
      if (assignment.diagnostic_booking_id) {
        await client
          .from('diagnostic_bookings')
          .update({
            status: 'sample_received_at_lab',
          })
          .eq('id', assignment.diagnostic_booking_id);
      }

      console.log(`✅ [SQL] Sample received at lab: ${assignmentId}`);

      return sendSuccess(c, {
        assignment: updatedAssignment,
        message: 'Sample marked as received at lab'
      });

    } catch (error) {
      console.error('❌ [SQL] Error marking sample as received:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // CUSTOMER ENDPOINTS - Tracking
  // ============================================

  /**
   * GET /customer/booking/:bookingId/sample-collection
   * Get sample collection details for booking
   */
  app.get(`${BASE_PATH}/customer/booking/:bookingId/sample-collection`, async (c) => {
    try {
      const { bookingId } = c.req.param();

      const { data: assignment, error } = await client
        .from('sample_collection_assignments')
        .select('*')
        .eq('booking_id', bookingId)
        .single();

      if (error || !assignment) {
        return sendSuccess(c, {
          hasAssignment: false,
          message: 'No sample collection assignment yet'
        });
      }

      // Don't send OTP to customer for security
      const { collection_otp, ...customerInfo } = assignment;

      return sendSuccess(c, {
        assignment: { ...customerInfo, hasAssignment: true }
      });

    } catch (error) {
      console.error('❌ [SQL] Error loading sample collection for customer:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // ANALYTICS & REPORTS
  // ============================================

  /**
   * GET /vendor/:vendorId/sample-collection/stats
   * Get sample collection statistics
   */
  app.get(`${BASE_PATH}/vendor/:vendorId/sample-collection/stats`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const startDate = c.req.query('startDate');
      const endDate = c.req.query('endDate');

      let query = client
        .from('sample_collection_assignments')
        .select('*')
        .eq('vendor_id', vendorId);

      if (startDate) {
        query = query.gte('scheduled_date', startDate);
      }

      if (endDate) {
        query = query.lte('scheduled_date', endDate);
      }

      const { data: assignments, error } = await query;

      if (error) {
        console.error('Error fetching stats:', error);
        return sendError(c, error, 500);
      }

      const stats = {
        total: assignments?.length || 0,
        assigned: 0,
        inTransit: 0,
        completed: 0,
        cancelled: 0,
        averageCollectionTime: 0,
        onTimePercentage: 0
      };

      let totalCollectionTime = 0;
      let completedCount = 0;
      let onTimeCount = 0;

      (assignments || []).forEach((assignment: any) => {
        if (assignment.status === 'assigned') stats.assigned++;
        if (assignment.status === 'in_transit' || assignment.status === 'arrived') stats.inTransit++;
        if (assignment.status === 'completed') stats.completed++;
        if (assignment.status === 'cancelled') stats.cancelled++;

        // Calculate collection time
        if (assignment.collection_start_time && assignment.collection_completed_time) {
          const duration = new Date(assignment.collection_completed_time).getTime() -
                          new Date(assignment.collection_start_time).getTime();
          totalCollectionTime += duration;
          completedCount++;

          // Check if on time
          const scheduledTime = new Date(assignment.scheduled_datetime).getTime();
          const actualStartTime = new Date(assignment.collection_start_time).getTime();
          if (actualStartTime <= scheduledTime + (30 * 60 * 1000)) {
            onTimeCount++;
          }
        }
      });

      if (completedCount > 0) {
        stats.averageCollectionTime = Math.round(totalCollectionTime / completedCount / 60000);
        stats.onTimePercentage = Math.round((onTimeCount / completedCount) * 100);
      }

      return sendSuccess(c, { stats });

    } catch (error) {
      console.error('❌ [SQL] Error getting sample collection stats:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Home Sample Collection Endpoints (SQL) registered');
}

