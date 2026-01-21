/**
 * ============================================================================
 * MEDICAL RECORDS ENDPOINTS
 * ============================================================================
 * 
 * Handles pet medical records:
 * - Upload prescriptions
 * - Upload diagnostic reports
 * - View medical history
 * - Share records between vets
 * 
 * Fixes GAPs:
 * - PG-2: Report Upload to Medical Records
 * - PG-3: Prescribing Vet Access to Diagnostics Report
 * - TV-5: Prescription to Medical History
 * - CC-5: Medical Records in History
 * 
 * Date: 2026-01-21
 * ============================================================================
 */

import { Hono } from 'hono';
import { query, select, insert, update } from '../database/rds-connection';
import { uploadToS3, generateS3Key } from '../utils/aws-clients';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type RecordType = 
  | 'prescription'
  | 'diagnostic_report'
  | 'lab_result'
  | 'vaccination'
  | 'consultation_notes'
  | 'surgery_notes'
  | 'diet_plan'
  | 'imaging' // X-ray, ultrasound, etc.
  | 'other';

export interface MedicalRecord {
  id: string;
  petId: string;
  customerId: string;
  vendorId?: string;
  staffId?: string;
  bookingId?: string;
  recordType: RecordType;
  title: string;
  description?: string;
  fileUrl?: string;
  contentData?: any; // Structured data (e.g., prescription details)
  prescribedBy?: string;
  prescribedByName?: string;
  referredFromBookingId?: string; // For diagnostics referrals
  createdAt: string;
}

// ============================================================================
// ENDPOINTS
// ============================================================================

