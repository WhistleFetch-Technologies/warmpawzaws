import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * 🏥 HOME SAMPLE COLLECTION ENDPOINTS
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

export function homeSampleCollectionEndpoints(app: Hono, kv: any) {
  const BASE_PATH = "/make-server-3dd53475";

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
        estimatedDuration, // minutes
        notes
      } = await c.req.json();

      console.log(`🏥 Assigning staff ${staffId} to sample collection booking ${bookingId}`);

      // Validate booking exists
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized: Booking belongs to different vendor', 403);
      }

      // Validate staff exists and belongs to vendor
      const staff = await kv.get(`staff:${staffId}`);
      if (!staff) {
        return sendError(c, 'Staff not found', 404);
      }

      if (staff.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized: Staff belongs to different vendor', 403);
      }

      // Create sample collection assignment
      const assignmentId = `SAMPLE-COLLECT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      
      const assignment = {
        id: assignmentId,
        bookingId,
        vendorId,
        vendorName: booking.vendorName,
        
        staffId,
        staffName: staff.name,
        staffPhone: staff.phone,
        staffPhoto: staff.photo || '',
        
        customerId: booking.customerId,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerAddress: booking.address || {},
        
        petId: booking.petId,
        petName: booking.petName,
        
        diagnosticTests: booking.serviceDetails?.tests || [],
        
        scheduledDate,
        scheduledTime,
        scheduledDateTime: new Date(`${scheduledDate}T${scheduledTime}`).toISOString(),
        estimatedDuration: estimatedDuration || 30,
        
        status: 'assigned', // assigned | in_transit | arrived | collecting | collected | returning | completed | cancelled
        
        // OTP for sample collection
        collectionOTP: Math.floor(100000 + Math.random() * 900000).toString(),
        otpVerified: false,
        
        // Tracking
        departureTime: null,
        arrivalTime: null,
        collectionStartTime: null,
        collectionEndTime: null,
        completionTime: null,
        
        // Sample details
        samplesCollected: [],
        sampleCondition: '', // good | acceptable | poor
        storageTemperature: null,
        
        // GPS tracking
        trackingSessionId: null,
        currentLocation: null,
        
        notes: notes || '',
        assignedAt: new Date().toISOString(),
        assignedBy: vendorId,
        
        // Lab result tracking
        labReceivedAt: null,
        resultsGeneratedAt: null,
        resultsDeliveredAt: null
      };

      // Save assignment
      await kv.set(`sample-collection:${assignmentId}`, assignment);

      // Add to vendor's assignments list
      const vendorAssignments = await kv.get(`vendor:${vendorId}:sample-collections`) || [];
      vendorAssignments.unshift(assignmentId);
      await kv.set(`vendor:${vendorId}:sample-collections`, vendorAssignments);

      // Add to staff's assignments list
      const staffAssignments = await kv.get(`staff:${staffId}:sample-collections`) || [];
      staffAssignments.unshift(assignmentId);
      await kv.set(`staff:${staffId}:sample-collections`, staffAssignments);

      // Update booking with assignment
      booking.sampleCollectionAssignment = assignmentId;
      booking.sampleCollectionStatus = 'assigned';
      await kv.set(`booking:${bookingId}`, booking);

      console.log(`✅ Sample collection assigned: ${assignmentId}`);

      // TODO: Send notification to staff with customer details and OTP

      return sendSuccess(c, {
        assignment,
        message: 'Staff assigned successfully'
      });

    } catch (error) {
      console.error('❌ Error assigning staff to sample collection:', error);
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
      const { status, date } = c.req.query();

      console.log(`🏥 Loading sample collection assignments for vendor ${vendorId}`);

      const assignmentIds = await kv.get(`vendor:${vendorId}:sample-collections`) || [];

      const assignments = [];
      for (const id of assignmentIds) {
        const assignment = await kv.get(`sample-collection:${id}`);
        if (assignment) {
          // Filter by status if provided
          if (status && assignment.status !== status) continue;
          
          // Filter by date if provided
          if (date && !assignment.scheduledDate.startsWith(date)) continue;
          
          assignments.push(assignment);
        }
      }

      console.log(`✅ Loaded ${assignments.length} sample collection assignments`);

      return sendSuccess(c, { assignments, total: assignments.length });

    } catch (error) {
      console.error('❌ Error loading sample collection assignments:', error);
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

      const assignment = await kv.get(`sample-collection:${assignmentId}`);
      if (!assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      if (assignment.vendorId !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Get new staff details
      const newStaff = await kv.get(`staff:${newStaffId}`);
      if (!newStaff || newStaff.vendorId !== vendorId) {
        return sendError(c, 'Invalid staff member', 400);
      }

      // Remove from old staff's list
      const oldStaffAssignments = await kv.get(`staff:${assignment.staffId}:sample-collections`) || [];
      const updatedOldStaffList = oldStaffAssignments.filter(id => id !== assignmentId);
      await kv.set(`staff:${assignment.staffId}:sample-collections`, updatedOldStaffList);

      // Add to new staff's list
      const newStaffAssignments = await kv.get(`staff:${newStaffId}:sample-collections`) || [];
      newStaffAssignments.unshift(assignmentId);
      await kv.set(`staff:${newStaffId}:sample-collections`, newStaffAssignments);

      // Update assignment
      assignment.staffId = newStaffId;
      assignment.staffName = newStaff.name;
      assignment.staffPhone = newStaff.phone;
      assignment.staffPhoto = newStaff.photo || '';
      assignment.reassignedAt = new Date().toISOString();
      assignment.reassignmentReason = reason;

      await kv.set(`sample-collection:${assignmentId}`, assignment);

      console.log(`✅ Sample collection reassigned to ${newStaff.name}`);

      return sendSuccess(c, { assignment, message: 'Reassigned successfully' });

    } catch (error) {
      console.error('❌ Error reassigning sample collection:', error);
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
      const { status, date } = c.req.query();

      console.log(`🏥 Loading sample collections for staff ${staffId}`);

      const assignmentIds = await kv.get(`staff:${staffId}:sample-collections`) || [];

      const assignments = [];
      for (const id of assignmentIds) {
        const assignment = await kv.get(`sample-collection:${id}`);
        if (assignment) {
          if (status && assignment.status !== status) continue;
          if (date && !assignment.scheduledDate.startsWith(date)) continue;
          assignments.push(assignment);
        }
      }

      // Sort by scheduled date/time
      assignments.sort((a, b) => 
        new Date(a.scheduledDateTime).getTime() - new Date(b.scheduledDateTime).getTime()
      );

      console.log(`✅ Loaded ${assignments.length} assignments`);

      return sendSuccess(c, { assignments, total: assignments.length });

    } catch (error) {
      console.error('❌ Error loading staff sample collections:', error);
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
      const {
        staffId,
        status,
        location,
        notes
      } = await c.req.json();

      const assignment = await kv.get(`sample-collection:${assignmentId}`);
      if (!assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      if (assignment.staffId !== staffId) {
        return sendError(c, 'Unauthorized: This assignment belongs to a different staff member', 403);
      }

      // Update status and timestamp
      assignment.status = status;
      
      if (status === 'in_transit') {
        assignment.departureTime = new Date().toISOString();
      } else if (status === 'arrived') {
        assignment.arrivalTime = new Date().toISOString();
      } else if (status === 'collecting') {
        assignment.collectionStartTime = new Date().toISOString();
      } else if (status === 'collected') {
        assignment.collectionEndTime = new Date().toISOString();
      } else if (status === 'completed') {
        assignment.completionTime = new Date().toISOString();
      }

      if (location) {
        assignment.currentLocation = location;
      }

      if (notes) {
        assignment.notes = (assignment.notes || '') + '\n' + notes;
      }

      assignment.updatedAt = new Date().toISOString();

      await kv.set(`sample-collection:${assignmentId}`, assignment);

      console.log(`✅ Sample collection status updated to: ${status}`);

      return sendSuccess(c, { assignment, message: 'Status updated successfully' });

    } catch (error) {
      console.error('❌ Error updating sample collection status:', error);
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

      const assignment = await kv.get(`sample-collection:${assignmentId}`);
      if (!assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      if (assignment.staffId !== staffId) {
        return sendError(c, 'Unauthorized', 403);
      }

      if (assignment.collectionOTP !== otp) {
        return sendError(c, 'Invalid OTP', 400);
      }

      if (assignment.otpVerified) {
        return sendError(c, 'OTP already verified', 400);
      }

      // Verify OTP
      assignment.otpVerified = true;
      assignment.otpVerifiedAt = new Date().toISOString();
      assignment.status = 'collecting';
      assignment.collectionStartTime = new Date().toISOString();

      await kv.set(`sample-collection:${assignmentId}`, assignment);

      console.log(`✅ OTP verified for sample collection ${assignmentId}`);

      return sendSuccess(c, {
        assignment,
        message: 'OTP verified successfully. You can now collect the sample.'
      });

    } catch (error) {
      console.error('❌ Error verifying OTP:', error);
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
        samplesCollected, // Array of { testName, sampleType, volume, barcode }
        sampleCondition,
        storageTemperature,
        notes,
        photos // Array of photo URLs
      } = await c.req.json();

      const assignment = await kv.get(`sample-collection:${assignmentId}`);
      if (!assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      if (assignment.staffId !== staffId) {
        return sendError(c, 'Unauthorized', 403);
      }

      if (!assignment.otpVerified) {
        return sendError(c, 'OTP must be verified before completing collection', 400);
      }

      // Complete the collection
      assignment.status = 'collected';
      assignment.samplesCollected = samplesCollected;
      assignment.sampleCondition = sampleCondition;
      assignment.storageTemperature = storageTemperature;
      assignment.collectionEndTime = new Date().toISOString();
      assignment.collectionNotes = notes;
      assignment.collectionPhotos = photos || [];

      await kv.set(`sample-collection:${assignmentId}`, assignment);

      // Update booking status
      const booking = await kv.get(`booking:${assignment.bookingId}`);
      if (booking) {
        booking.sampleCollectionStatus = 'collected';
        booking.sampleCollectedAt = new Date().toISOString();
        await kv.set(`booking:${assignment.bookingId}`, booking);
      }

      console.log(`✅ Sample collection completed: ${assignmentId}`);

      // TODO: Send notification to customer that sample has been collected

      return sendSuccess(c, {
        assignment,
        message: 'Sample collection completed successfully'
      });

    } catch (error) {
      console.error('❌ Error completing sample collection:', error);
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

      const assignment = await kv.get(`sample-collection:${assignmentId}`);
      if (!assignment) {
        return sendError(c, 'Assignment not found', 404);
      }

      assignment.status = 'completed';
      assignment.labReceivedAt = new Date().toISOString();
      assignment.labReceivedBy = receivedBy;
      assignment.labReceivedCondition = condition;
      assignment.labReceivedNotes = notes;
      assignment.completionTime = new Date().toISOString();

      await kv.set(`sample-collection:${assignmentId}`, assignment);

      // Update booking
      const booking = await kv.get(`booking:${assignment.bookingId}`);
      if (booking) {
        booking.sampleCollectionStatus = 'received_at_lab';
        booking.labReceivedAt = new Date().toISOString();
        await kv.set(`booking:${assignment.bookingId}`, booking);
      }

      console.log(`✅ Sample received at lab: ${assignmentId}`);

      return sendSuccess(c, {
        assignment,
        message: 'Sample marked as received at lab'
      });

    } catch (error) {
      console.error('❌ Error marking sample as received:', error);
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

      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (!booking.sampleCollectionAssignment) {
        return sendSuccess(c, {
          hasAssignment: false,
          message: 'No sample collection assignment yet'
        });
      }

      const assignment = await kv.get(`sample-collection:${booking.sampleCollectionAssignment}`);
      
      // Return limited info to customer (hide OTP)
      const customerInfo = {
        ...assignment,
        collectionOTP: undefined, // Don't send OTP to customer for security
        hasAssignment: true
      };

      return sendSuccess(c, { assignment: customerInfo });

    } catch (error) {
      console.error('❌ Error loading sample collection for customer:', error);
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
      const { startDate, endDate } = c.req.query();

      const assignmentIds = await kv.get(`vendor:${vendorId}:sample-collections`) || [];

      const stats = {
        total: 0,
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

      for (const id of assignmentIds) {
        const assignment = await kv.get(`sample-collection:${id}`);
        if (!assignment) continue;

        // Filter by date range if provided
        if (startDate && assignment.scheduledDate < startDate) continue;
        if (endDate && assignment.scheduledDate > endDate) continue;

        stats.total++;
        
        if (assignment.status === 'assigned') stats.assigned++;
        if (assignment.status === 'in_transit' || assignment.status === 'arrived') stats.inTransit++;
        if (assignment.status === 'completed') stats.completed++;
        if (assignment.status === 'cancelled') stats.cancelled++;

        // Calculate collection time
        if (assignment.collectionStartTime && assignment.collectionEndTime) {
          const duration = new Date(assignment.collectionEndTime).getTime() - 
                          new Date(assignment.collectionStartTime).getTime();
          totalCollectionTime += duration;
          completedCount++;

          // Check if on time (within scheduled time + 30 mins)
          const scheduledTime = new Date(assignment.scheduledDateTime).getTime();
          const actualStartTime = new Date(assignment.collectionStartTime).getTime();
          if (actualStartTime <= scheduledTime + (30 * 60 * 1000)) {
            onTimeCount++;
          }
        }
      }

      if (completedCount > 0) {
        stats.averageCollectionTime = Math.round(totalCollectionTime / completedCount / 60000); // minutes
        stats.onTimePercentage = Math.round((onTimeCount / completedCount) * 100);
      }

      return sendSuccess(c, { stats });

    } catch (error) {
      console.error('❌ Error getting sample collection stats:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Home Sample Collection Endpoints registered');
}
