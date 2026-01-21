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
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';

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
          user_id: actualCustomerId,
          user_type: 'customer',
          type: 'diagnostic_report_ready',
          title: '🔬 Diagnostic Report Ready',
          message: `Your ${testName} results for ${booking?.pet_name || 'your pet'} are now available.`,
          data: JSON.stringify({
            report_id: report.id,
            booking_id: bookingId,
            test_name: testName,
            report_url: reportUrl,
            action: 'view_report',
          }),
          is_read: false,
          requires_action: false,
          action_url: `/bookings/${bookingId}/reports/${report.id}`,
          created_at: new Date(),
        });
      }

      // Notify prescribing vet if this was ordered by a vet
      if (prescribingVetId) {
        await insert('notifications', {
          user_id: prescribingVetId,
          user_type: 'vendor',
          type: 'diagnostic_report_for_review',
          title: '📋 Diagnostic Report Available',
          message: `${testName} results for ${booking?.pet_name || 'patient'} (${booking?.customer_name || 'customer'}) are ready for review.`,
          data: JSON.stringify({
            report_id: report.id,
            booking_id: bookingId,
            original_booking_id: prescribingVetBookingId,
            test_name: testName,
            report_url: reportUrl,
            customer_name: booking?.customer_name,
            pet_name: booking?.pet_name,
            action: 'review_report',
            can_update_prescription: true,
          }),
          is_read: false,
          requires_action: true,
          action_url: `/appointments/${prescribingVetBookingId || bookingId}/review-report/${report.id}`,
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
          user_id: report.customer_id,
          user_type: 'customer',
          type: 'prescription_updated',
          title: '💊 Prescription Updated',
          message: `Your vet has reviewed the ${report.test_name} results and updated your prescription.`,
          data: JSON.stringify({
            report_id: reportId,
            booking_id: prescBookingId,
            action: 'view_prescription',
          }),
          is_read: false,
          action_url: `/bookings/${prescBookingId}`,
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
// HONO ROUTER SETUP
// ============================================================================

export function registerDiagnosticsReportEndpoints(app: Hono) {
  const uploadHandler = new UploadDiagnosticReportHandler();
  const reviewHandler = new VetReviewReportHandler();
  const getForBookingHandler = new GetReportsForBookingHandler();
  const getPendingHandler = new GetPendingReportsForVetHandler();

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
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
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
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
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
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
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
      requestContext: { requestId: crypto.randomUUID() },
    };
    const context = { requestId: crypto.randomUUID(), functionName: 'diagnostics-reports', functionVersion: '$LATEST' };
    const result = await getPendingHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