export function registerMedicalRecordsEndpoints(app: Hono) {
  
  /**
   * GET /medical-records/pet/:petId
   * Get all medical records for a pet
   * Fixes GAP: CC-5 - Medical Records in History
   */
  app.get("/medical-records/pet/:petId", async (c) => {
    try {
      const { petId } = c.req.param();
      const recordType = c.req.query('type');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');

      let queryText = `
        SELECT mr.*, 
               v.business_name as vendor_name,
               s.name as staff_name,
               p.name as pet_name
        FROM medical_records mr
        LEFT JOIN vendors v ON mr.vendor_id = v.id
        LEFT JOIN staff s ON mr.staff_id = s.id
        LEFT JOIN pets p ON mr.pet_id = p.id
        WHERE mr.pet_id = $1
      `;
      const params: any[] = [petId];
      let paramIndex = 2;

      if (recordType) {
        queryText += ` AND mr.record_type = $${paramIndex}`;
        params.push(recordType);
        paramIndex++;
      }

      queryText += ` ORDER BY mr.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await query(queryText, params);

      return c.json({
        success: true,
        records: (result as any).rows || [],
        total: (result as any).rows?.length || 0,
      });

    } catch (error: any) {
      console.error('Error fetching medical records:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /medical-records/booking/:bookingId
   * Get medical records for a specific booking
   */
  app.get("/medical-records/booking/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();

      // Get booking details
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Get records for this booking
      const records = await query(
        `SELECT mr.*, 
                v.business_name as vendor_name,
                s.name as staff_name
         FROM medical_records mr
         LEFT JOIN vendors v ON mr.vendor_id = v.id
         LEFT JOIN staff s ON mr.staff_id = s.id
         WHERE mr.booking_id = $1
         ORDER BY mr.created_at DESC`,
        [bookingId]
      );

      // Also get records from referral chain (diagnostics reports)
      const referralRecords = await query(
        `SELECT mr.*, 
                v.business_name as vendor_name,
                s.name as staff_name
         FROM medical_records mr
         LEFT JOIN vendors v ON mr.vendor_id = v.id
         LEFT JOIN staff s ON mr.staff_id = s.id
         WHERE mr.referred_from_booking_id = $1
         ORDER BY mr.created_at DESC`,
        [bookingId]
      );

      return c.json({
        success: true,
        booking: {
          id: booking.id,
          serviceName: booking.service_name,
          date: booking.booking_date,
          status: booking.status,
        },
        records: (records as any).rows || [],
        referralRecords: (referralRecords as any).rows || [],
      });

    } catch (error: any) {
      console.error('Error fetching booking records:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /medical-records/prescription
   * Upload a prescription
   * Fixes GAP: TV-5 - Prescription to Medical History
   */
  app.post("/medical-records/prescription", async (c) => {
    try {
      const body = await c.req.json();
      const {
        petId,
        customerId,
        vendorId,
        staffId,
        bookingId,
        medications, // Array of { name, dosage, frequency, duration, instructions }
        diagnosis,
        notes,
        followUpDate,
      } = body;

      if (!petId || !bookingId) {
        return c.json({ error: 'petId and bookingId are required' }, 400);
      }

      // Get prescriber name
      let prescriberName = 'Doctor';
      if (staffId) {
        const staff = await select('staff', { id: staffId });
        prescriberName = staff[0]?.name || 'Doctor';
      } else if (vendorId) {
        const vendors = await select('vendors', { id: vendorId });
        prescriberName = vendors[0]?.business_name || 'Doctor';
      }

      // Create prescription record
      const record = await insert('medical_records', {
        pet_id: petId,
        customer_id: customerId,
        vendor_id: vendorId,
        staff_id: staffId,
        booking_id: bookingId,
        record_type: 'prescription',
        title: `Prescription - ${new Date().toLocaleDateString()}`,
        description: diagnosis || notes,
        content_data: JSON.stringify({
          medications,
          diagnosis,
          notes,
          followUpDate,
        }),
        prescribed_by: staffId || vendorId,
        prescribed_by_name: prescriberName,
        created_at: new Date().toISOString(),
      });

      // Send notification to customer
      try {
        const { sendEventNotification } = await import('../lib/services/push-notification-service');
        
        // Get pet name
        const pets = await select('pets', { id: petId });
        const petName = pets[0]?.name || 'your pet';

        await sendEventNotification({
          eventType: 'prescription_uploaded',
          recipientId: customerId,
          recipientType: 'customer',
          relatedId: bookingId,
          data: {
            bookingId,
            petName,
            vendorName: prescriberName,
            recordId: record[0]?.id,
          },
        });
      } catch (notifError) {
        console.warn('Failed to send prescription notification:', notifError);
      }

      return c.json({
        success: true,
        record: record[0],
        message: 'Prescription uploaded successfully',
      });

    } catch (error: any) {
      console.error('Error uploading prescription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /medical-records/diagnostic-report
   * Upload a diagnostic report (lab results, imaging, etc.)
   * Fixes GAP: PG-2 - Report Upload to Medical Records
   */
  app.post("/medical-records/diagnostic-report", async (c) => {
    try {
      const body = await c.req.json();
      const {
        petId,
        customerId,
        vendorId,
        staffId,
        bookingId,
        referredFromBookingId, // The booking that prescribed the diagnostics
        reportType, // 'lab_result', 'imaging', 'diagnostic_report'
        title,
        fileUrl, // Pre-signed S3 URL or direct upload
        testResults, // Structured test results
        findings,
        recommendations,
      } = body;

      if (!petId || !bookingId) {
        return c.json({ error: 'petId and bookingId are required' }, 400);
      }

      // Get diagnostics center name
      let diagnosticsName = 'Diagnostics Center';
      if (vendorId) {
        const vendors = await select('vendors', { id: vendorId });
        diagnosticsName = vendors[0]?.business_name || 'Diagnostics Center';
      }

      // Create diagnostic report record
      const record = await insert('medical_records', {
        pet_id: petId,
        customer_id: customerId,
        vendor_id: vendorId,
        staff_id: staffId,
        booking_id: bookingId,
        referred_from_booking_id: referredFromBookingId,
        record_type: reportType || 'diagnostic_report',
        title: title || `Diagnostic Report - ${new Date().toLocaleDateString()}`,
        description: findings,
        file_url: fileUrl,
        content_data: JSON.stringify({
          testResults,
          findings,
          recommendations,
        }),
        prescribed_by: staffId || vendorId,
        prescribed_by_name: diagnosticsName,
        created_at: new Date().toISOString(),
      });

      const newRecordId = record[0]?.id;

      // Notify customer
      try {
        const { sendEventNotification } = await import('../lib/services/push-notification-service');
        
        const pets = await select('pets', { id: petId });
        const petName = pets[0]?.name || 'your pet';

        await sendEventNotification({
          eventType: 'report_uploaded',
          recipientId: customerId,
          recipientType: 'customer',
          relatedId: bookingId,
          data: {
            bookingId,
            petName,
            vendorName: diagnosticsName,
            recordId: newRecordId,
          },
        });
      } catch (notifError) {
        console.warn('Failed to send report notification to customer:', notifError);
      }

      // ✅ FIX GAP PG-3: Notify the prescribing vet about the diagnostics report
      if (referredFromBookingId) {
        try {
          // Get the original booking to find the prescribing vet
          const originalBookings = await select('bookings', { id: referredFromBookingId });
          if (originalBookings.length > 0) {
            const originalBooking = originalBookings[0];
            const prescribingVendorId = originalBooking.vendor_id;
            const prescribingStaffId = originalBooking.staff_id;

            const { sendEventNotification } = await import('../lib/services/push-notification-service');
            
            const pets = await select('pets', { id: petId });
            const petName = pets[0]?.name || 'patient';

            // Notify the prescribing vendor/staff
            const recipientId = prescribingStaffId || prescribingVendorId;
            const recipientType = prescribingStaffId ? 'staff' : 'vendor';

            await sendEventNotification({
              eventType: 'report_uploaded',
              recipientId,
              recipientType: recipientType as any,
              relatedId: referredFromBookingId,
              data: {
                originalBookingId: referredFromBookingId,
                diagnosticsBookingId: bookingId,
                petName,
                diagnosticsCenter: diagnosticsName,
                recordId: newRecordId,
                message: `Diagnostic report for ${petName} is now available`,
              },
            });

            console.log(`📋 Notified prescribing vet (${recipientType} ${recipientId}) about diagnostics report`);
          }
        } catch (vetNotifError) {
          console.warn('Failed to notify prescribing vet:', vetNotifError);
        }
      }

      return c.json({
        success: true,
        record: record[0],
        message: 'Diagnostic report uploaded successfully',
      });

    } catch (error: any) {
      console.error('Error uploading diagnostic report:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /medical-records/upload
   * Generic medical record upload with file
   */
  app.post("/medical-records/upload", async (c) => {
    try {
      const body = await c.req.json();
      const {
        petId,
        customerId,
        vendorId,
        staffId,
        bookingId,
        recordType,
        title,
        description,
        fileData, // Base64 encoded file data
        fileName,
        contentType,
      } = body;

      if (!petId || !recordType || !title) {
        return c.json({ error: 'petId, recordType, and title are required' }, 400);
      }

      let fileUrl = null;

      // Upload file to S3 if provided
      if (fileData && fileName) {
        const buffer = Buffer.from(fileData, 'base64');
        const key = generateS3Key('document', petId, fileName);
        const uploadResult = await uploadToS3('documents', key, buffer, contentType || 'application/pdf');
        fileUrl = uploadResult.url;
      }

      // Create record
      const record = await insert('medical_records', {
        pet_id: petId,
        customer_id: customerId,
        vendor_id: vendorId,
        staff_id: staffId,
        booking_id: bookingId,
        record_type: recordType,
        title,
        description,
        file_url: fileUrl,
        created_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        record: record[0],
        message: 'Medical record uploaded successfully',
      });

    } catch (error: any) {
      console.error('Error uploading medical record:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /medical-records/prescribing-vet/:bookingId
   * Get records accessible by the vet who prescribed diagnostics
   * Fixes GAP: PG-3 - Prescribing Vet Access to Diagnostics Report
   */
  app.get("/medical-records/prescribing-vet/:bookingId", async (c) => {
    try {
      const { bookingId } = c.req.param();

      // Get all records that reference this booking (diagnostics reports)
      const referralRecords = await query(
        `SELECT mr.*, 
                v.business_name as vendor_name,
                s.name as staff_name,
                p.name as pet_name,
                b.booking_date,
                b.service_name
         FROM medical_records mr
         LEFT JOIN vendors v ON mr.vendor_id = v.id
         LEFT JOIN staff s ON mr.staff_id = s.id
         LEFT JOIN pets p ON mr.pet_id = p.id
         LEFT JOIN bookings b ON mr.booking_id = b.id
         WHERE mr.referred_from_booking_id = $1
         ORDER BY mr.created_at DESC`,
        [bookingId]
      );

      // Get the original prescription from this booking
      const originalRecords = await query(
        `SELECT mr.*, 
                v.business_name as vendor_name,
                s.name as staff_name
         FROM medical_records mr
         LEFT JOIN vendors v ON mr.vendor_id = v.id
         LEFT JOIN staff s ON mr.staff_id = s.id
         WHERE mr.booking_id = $1
         ORDER BY mr.created_at DESC`,
        [bookingId]
      );

      return c.json({
        success: true,
        originalRecords: (originalRecords as any).rows || [],
        diagnosticsReports: (referralRecords as any).rows || [],
        canUpdatePrescription: true, // Prescribing vet can update
      });

    } catch (error: any) {
      console.error('Error fetching prescribing vet records:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /medical-records/:recordId
   * Update a medical record (for follow-up prescriptions, etc.)
   */
  app.put("/medical-records/:recordId", async (c) => {
    try {
      const { recordId } = c.req.param();
      const body = await c.req.json();

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (body.title) updateData.title = body.title;
      if (body.description) updateData.description = body.description;
      if (body.contentData) updateData.content_data = JSON.stringify(body.contentData);
      if (body.fileUrl) updateData.file_url = body.fileUrl;

      await update('medical_records', { id: recordId }, updateData);

      return c.json({
        success: true,
        message: 'Medical record updated successfully',
      });

    } catch (error: any) {
      console.error('Error updating medical record:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /medical-records/types
   * Get available record types with display info
   */
  app.get("/medical-records/types", async (c) => {
    const types = [
      { id: 'prescription', name: 'Prescription', icon: '💊', color: '#4CAF50' },
      { id: 'diagnostic_report', name: 'Diagnostic Report', icon: '📊', color: '#2196F3' },
      { id: 'lab_result', name: 'Lab Result', icon: '🔬', color: '#9C27B0' },
      { id: 'vaccination', name: 'Vaccination', icon: '💉', color: '#FF9800' },
      { id: 'consultation_notes', name: 'Consultation Notes', icon: '📝', color: '#607D8B' },
      { id: 'surgery_notes', name: 'Surgery Notes', icon: '🏥', color: '#F44336' },
      { id: 'diet_plan', name: 'Diet Plan', icon: '🥗', color: '#8BC34A' },
      { id: 'imaging', name: 'Imaging (X-ray, etc.)', icon: '📷', color: '#00BCD4' },
      { id: 'other', name: 'Other', icon: '📎', color: '#9E9E9E' },
    ];

    return c.json({
      success: true,
      types,
    });
  });
}
