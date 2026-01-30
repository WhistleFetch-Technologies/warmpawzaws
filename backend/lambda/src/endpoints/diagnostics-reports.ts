/**
 * ============================================================================
 * DIAGNOSTICS REPORTS ENDPOINTS
 * ============================================================================
 * 
 * Handles diagnostic report uploads and notifications
 * - Upload diagnostic reports (lab results, imaging, etc.)
 * - Link reports to bookings and medical records
 * - Notify customer when report is ready
 * - Notify prescribing vet for review
 * - Allow vet to update/add prescriptions based on results
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';

function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (val == null) return fallback;
  if (typeof val === 'string') {
    try { return JSON.parse(val) as T; } catch { return fallback; }
  }
  return val as T;
}

// ============================================================================
// TYPES
// ============================================================================

interface DiagnosticReport {
  id: string;
  bookingId: string;
  vendorId: string; // Diagnostics vendor
  customerId: string;
  petId: string;
  prescribingVetId?: string; // The vet who ordered the test
  prescribingVetBookingId?: string; // Original vet booking
  reportType: 'lab' | 'imaging' | 'pathology' | 'other';
  testName: string;
  reportUrl: string;
  summary?: string;
  findings?: string;
  status: 'pending' | 'ready' | 'reviewed' | 'requires_action';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// UPLOAD DIAGNOSTIC REPORT HANDLER
// ============================================================================

class UploadDiagnosticReportHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const {
      bookingId,
      vendorId,
      customerId,
      petId,
      prescribingVetId,
      prescribingVetBookingId,
      reportType,
      testName,
      reportUrl,
      summary,
      findings,
    } = body;

    if (!bookingId || !vendorId || !reportUrl || !testName) {
      return this.error('Missing required fields: bookingId, vendorId, reportUrl, testName', 400);
    }

    try {
      // Get booking details to find customer and pet
      const { rows: bookings } = await query(
        `SELECT 
          b.id, b.customer_id, b.pet_id, b.customer_phone,
          c.full_name as customer_name,
          p.name as pet_name
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN pets p ON p.id = b.pet_id
        WHERE b.id = $1`,
        [bookingId]
      );

      const booking = bookings.length > 0 ? bookings[0] : null;
      const actualCustomerId = customerId || booking?.customer_id;
      const actualPetId = petId || booking?.pet_id;

      // Create the diagnostic report
      const [report] = await insert('diagnostic_reports', {
        booking_id: bookingId,
        vendor_id: vendorId,
        customer_id: actualCustomerId,
        pet_id: actualPetId,
        prescribing_vet_id: prescribingVetId || null,
        prescribing_vet_booking_id: prescribingVetBookingId || null,
        report_type: reportType || 'lab',
        test_name: testName,
        report_url: reportUrl,
        summary: summary || null,
        findings: findings || null,
        status: 'ready',
        created_at: new Date(),
        updated_at: new Date(),
      });

      // Create medical record entry
      await insert('medical_records', {
        pet_id: actualPetId,
        customer_id: actualCustomerId,
        booking_id: bookingId,
        record_type: 'diagnostic_report',
        title: `${testName} Report`,
        description: summary || `Diagnostic report for ${testName}`,
        document_url: reportUrl,
        vendor_id: vendorId,
        created_by: vendorId,
        created_at: new Date(),
      }).catch(() => {
        // Table might not exist
      });

      // Notify customer
      if (actualCustomerId) {
        await insert('notifications', {
          recipient_id: actualCustomerId,
          recipient_type: 'customer',
          notification_type: 'diagnostic_report_ready',
          channels: { email: true, sms: true, inApp: true, push: false },
          title: '🔬 Diagnostic Report Ready',
          message: `Your ${testName} results for ${booking?.pet_name || 'your pet'} are now available.`,
          is_read: false,
          created_at: new Date(),
        });
      }

      // Notify prescribing vet if this was ordered by a vet
      if (prescribingVetId) {
        await insert('notifications', {
          recipient_id: prescribingVetId,
          recipient_type: 'vendor',
          notification_type: 'diagnostic_report_for_review',
          channels: { email: true, sms: true, inApp: true, push: false },
          title: '📋 Diagnostic Report Available',
          message: `${testName} results for ${booking?.pet_name || 'patient'} (${booking?.customer_name || 'customer'}) are ready for review.`,
          is_read: false,
          created_at: new Date(),
        });

        // Also update the original vet booking to show report is available
        if (prescribingVetBookingId) {
          await query(
            `UPDATE bookings 
             SET has_pending_reports = true,
                 pending_report_ids = COALESCE(pending_report_ids, '[]'::jsonb) || $1::jsonb,
                 updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify([report.id]), prescribingVetBookingId]
          ).catch(() => {});
        }
      }

      return this.success({
        success: true,
        reportId: report.id,
        report: {
          id: report.id,
          bookingId,
          testName,
          reportUrl,
          status: 'ready',
          notifiedCustomer: !!actualCustomerId,
          notifiedVet: !!prescribingVetId,
        },
        message: 'Diagnostic report uploaded successfully',
      });
    } catch (error: any) {
      console.error('Error uploading diagnostic report:', error);
      return this.error(error.message || 'Failed to upload report', 500);
    }
  }
}

// ============================================================================
// VET REVIEW REPORT HANDLER
// ============================================================================

class VetReviewReportHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const reportId = context.event.pathParameters?.reportId;
    const body = this.parseBody(context.event);
    const { 
      vetId, 
      reviewNotes, 
      status, 
      updatePrescription,
      newPrescription,
    } = body;

    if (!reportId || !vetId) {
      return this.error('Report ID and Vet ID are required', 400);
    }

    try {
      // Get report
      const reports = await select('diagnostic_reports', { id: reportId });
      if (reports.length === 0) {
        return this.error('Report not found', 404);
      }

      const report = reports[0];

      // Update report with review
      await update('diagnostic_reports', { id: reportId }, {
        status: status || 'reviewed',
        reviewed_by: vetId,
        reviewed_at: new Date(),
        review_notes: reviewNotes || null,
        updated_at: new Date(),
      });

      // If vet wants to update/create prescription based on results
      if (updatePrescription && newPrescription) {
        const prescBookingId = report.prescribing_vet_booking_id || report.booking_id;
        
        await insert('prescriptions', {
          booking_id: prescBookingId,
          vendor_id: vetId,
          pet_id: report.pet_id,
          customer_id: report.customer_id,
          diagnosis: newPrescription.diagnosis || 'Based on diagnostic results',
          symptoms: newPrescription.symptoms || '',
          prescription: newPrescription.prescription || '',
          medications: JSON.stringify(newPrescription.medications || []),
          notes: newPrescription.notes || `Updated based on ${report.test_name} results`,
          follow_up_date: newPrescription.followUpDate || null,
          linked_report_id: reportId,
          created_at: new Date(),
        });

        // Notify customer about updated prescription
        await insert('notifications', {
          recipient_id: report.customer_id,
          recipient_type: 'customer',
          notification_type: 'prescription_updated',
          channels: { email: true, sms: true, inApp: true, push: false },
          title: '💊 Prescription Updated',
          message: `Your vet has reviewed the ${report.test_name} results and updated your prescription.`,
          is_read: false,
          created_at: new Date(),
        });
      }

      // Clear pending report flag on original booking
      if (report.prescribing_vet_booking_id) {
        await query(
          `UPDATE bookings 
           SET pending_report_ids = COALESCE(pending_report_ids, '[]'::jsonb) - $1,
               has_pending_reports = CASE 
                 WHEN jsonb_array_length(COALESCE(pending_report_ids, '[]'::jsonb) - $1) > 0 THEN true 
                 ELSE false 
               END,
               updated_at = NOW()
           WHERE id = $2`,
          [reportId, report.prescribing_vet_booking_id]
        ).catch(() => {});
      }

      return this.success({
        success: true,
        reportId,
        status: status || 'reviewed',
        prescriptionUpdated: !!updatePrescription,
        message: 'Report reviewed successfully',
      });
    } catch (error: any) {
      console.error('Error reviewing report:', error);
      return this.error(error.message || 'Failed to review report', 500);
    }
  }
}

// ============================================================================
// GET REPORTS FOR BOOKING HANDLER
// ============================================================================

class GetReportsForBookingHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const { rows: reports } = await query(
        `SELECT 
          dr.*,
          v.business_name as vendor_name,
          rv.business_name as reviewing_vet_name
        FROM diagnostic_reports dr
        LEFT JOIN vendors v ON v.id = dr.vendor_id
        LEFT JOIN vendors rv ON rv.id = dr.reviewed_by
        WHERE dr.booking_id = $1 OR dr.prescribing_vet_booking_id = $1
        ORDER BY dr.created_at DESC`,
        [bookingId]
      );

      return this.success({
        success: true,
        reports: reports.map(r => ({
          id: r.id,
          bookingId: r.booking_id,
          vendorId: r.vendor_id,
          vendorName: r.vendor_name,
          testName: r.test_name,
          reportType: r.report_type,
          reportUrl: r.report_url,
          summary: r.summary,
          findings: r.findings,
          status: r.status,
          reviewedBy: r.reviewed_by,
          reviewedByName: r.reviewing_vet_name,
          reviewedAt: r.reviewed_at,
          reviewNotes: r.review_notes,
          createdAt: r.created_at,
        })),
        count: reports.length,
      });
    } catch (error: any) {
      console.error('Error getting reports:', error);
      return this.error(error.message || 'Failed to get reports', 500);
    }
  }
}

// ============================================================================
// GET PENDING REPORTS FOR VET HANDLER
// ============================================================================

class GetPendingReportsForVetHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const vetId = context.event.pathParameters?.vetId;

    if (!vetId) {
      return this.error('Vet ID is required', 400);
    }

    try {
      const { rows: reports } = await query(
        `SELECT 
          dr.*,
          v.business_name as diagnostics_vendor_name,
          c.full_name as customer_name,
          p.name as pet_name,
          p.species as pet_type
        FROM diagnostic_reports dr
        LEFT JOIN vendors v ON v.id = dr.vendor_id
        LEFT JOIN customers c ON c.id = dr.customer_id
        LEFT JOIN pets p ON p.id = dr.pet_id
        WHERE dr.prescribing_vet_id = $1 
          AND dr.status IN ('ready', 'requires_action')
          AND dr.reviewed_by IS NULL
        ORDER BY dr.created_at DESC`,
        [vetId]
      );

      return this.success({
        success: true,
        reports: reports.map(r => ({
          id: r.id,
          bookingId: r.booking_id,
          originalBookingId: r.prescribing_vet_booking_id,
          testName: r.test_name,
          reportType: r.report_type,
          reportUrl: r.report_url,
          summary: r.summary,
          status: r.status,
          diagnosticsVendorName: r.diagnostics_vendor_name,
          customerName: r.customer_name,
          petName: r.pet_name,
          petType: r.pet_type,
          createdAt: r.created_at,
        })),
        count: reports.length,
      });
    } catch (error: any) {
      console.error('Error getting pending reports:', error);
      return this.error(error.message || 'Failed to get pending reports', 500);
    }
  }
}

// ============================================================================
// SAMPLE COLLECTION ASSIGNMENT HANDLERS (GAP FIX)
// ============================================================================
// Addresses Rule 8: Lab test sample collection with notifications
// - Assign staff for home sample collection
// - Notify customer who is coming and when
// - Track status changes with notifications
// ============================================================================

class AssignSampleCollectionHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const {
      bookingId,
      diagnosticBookingId,
      vendorId,
      staffId,
      customerId,
      customerName,
      customerPhone,
      customerAddress,
      petId,
      petName,
      diagnosticTests,
      scheduledDate,
      scheduledTime,
      estimatedDuration,
    } = body;

    if (!bookingId || !vendorId || !staffId || !customerId) {
      return this.error('Missing required fields: bookingId, vendorId, staffId, customerId', 400);
    }

    try {
      // Get staff details for notification
      const { rows: staffRows } = await query(
        `SELECT s.id, s.name, s.phone, s.photo_url 
         FROM staff s WHERE s.id = $1`,
        [staffId]
      );
      const staff = staffRows[0];
      
      if (!staff) {
        return this.error('Staff not found', 404);
      }

      // Generate assignment ID
      const assignmentId = `SAMPLE-COLLECT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Generate OTP for collection
      const collectionOtp = Math.floor(1000 + Math.random() * 9000).toString();

      // Calculate scheduled datetime
      const scheduledDatetime = new Date(`${scheduledDate}T${scheduledTime}`);

      // Create assignment
      const [assignment] = await insert('sample_collection_assignments', {
        assignment_id: assignmentId,
        booking_id: bookingId,
        diagnostic_booking_id: diagnosticBookingId || null,
        vendor_id: vendorId,
        staff_id: staffId,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_address: JSON.stringify(customerAddress),
        pet_id: petId || null,
        pet_name: petName || null,
        diagnostic_tests: JSON.stringify(diagnosticTests || []),
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        scheduled_datetime: scheduledDatetime,
        estimated_duration: estimatedDuration || 30,
        status: 'assigned',
        collection_otp: collectionOtp,
        staff_name: staff.name,
        staff_phone: staff.phone,
        staff_photo_url: staff.photo_url,
        customer_notified_assigned: true,
        customer_notified_assigned_at: new Date(),
      });

      // Send notification to customer about staff assignment
      // GAP FIX: This notification includes WHO is coming
      await insert('notifications', {
        recipient_id: customerId,
        recipient_type: 'customer',
        notification_type: 'sample_collection_assigned',
        channels: { email: true, sms: true, inApp: true, push: false },
        title: '🧪 Sample Collection Scheduled',
        message: `${staff.name} will collect your samples on ${scheduledDate} at ${scheduledTime}`,
        is_read: false,
        created_at: new Date(),
      });

      // Also send SMS if phone available (placeholder - would use SNS)
      console.log(`📱 [SMS] Would send to ${customerPhone}: Sample collection by ${staff.name} scheduled for ${scheduledDate} at ${scheduledTime}. OTP: ${collectionOtp}`);

      return this.success({
        success: true,
        assignmentId: assignment.id,
        assignment: {
          id: assignment.id,
          assignmentId,
          bookingId,
          staffId,
          staffName: staff.name,
          staffPhone: staff.phone,
          scheduledDate,
          scheduledTime,
          otp: collectionOtp,
          status: 'assigned',
        },
        message: 'Sample collection assigned successfully',
      });
    } catch (error: any) {
      console.error('Error assigning sample collection:', error);
      return this.error(error.message || 'Failed to assign sample collection', 500);
    }
  }
}

/**
 * Assign ADHOC home sample collection agent (no staff login required)
 * Vendor provides agent name, phone, scheduled date/time
 * Customer is notified with agent details
 */
class AssignAdhocSampleCollectionHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);
    const {
      bookingId,
      vendorId,
      agentName,
      agentPhone,
      scheduledDate,
      scheduledTime,
      notes,
    } = body;

    if (!bookingId || !vendorId || !agentName || !agentPhone || !scheduledDate || !scheduledTime) {
      return this.error('Missing required fields: bookingId, vendorId, agentName, agentPhone, scheduledDate, scheduledTime', 400);
    }

    try {
      const { rows: bookings } = await query(
        `SELECT b.id, b.customer_id, b.address, b.notes,
          c.full_name as customer_name, c.phone as customer_phone,
          p.id as pet_id, p.name as pet_name
        FROM bookings b
        LEFT JOIN customers c ON c.id = b.customer_id
        LEFT JOIN pets p ON p.id = b.pet_id
        WHERE b.id = $1 AND b.vendor_id = $2`,
        [bookingId, vendorId]
      );
      const booking = bookings[0];
      if (!booking) {
        return this.error('Booking not found', 404);
      }

      let notesData: { tests?: any[] } = {};
      try {
        notesData = typeof booking.notes === 'string' ? JSON.parse(booking.notes || '{}') : (booking.notes || {});
      } catch (_) {}

      const assignmentId = `SAMPLE-COLLECT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const collectionOtp = Math.floor(1000 + Math.random() * 9000).toString();
      const scheduledDatetime = new Date(`${scheduledDate}T${scheduledTime}`);

      const customerAddress = typeof booking.address === 'string' 
        ? (() => { try { return JSON.parse(booking.address); } catch { return { address: booking.address }; } })()
        : (booking.address || {});

      const [assignment] = await insert('sample_collection_assignments', {
        assignment_id: assignmentId,
        booking_id: bookingId,
        diagnostic_booking_id: null,
        vendor_id: vendorId,
        staff_id: null,
        agent_name: agentName,
        agent_phone: agentPhone,
        staff_name: agentName,
        staff_phone: agentPhone,
        customer_id: booking.customer_id,
        customer_name: booking.customer_name || 'Customer',
        customer_phone: booking.customer_phone || '',
        customer_address: JSON.stringify(customerAddress),
        pet_id: booking.pet_id || null,
        pet_name: booking.pet_name || null,
        diagnostic_tests: JSON.stringify(notesData.tests || []),
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        scheduled_datetime: scheduledDatetime,
        estimated_duration: 30,
        status: 'assigned',
        collection_otp: collectionOtp,
        notes: notes || null,
        customer_notified_assigned: true,
        customer_notified_assigned_at: new Date(),
      });

      await insert('notifications', {
        recipient_id: booking.customer_id,
        recipient_type: 'customer',
        notification_type: 'sample_collection_assigned',
        channels: { email: true, sms: true, inApp: true, push: false },
        title: '🧪 Sample Collection Scheduled',
        message: `${agentName} will collect your samples on ${scheduledDate} at ${scheduledTime}. Contact: ${agentPhone}`,
        is_read: false,
        created_at: new Date(),
      });

      return this.success({
        success: true,
        assignmentId: assignment.id,
        assignment: {
          id: assignment.id,
          assignmentId,
          bookingId,
          agentName,
          agentPhone,
          scheduledDate,
          scheduledTime,
          otp: collectionOtp,
          status: 'assigned',
        },
        message: 'Adhoc sample collection agent assigned. Customer notified.',
      });
    } catch (error: any) {
      console.error('Error assigning adhoc sample collection:', error);
      return this.error(error.message || 'Failed to assign', 500);
    }
  }
}

class UpdateSampleCollectionStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const assignmentId = context.event.pathParameters?.assignmentId;
    const body = this.parseBody(context.event);
    const { status, currentLocation, estimatedArrivalTime, notes } = body;

    if (!assignmentId) {
      return this.error('Assignment ID is required', 400);
    }

    const validStatuses = ['assigned', 'in_transit', 'arrived', 'collecting', 'collected', 'returning', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return this.error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    try {
      // Get assignment
      const assignments = await select('sample_collection_assignments', { id: assignmentId });
      if (assignments.length === 0) {
        return this.error('Assignment not found', 404);
      }
      const assignment = assignments[0];

      // Build update object
      const updateData: any = {
        status,
        updated_at: new Date(),
      };

      // Add status-specific timestamps
      if (status === 'in_transit') {
        updateData.departure_time = new Date();
        if (estimatedArrivalTime) {
          updateData.estimated_arrival_time = new Date(estimatedArrivalTime);
        }
      } else if (status === 'arrived') {
        updateData.arrival_time = new Date();
      } else if (status === 'collecting') {
        updateData.collection_start_time = new Date();
      } else if (status === 'collected') {
        updateData.collection_completed_time = new Date();
      } else if (status === 'completed') {
        updateData.completion_time = new Date();
      }

      if (currentLocation) {
        updateData.current_location = JSON.stringify(currentLocation);
        // Append to route history
        const existingRoute = assignment.route ? JSON.parse(assignment.route) : [];
        existingRoute.push({
          ...currentLocation,
          timestamp: new Date().toISOString(),
          status,
        });
        updateData.route = JSON.stringify(existingRoute);
      }

      if (notes) {
        updateData.notes = notes;
      }

      // Determine which notification to send
      let notificationType = null;
      let notificationTitle = '';
      let notificationMessage = '';

      if (status === 'in_transit' && !assignment.customer_notified_on_way) {
        notificationType = 'sample_collection_on_way';
        notificationTitle = '🚗 Sample Collector On The Way';
        notificationMessage = `${assignment.staff_name} is on the way to collect your samples. ETA: ${estimatedArrivalTime ? new Date(estimatedArrivalTime).toLocaleTimeString() : 'shortly'}`;
        updateData.customer_notified_on_way = true;
        updateData.customer_notified_on_way_at = new Date();
      } else if (status === 'arrived' && !assignment.customer_notified_arrived) {
        notificationType = 'sample_collection_arrived';
        notificationTitle = '📍 Sample Collector Arrived';
        notificationMessage = `${assignment.staff_name} has arrived at your location. Please share OTP: ${assignment.collection_otp}`;
        updateData.customer_notified_arrived = true;
        updateData.customer_notified_arrived_at = new Date();
      } else if (status === 'collected' && !assignment.customer_notified_collected) {
        notificationType = 'sample_collection_completed';
        notificationTitle = '✅ Samples Collected';
        notificationMessage = `Your samples have been collected successfully. Results will be available soon.`;
        updateData.customer_notified_collected = true;
        updateData.customer_notified_collected_at = new Date();
      }

      // Update assignment
      await update('sample_collection_assignments', { id: assignmentId }, updateData);

      // Send notification if needed
      if (notificationType) {
        await insert('notifications', {
          recipient_id: assignment.customer_id,
          recipient_type: 'customer',
          notification_type: notificationType,
          channels: { email: true, sms: true, inApp: true, push: false },
          title: notificationTitle,
          message: notificationMessage,
          is_read: false,
          created_at: new Date(),
        });
      }

      return this.success({
        success: true,
        assignmentId,
        status,
        notificationSent: !!notificationType,
        message: `Sample collection status updated to ${status}`,
      });
    } catch (error: any) {
      console.error('Error updating sample collection status:', error);
      return this.error(error.message || 'Failed to update status', 500);
    }
  }
}

class GetSampleCollectionStatusHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const bookingId = context.event.pathParameters?.bookingId;

    if (!bookingId) {
      return this.error('Booking ID is required', 400);
    }

    try {
      const { rows: assignments } = await query(
        `SELECT 
          sca.*,
          s.name as staff_display_name,
          s.phone as staff_display_phone,
          s.photo_url as staff_display_photo
        FROM sample_collection_assignments sca
        LEFT JOIN staff s ON s.id = sca.staff_id
        WHERE sca.booking_id = $1
        ORDER BY sca.created_at DESC
        LIMIT 1`,
        [bookingId]
      );

      if (assignments.length === 0) {
        return this.success({
          success: true,
          hasAssignment: false,
          assignment: null,
        });
      }

      const a = assignments[0];
      const agentOrStaffName = a.staff_name || a.agent_name || a.staff_display_name;
      const agentOrStaffPhone = a.staff_phone || a.agent_phone || a.staff_display_phone;
      return this.success({
        success: true,
        hasAssignment: true,
        assignment: {
          id: a.id,
          assignmentId: a.assignment_id,
          bookingId: a.booking_id,
          status: a.status,
          staffId: a.staff_id,
          staffName: agentOrStaffName,
          staffPhone: agentOrStaffPhone,
          agentName: a.agent_name,
          agentPhone: a.agent_phone,
          staffPhoto: a.staff_photo_url || a.staff_display_photo,
          scheduledDate: a.scheduled_date,
          scheduledTime: a.scheduled_time,
          scheduledDatetime: a.scheduled_datetime,
          estimatedArrivalTime: a.estimated_arrival_time,
          currentLocation: safeJsonParse(a.current_location, null),
          diagnosticTests: safeJsonParse(a.diagnostic_tests, []),
          otp: a.collection_otp,
          otpVerified: a.otp_verified,
          departureTime: a.departure_time,
          arrivalTime: a.arrival_time,
          collectionStartTime: a.collection_start_time,
          collectionCompletedTime: a.collection_completed_time,
          completionTime: a.completion_time,
        },
      });
    } catch (error: any) {
      console.error('Error getting sample collection status:', error);
      return this.error(error.message || 'Failed to get status', 500);
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerDiagnosticsReportEndpoints(app: Hono) {
  const uploadHandler = new UploadDiagnosticReportHandler();
  const reviewHandler = new VetReviewReportHandler();
  const getForBookingHandler = new GetReportsForBookingHandler();
  const getPendingHandler = new GetPendingReportsForVetHandler();
  
  // GAP FIX: Sample collection handlers
  const assignSampleHandler = new AssignSampleCollectionHandler();
  const assignAdhocHandler = new AssignAdhocSampleCollectionHandler();
  const updateSampleStatusHandler = new UpdateSampleCollectionStatusHandler();
  const getSampleStatusHandler = new GetSampleCollectionStatusHandler();

  // ============================================
  // SAMPLE COLLECTION ENDPOINTS (GAP FIX)
  // ============================================
  
  // Assign adhoc agent for home sample collection (no login required)
  app.post('/diagnostics/sample-collection/assign-adhoc', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/diagnostics/sample-collection/assign-adhoc',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
    const result = await assignAdhocHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Assign staff for sample collection
  app.post('/diagnostics/sample-collection/assign', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/diagnostics/sample-collection/assign',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
    const result = await assignSampleHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Update sample collection status (with notifications)
  app.put('/diagnostics/sample-collection/:assignmentId/status', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'PUT',
      path: `/diagnostics/sample-collection/${c.req.param('assignmentId')}/status`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { assignmentId: c.req.param('assignmentId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
    const result = await updateSampleStatusHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get sample collection status for booking (customer view)
  app.get('/diagnostics/sample-collection/booking/:bookingId', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/diagnostics/sample-collection/booking/${c.req.param('bookingId')}`,
      headers: {},
      body: '',
      pathParameters: { bookingId: c.req.param('bookingId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
    const result = await getSampleStatusHandler.execute(event, context);
    const body = typeof result.body === 'string' ? (() => { try { return JSON.parse(result.body); } catch { return { success: false, error: 'Invalid response' }; } })() : result.body;
    return c.json(body, result.statusCode);
  });

  // ============================================
  // DIAGNOSTIC REPORT ENDPOINTS
  // ============================================

  // Upload diagnostic report
  app.post('/diagnostics/reports/upload', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: '/diagnostics/reports/upload',
      headers: {},
      body: JSON.stringify(body),
      pathParameters: {},
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
    const result = await uploadHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Vet review report
  app.post('/diagnostics/reports/:reportId/review', async (c) => {
    const body = await c.req.json();
    const event = {
      httpMethod: 'POST',
      path: `/diagnostics/reports/${c.req.param('reportId')}/review`,
      headers: {},
      body: JSON.stringify(body),
      pathParameters: { reportId: c.req.param('reportId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
    const result = await reviewHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get reports for booking
  app.get('/diagnostics/reports/booking/:bookingId', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/diagnostics/reports/booking/${c.req.param('bookingId')}`,
      headers: {},
      body: '',
      pathParameters: { bookingId: c.req.param('bookingId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
    const result = await getForBookingHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // Get pending reports for vet
  app.get('/diagnostics/reports/vet/:vetId/pending', async (c) => {
    const event = {
      httpMethod: 'GET',
      path: `/diagnostics/reports/vet/${c.req.param('vetId')}/pending`,
      headers: {},
      body: '',
      pathParameters: { vetId: c.req.param('vetId') },
      queryStringParameters: {},
      requestContext: { requestId: randomUUID() },
    };
    const context = { requestId: randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
    const result = await getPendingHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  // ============================================
  // SHARE REPORT WITH VET ENDPOINT
  // ============================================
  app.post('/diagnostics/reports/share', async (c) => {
    try {
      const body = await c.req.json();
      const { reportId, bookingId, customerPhone } = body;

      if (!reportId || !bookingId) {
        return c.json({ success: false, error: 'reportId and bookingId are required' }, 400);
      }

      // Get the report details
      const reports = await select('diagnostic_reports', { id: reportId });
      if (reports.length === 0) {
        return c.json({ success: false, error: 'Report not found' }, 404);
      }

      const report = reports[0];

      // Get the vet booking to find the vet
      const { rows: bookings } = await query(
        `SELECT b.*, v.business_name as vet_name FROM bookings b 
         LEFT JOIN vendors v ON v.id = b.vendor_id 
         WHERE b.id = $1`,
        [bookingId]
      );

      if (bookings.length === 0) {
        return c.json({ success: false, error: 'Booking not found' }, 404);
      }

      const vetBooking = bookings[0];

      // Create notification for the vet
      await insert('notifications', {
        recipient_id: vetBooking.vendor_id,
        recipient_type: 'vendor',
        notification_type: 'diagnostic_report_shared',
        channels: { email: true, sms: true, inApp: true, push: false },
        title: '📋 Diagnostic Report Shared',
        message: `A patient has shared their ${report.test_name} report with you for review.`,
        is_read: false,
        created_at: new Date(),
      });

      // Also add a chat message notification
      await insert('notifications', {
        recipient_id: vetBooking.vendor_id,
        recipient_type: 'vendor',
        notification_type: 'chat_message',
        channels: { email: true, sms: true, inApp: true, push: false },
        title: 'New Message',
        message: `Patient shared a diagnostic report: ${report.test_name}`,
        is_read: false,
        created_at: new Date(),
      });

      // Create actual chat message in vet's booking thread so vet sees it in chat
      try {
        await insert('chat_messages', {
          booking_id: bookingId,
          sender_phone: customerPhone || 'customer',
          sender_type: 'customer',
          message: `Patient shared a diagnostic report: ${report.test_name}. View: ${report.report_url}`,
          message_type: 'text',
          is_read: false,
        });
      } catch (chatErr) {
        console.warn('Could not create chat message for shared report:', chatErr);
      }

      return c.json({
        success: true,
        message: 'Report shared with vet successfully',
        sharedWith: {
          vetName: vetBooking.vet_name,
          bookingId: bookingId,
        }
      });
    } catch (error: any) {
      console.error('Error sharing report:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });

  // ============================================
  // VERIFY SAMPLE COLLECTION OTP ENDPOINT
  // ============================================
  app.post('/diagnostics/sample-collection/:bookingId/verify-otp', async (c) => {
    try {
      const bookingId = c.req.param('bookingId');
      const body = await c.req.json();
      const { otp } = body;

      if (!otp) {
        return c.json({ success: false, error: 'OTP is required' }, 400);
      }

      // Find the sample collection assignment for this booking
      const assignments = await select('sample_collection_assignments', { booking_id: bookingId });
      
      if (assignments.length === 0) {
        return c.json({ success: false, error: 'Sample collection not found for this booking' }, 404);
      }

      const assignment = assignments[0];

      // Verify OTP
      if (assignment.collection_otp !== otp) {
        return c.json({ success: false, error: 'Invalid OTP' }, 400);
      }

      // Update assignment status to collected
      await update('sample_collection_assignments', { id: assignment.id }, {
        status: 'completed',
        otp_verified: true,
        otp_verified_at: new Date(),
        updated_at: new Date(),
      });

      // Update booking status
      await update('bookings', { id: bookingId }, {
        status: 'sample_collected',
        updated_at: new Date(),
      });

      // Notify customer
      if (assignment.customer_id) {
        await insert('notifications', {
          recipient_id: assignment.customer_id,
          recipient_type: 'customer',
          notification_type: 'sample_collection_complete',
          channels: { email: true, sms: true, inApp: true, push: false },
          title: '✅ Sample Collection Complete',
          message: 'Your sample has been collected successfully. Reports will be available within 24-48 hours.',
          is_read: false,
          created_at: new Date(),
        });
      }

      return c.json({
        success: true,
        message: 'OTP verified and sample collection completed',
        status: 'completed'
      });
    } catch (error: any) {
      console.error('Error verifying sample collection OTP:', error);
      return c.json({ success: false, error: error.message }, 500);
    }
  });
}
