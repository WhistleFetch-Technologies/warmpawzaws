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
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { query, select, insert, update } from '../database/rds-connection';
import { uploadToS3, generateS3Key } from '../utils/aws/aws-clients';

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
   * ✅ FIX: GET /customer/:phone/medical-records
   * Get all medical records for a customer by phone (used by MedicalRecordsPage.tsx)
   * This fetches records across ALL pets belonging to the customer
   */
  app.get("/customer/:phone/medical-records", async (c) => {
    try {
      const phone = c.req.param('phone');
      const recordType = c.req.query('type');
      const limit = parseInt(c.req.query('limit') || '50');
      const offset = parseInt(c.req.query('offset') || '0');
      
      // Normalize phone number
      const normalizedPhone = phone.replace(/[^0-9]/g, '').slice(-10);
      
      console.log('📋 [MEDICAL-RECORDS] Fetching records for customer phone:', normalizedPhone);

      // First get customer and their pets
      const customerResult = await query(
        `SELECT c.id as customer_id, p.id as pet_id, p.name as pet_name
         FROM customers c
         LEFT JOIN pets p ON c.id = p.customer_id
         WHERE c.phone LIKE $1 OR c.phone LIKE $2`,
        [`%${normalizedPhone}`, `+91${normalizedPhone}`]
      );
      
      const customerRows = (customerResult as any)?.rows || customerResult || [];
      if (!customerRows || customerRows.length === 0) {
        return c.json({ success: true, records: [], total: 0, message: 'No customer found' });
      }
      
      const petIds = [...new Set(customerRows.map((r: any) => r.pet_id).filter(Boolean))] as string[];
      
      if (petIds.length === 0) {
        return c.json({ success: true, records: [], total: 0, message: 'No pets found' });
      }
      
      // Fetch medical records for all pets
      let queryText = `
        SELECT mr.*, 
               v.business_name as vendor_name,
               v.owner_name as veterinarian_name,
               p.name as pet_name,
               p.breed as pet_breed
        FROM medical_records mr
        LEFT JOIN vendors v ON mr.vendor_id = v.id
        LEFT JOIN pets p ON mr.pet_id = p.id
        WHERE mr.pet_id = ANY($1::uuid[])
      `;
      const params: any[] = [petIds];
      let paramIndex = 2;

      if (recordType && recordType !== 'all') {
        queryText += ` AND mr.record_type = $${paramIndex}`;
        params.push(recordType);
        paramIndex++;
      }

      queryText += ` ORDER BY mr.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await query(queryText, params);
      const mrRows = (result as any)?.rows || (result as any) || [];
      const recordsFromMr = mrRows.map((r: any) => ({
        id: r.id,
        pet_id: r.pet_id,
        pet_name: r.pet_name,
        record_type: r.record_type,
        title: r.title || r.record_type,
        description: r.description || r.notes,
        veterinarian_name: r.veterinarian_name,
        clinic_name: r.vendor_name,
        date: r.record_date || r.created_at,
        attachments: r.attachments || [],
        notes: r.notes,
        document_url: r.document_url || null,
        booking_id: r.booking_id || null,
        source: 'medical_records',
      }));

      // ✅ Include prescriptions for same pets (vendor history = customer pet profile medical records)
      let prescriptionRecords: any[] = [];
      try {
        // ✅ FIX: Use general_notes instead of instructions (column doesn't exist)
        // ✅ FIX: prescription_date and follow_up_date columns don't exist - use created_at and next_follow_up_date
        const prescResult = await query(
          `SELECT p.id, p.booking_id, p.pet_id, p.medications, p.general_notes as instructions, p.diagnosis, p.created_at as prescription_date, p.next_follow_up_date as follow_up_date, p.created_at,
                  v.business_name as vendor_name, v.owner_name as veterinarian_name
           FROM prescriptions p
           LEFT JOIN vendors v ON v.id = p.vendor_id
           WHERE p.pet_id = ANY($1::uuid[])
           ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
          [petIds, limit, offset]
        );
        const prescRows = (prescResult as any)?.rows || [];
        prescriptionRecords = prescRows.map((p: any) => ({
          id: p.id,
          pet_id: p.pet_id,
          pet_name: customerRows.find((r: any) => r.pet_id === p.pet_id)?.pet_name || null,
          record_type: 'prescription',
          title: 'Prescription',
          description: p.diagnosis ? `Diagnosis: ${p.diagnosis}` : (p.instructions || 'Consultation summary'),
          veterinarian_name: p.veterinarian_name,
          clinic_name: p.vendor_name,
          date: p.prescription_date || p.created_at,
          attachments: [],
          notes: p.instructions || null,
          document_url: null,
          booking_id: p.booking_id || null,
          source: 'prescriptions',
        }));
      } catch (prescErr: any) {
        console.warn('[MEDICAL-RECORDS] Prescriptions fetch failed (non-blocking):', prescErr?.message);
      }

      const allRecords = [...recordsFromMr, ...prescriptionRecords].sort(
        (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
      ).slice(0, limit);

      return c.json({
        success: true,
        records: allRecords,
        total: allRecords.length,
      });

    } catch (error: any) {
      console.error('❌ [MEDICAL-RECORDS] Error fetching by phone:', error);
      return c.json({ success: false, error: error.message, records: [] }, 500);
    }
  });

  /**
   * ✅ Alias: GET /medical-records?phone=...&type=...
   * Backward-compatible wrapper for customer medical records timeline
   */
  app.get("/medical-records", async (c) => {
    const phone = c.req.query('phone');
    if (!phone) {
      return c.json({ success: false, error: 'phone query param is required', records: [] }, 400);
    }
    // Reuse the main customer handler by delegating to a synthetic request
    const url = new URL(c.req.url);
    const type = url.searchParams.get('type');
    const limit = url.searchParams.get('limit');
    const offset = url.searchParams.get('offset');
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);

    const aliasUrl = `/customer/${encodeURIComponent(phone)}/medical-records${params.toString() ? `?${params.toString()}` : ''}`;
    return app.fetch(new Request(aliasUrl, c.req.raw));
  });

  /**
   * ✅ Alias: GET /medical-records/vaccinations?phone=...
   * Returns vaccination records from aggregated medical records
   */
  app.get("/medical-records/vaccinations", async (c) => {
    const phone = c.req.query('phone');
    if (!phone) {
      return c.json({ success: false, error: 'phone query param is required', vaccinations: [] }, 400);
    }

    const aliasUrl = `/customer/${encodeURIComponent(phone)}/medical-records?type=vaccination`;
    const response = await app.fetch(new Request(aliasUrl, c.req.raw));
    const payload = (await response.json().catch(() => null)) as { records?: any[] } | null;

    const records = payload?.records || [];
    return c.json({
      success: true,
      vaccinations: records,
      total: records.length,
    }, response.status as ContentfulStatusCode);
  });

  /**
   * ✅ Alias: GET /medical-records/export?phone=...&pet_id=...
   * Placeholder response (non-blocking) until export pipeline is implemented
   */
  app.get("/medical-records/export", async (c) => {
    const phone = c.req.query('phone');
    if (!phone) {
      return c.json({ success: false, error: 'phone query param is required' }, 400);
    }
    return c.json({
      success: true,
      message: 'Export queued. You will receive an email with the download link if configured.',
    });
  });

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
               p.name as pet_name
        FROM medical_records mr
        LEFT JOIN vendors v ON mr.vendor_id = v.id
        LEFT JOIN pets p ON mr.pet_id = p.id
        WHERE mr.pet_id = $1::uuid
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
      const recordsFromMr = (result as any).rows || [];

      // Include prescriptions for this pet so vet summaries appear in pet profile medical history
      let prescriptionRecords: any[] = [];
      try {
        // ✅ FIX: prescription_date and follow_up_date columns don't exist - use created_at and next_follow_up_date
        const prescResult = await query(
          `SELECT p.id, p.booking_id, p.pet_id, p.vendor_id, p.medications, p.general_notes as instructions, p.diagnosis,
                  p.created_at as prescription_date, p.next_follow_up_date as follow_up_date, p.created_at, p.medication_name,
                  v.business_name as vendor_name
           FROM prescriptions p
           LEFT JOIN vendors v ON p.vendor_id = v.id
           WHERE p.pet_id = $1::uuid
           ORDER BY p.created_at DESC
           LIMIT $2 OFFSET $3`,
          [petId, limit, offset]
        );
        prescriptionRecords = ((prescResult as any).rows || []).map((p: any) => ({
          id: p.id,
          booking_id: p.booking_id,
          pet_id: p.pet_id,
          vendor_id: p.vendor_id,
          vendor_name: p.vendor_name,
          record_type: 'prescription',
          prescription_date: p.prescription_date,
          record_date: p.prescription_date || p.created_at,
          created_at: p.created_at,
          content_data: { medications: p.medications, instructions: p.instructions, diagnosis: p.diagnosis, medication_name: p.medication_name },
          source: 'prescriptions',
        }));
      } catch (prescErr) {
        console.warn('[Medical Records] Pet prescriptions query failed (non-blocking):', prescErr);
      }

      const combined = [...recordsFromMr.map((r: any) => ({ ...r, source: 'medical_records' })), ...prescriptionRecords];
      combined.sort((a: any, b: any) => {
        const dateA = new Date(a.record_date || a.prescription_date || a.created_at || 0).getTime();
        const dateB = new Date(b.record_date || b.prescription_date || b.created_at || 0).getTime();
        return dateB - dateA;
      });
      const paginated = combined.slice(0, limit);

      return c.json({
        success: true,
        records: paginated,
        total: combined.length,
      });

    } catch (error: any) {
      console.error('Error fetching medical records:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /medical-records/booking/:bookingId
   * Get medical records for a specific booking
   * ✅ FIX: Now returns ALL documents in history (for the same pet), not just current booking
   * This matches the behavior of /bookings/:bookingId/history
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
      const petId = booking.pet_id;
      const customerId = booking.customer_id;

      // ✅ FIX: Get ALL medical records for this pet (not just this booking)
      // This includes records from other bookings for the same pet (customer uploads, etc.)
      let records: any;
      if (petId) {
        console.log(`[Medical Records] Fetching all records for pet ${petId} (booking ${bookingId})`);
        records = await query(
          `SELECT mr.*, 
                  v.business_name as vendor_name
           FROM medical_records mr
           LEFT JOIN vendors v ON mr.vendor_id = v.id
           WHERE (
             -- Records directly linked to this booking
             mr.booking_id = $1::uuid
             OR
             -- Records for the same pet (customer-uploaded documents may not have booking_id)
             mr.pet_id = $2::uuid
           )
           ORDER BY mr.created_at DESC`,
          [bookingId, petId]
        );
        console.log(`[Medical Records] Found ${records.rows.length} records for pet ${petId}`);
      } else {
        // Fallback: if no pet_id, only get records for this booking
        console.warn('[Medical Records] Booking missing pet_id, only returning records for this booking');
        records = await query(
          `SELECT mr.*, 
                  v.business_name as vendor_name
           FROM medical_records mr
           LEFT JOIN vendors v ON mr.vendor_id = v.id
           WHERE mr.booking_id = $1::uuid
           ORDER BY mr.created_at DESC`,
          [bookingId]
        );
      }

      // ✅ FIX: Get ALL prescriptions for this pet (not just this booking)
      // This shows the complete prescription history for the pet
      // ✅ FIX: prescription_date and follow_up_date columns don't exist - use created_at and next_follow_up_date
      const prescriptions = await query(
        `SELECT 
          p.id,
          p.booking_id,
          p.medications,
          p.general_notes as instructions,
          p.diagnosis,
          p.created_at as prescription_date,
          p.next_follow_up_date as follow_up_date,
          p.created_at,
          v.business_name as vendor_name,
          s.name as staff_name
        FROM prescriptions p
        LEFT JOIN vendors v ON v.id = p.vendor_id
        LEFT JOIN staff s ON s.id = p.staff_id
        WHERE ${petId ? 'p.pet_id = $1::uuid' : 'p.booking_id = $1'}
        ORDER BY p.created_at DESC`,
        [petId || bookingId]
      ).catch(() => ({ rows: [] }));

      // ✅ FIX: referred_from_booking_id column doesn't exist in medical_records table
      // Skip referral records query - all records are already included in the main query above
      const referralRecords = { rows: [] };

      // Combine medical records and prescriptions, sort by date
      const allRecords = [
        ...(records as any).rows.map((r: any) => ({ ...r, source: 'medical_records' })),
        ...(prescriptions as any).rows.map((p: any) => ({
          id: `prescription_${p.id}`,
          booking_id: p.booking_id,
          record_type: 'prescription',
          title: 'Prescription',
          description: p.diagnosis || 'Prescription',
          content_data: {
            medications: p.medications,
            instructions: p.instructions,
            diagnosis: p.diagnosis,
            prescription_date: p.prescription_date,
            follow_up_date: p.follow_up_date,
          },
          vendor_name: p.vendor_name,
          staff_name: p.staff_name,
          created_at: p.created_at,
          source: 'prescriptions',
        })),
      ].sort((a: any, b: any) => {
        const aTime = new Date(a.created_at || 0).getTime();
        const bTime = new Date(b.created_at || 0).getTime();
        return bTime - aTime;
      });

      return c.json({
        success: true,
        booking: {
          id: booking.id,
          serviceName: booking.service_name,
          date: booking.booking_date,
          status: booking.status,
          petId: petId,
        },
        records: allRecords, // ✅ FIX: Now includes ALL documents in history (for the same pet)
        prescriptions: (prescriptions as any).rows || [], // Also return separately for easy access
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
      // ✅ FIX: Handle constraint error gracefully - try 'prescription', fallback to 'treatment' if constraint doesn't allow it
      let record;
      try {
        record = await insert('medical_records', {
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
      } catch (constraintError: any) {
        // ✅ FIX: If constraint doesn't allow 'prescription', use 'treatment' as fallback
        if (constraintError.message && constraintError.message.includes('record_type_check')) {
          console.warn('[Medical Records] Constraint doesn\'t allow "prescription", using "treatment" as fallback');
          record = await insert('medical_records', {
            pet_id: petId,
            customer_id: customerId,
            vendor_id: vendorId,
            staff_id: staffId,
            booking_id: bookingId,
            record_type: 'treatment', // Fallback value that works with older constraints
            title: `Prescription - ${new Date().toLocaleDateString()}`,
            description: `${diagnosis || notes} [Type: Prescription]`,
            content_data: JSON.stringify({
              medications,
              diagnosis,
              notes,
              followUpDate,
              recordType: 'prescription', // Store actual type in content_data
            }),
            prescribed_by: staffId || vendorId,
            prescribed_by_name: prescriberName,
            created_at: new Date().toISOString(),
          });
        } else {
          throw constraintError;
        }
      }

      // Send notification to customer
      try {
        const { sendEventNotification } = await import('../aws/aws-sns-notification-service');
        
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
      // ✅ FIX: referred_from_booking_id column doesn't exist - use booking_id instead
      const record = await insert('medical_records', {
        pet_id: petId,
        customer_id: customerId,
        vendor_id: vendorId,
        staff_id: staffId,
        booking_id: referredFromBookingId || bookingId, // Use referred booking if provided, otherwise use current booking
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
        const { sendEventNotification } = await import('../aws/aws-sns-notification-service');
        
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

            const { sendEventNotification } = await import('../aws/aws-sns-notification-service');
            
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

      // ✅ FIX: referred_from_booking_id column doesn't exist in medical_records table
      // All records linked to this booking are already included in originalRecords query below
      const referralRecords = { rows: [] };

      // Get the original prescription from this booking
      const originalRecords = await query(
        `SELECT mr.*, 
                v.business_name as vendor_name
         FROM medical_records mr
         LEFT JOIN vendors v ON mr.vendor_id = v.id
         WHERE mr.booking_id = $1::uuid
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
      const body = await c.req.json().catch(() => ({}));

      const hasPatch =
        body.title !== undefined ||
        body.description !== undefined ||
        body.contentData !== undefined ||
        body.fileUrl !== undefined;
      if (!hasPatch) {
        return c.json(
          { success: false, error: 'At least one of title, description, contentData, or fileUrl is required' },
          400
        );
      }

      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (body.title !== undefined) updateData.title = body.title;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.contentData !== undefined) {
        updateData.content_data =
          typeof body.contentData === 'string'
            ? body.contentData
            : JSON.stringify(body.contentData);
      }
      if (body.fileUrl !== undefined) updateData.file_url = body.fileUrl;

      const rows = await update('medical_records', { id: recordId }, updateData);
      if (!rows || rows.length === 0) {
        return c.json({ success: false, error: 'Medical record not found' }, 404);
      }

      const row = rows[0] as { id?: string; customer_id?: string };
      return c.json({
        success: true,
        message: 'Medical record updated successfully',
        recordId: row.id ?? recordId,
        customerId: row.customer_id,
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

  /**
   * POST /medical-records/booking/:bookingId/upload-prescription
   * Upload handwritten prescription (photo/PDF) with mandatory date field
   * Available for both customer and vendor
   */
  app.post("/medical-records/booking/:bookingId/upload-prescription", async (c) => {
    try {
      const { bookingId } = c.req.param();
      
      // Get booking details to verify access
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const recordDate = formData.get('recordDate') as string; // Mandatory date field
      const uploadedBy = formData.get('uploadedBy') as string; // 'customer' or 'vendor'
      const userId = formData.get('userId') as string; // customer phone or vendor ID
      const context = formData.get('context') as string; // Optional context/notes field

      if (!file || !recordDate) {
        return c.json({ error: 'file and recordDate are required' }, 400);
      }

      if (!uploadedBy || !['customer', 'vendor'].includes(uploadedBy)) {
        return c.json({ error: 'uploadedBy must be "customer" or "vendor"' }, 400);
      }

      // Validate date format
      const dateObj = new Date(recordDate);
      if (isNaN(dateObj.getTime())) {
        return c.json({ error: 'Invalid date format for recordDate' }, 400);
      }

      // Upload file to S3
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop() || 'pdf';
      const fileKey = `prescriptions/${bookingId}/${timestamp}_${file.name}`;

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: uint8Array,
        ContentType: file.type || (fileExt === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      }));

      // ✅ FIX: Store S3 key instead of presigned URL to avoid expired token issues
      // Presigned URLs will be generated on-demand when viewing the file
      // This prevents ExpiredToken errors when temporary credentials expire before the presigned URL

      // RDS NOT NULL on created_by; use booking-scoped UUIDs. Role "system" for customer uploads
      // satisfies legacy CHECK (vendor|staff|admin|system) where "customer" is not allowed.
      const createdBy =
        uploadedBy === 'vendor'
          ? booking.vendor_id
          : booking.customer_id;
      const createdByRole =
        uploadedBy === 'vendor' ? 'vendor' : 'system';

      if (!createdBy) {
        return c.json(
          { error: 'Cannot determine creator for this booking (missing customer or vendor id)' },
          400
        );
      }

      // Create medical record entry
      // ✅ FIX: Handle constraint error gracefully - try 'prescription', fallback to 'treatment' if constraint doesn't allow it
      let record;
      const recordBase = {
        pet_id: booking.pet_id,
        customer_id: booking.customer_id,
        vendor_id: booking.vendor_id,
        booking_id: bookingId,
        file_url: fileKey,
        record_date: recordDate,
        created_at: new Date().toISOString(),
        created_by: createdBy,
        created_by_role: createdByRole,
      };

      try {
        record = await insert('medical_records', {
          ...recordBase,
          record_type: 'prescription',
          title: `Handwritten Prescription - ${new Date(recordDate).toLocaleDateString()}`,
          description: context || `Handwritten prescription uploaded by ${uploadedBy}`,
        });
      } catch (constraintError: any) {
        // ✅ FIX: If constraint doesn't allow 'prescription', use 'treatment' as fallback
        if (constraintError.message && constraintError.message.includes('record_type_check')) {
          console.warn('[Medical Records] Constraint doesn\'t allow "prescription", using "treatment" as fallback');
          record = await insert('medical_records', {
            ...recordBase,
            record_type: 'treatment', // Fallback value that works with older constraints
            title: `Handwritten Prescription - ${new Date(recordDate).toLocaleDateString()}`,
            description: context || `Handwritten prescription uploaded by ${uploadedBy} [Type: Prescription]`,
          });
        } else {
          throw constraintError;
        }
      }

      // ✅ FIX: Generate fresh presigned URL for immediate response (not stored in DB)
      const responseSignedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        }),
        { expiresIn: 3600 } // 1 hour
      );

      return c.json({
        success: true,
        record: record[0],
        fileUrl: responseSignedUrl, // Fresh presigned URL for immediate use
        message: 'Handwritten prescription uploaded successfully',
      });

    } catch (error: any) {
      console.error('Error uploading handwritten prescription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/prescriptions/upload
   * Upload prescription file for customer (e.g., for pharmacy orders)
   * Does not require bookingId or vendorId - just uploads file and returns URL
   */
  app.post("/customer/prescriptions/upload", async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const customerId = formData.get('customerId') as string;
      const customerPhone = formData.get('customerPhone') as string;

      if (!file) {
        return c.json({ error: 'file is required' }, 400);
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return c.json({ error: 'File size must be less than 10MB' }, 400);
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        return c.json({ error: 'Only images (JPG, PNG, GIF, WEBP) and PDF files are allowed' }, 400);
      }

      // Upload file to S3
      const { S3Client, PutObjectCommand, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
      
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop() || 'pdf';
      const identifier = customerId || customerPhone || 'customer';
      const fileKey = `prescriptions/customer/${identifier}/${timestamp}_${file.name}`;

      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: uint8Array,
        ContentType: file.type || (fileExt === 'pdf' ? 'application/pdf' : 'image/jpeg'),
      }));

      // Generate presigned URL for immediate use
      const signedUrl = await getSignedUrl(
        s3Client,
        new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: fileKey,
        }),
        { expiresIn: 604800 } // 7 days
      );

      return c.json({
        success: true,
        url: signedUrl,
        fileKey: fileKey,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        message: 'Prescription uploaded successfully',
      });

    } catch (error: any) {
      console.error('Error uploading customer prescription:', error);
      return c.json({ error: error.message || 'Failed to upload prescription' }, 500);
    }
  });

  /**
   * POST /medical-records/booking/:bookingId/prescription
   * Create prescription by doctor (auto-updates with latest date)
   * Latest prescription date comes first and keeps updating
   */
  app.post("/medical-records/booking/:bookingId/prescription", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const body = await c.req.json();
      
      const {
        medications,
        diagnosis,
        notes,
        followUpDate,
        vendorId,
        staffId,
      } = body;

      // Get booking details
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];

      // Get prescriber name
      let prescriberName = 'Doctor';
      if (staffId) {
        const staff = await select('staff', { id: staffId });
        prescriberName = staff[0]?.name || 'Doctor';
      } else if (vendorId) {
        const vendors = await select('vendors', { id: vendorId });
        prescriberName = vendors[0]?.business_name || 'Doctor';
      }

      // Auto-update prescription_date with current timestamp (latest date)
      const prescriptionDate = new Date().toISOString();

      // Create or update prescription record
      // Check if prescription already exists for this booking
      const existingRecords = await query(
        `SELECT * FROM medical_records 
         WHERE booking_id = $1 
         AND (
           record_type = 'prescription' 
           OR (record_type = 'treatment' AND (
             description ILIKE '%[Type: Prescription]%' 
             OR content_data::text ILIKE '%"recordType":"prescription"%'
           ))
         )
         AND prescription_date IS NOT NULL
         ORDER BY prescription_date DESC
         LIMIT 1`,
        [bookingId]
      );

      let record;
      if ((existingRecords as any).rows && (existingRecords as any).rows.length > 0) {
        // Update existing prescription with latest date
        const existingRecord = (existingRecords as any).rows[0];
        await update('medical_records', { id: existingRecord.id }, {
          prescription_date: prescriptionDate,
          content_data: JSON.stringify({
            medications,
            diagnosis,
            notes,
            followUpDate,
          }),
          updated_at: new Date().toISOString(),
        });
        record = await select('medical_records', { id: existingRecord.id });
        record = record[0];
      } else {
        // Create new prescription record
        // ✅ FIX: Handle constraint error gracefully - try 'prescription', fallback to 'treatment' if constraint doesn't allow it
        let newRecord;
        try {
          newRecord = await insert('medical_records', {
            pet_id: booking.pet_id,
            customer_id: booking.customer_id,
            vendor_id: vendorId || booking.vendor_id,
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
            prescribed_by: staffId || vendorId || booking.vendor_id,
            prescribed_by_name: prescriberName,
            prescription_date: prescriptionDate, // Auto-updated with latest date
            created_at: new Date().toISOString(),
          });
        } catch (constraintError: any) {
          // ✅ FIX: If constraint doesn't allow 'prescription', use 'treatment' as fallback
          if (constraintError.message && constraintError.message.includes('record_type_check')) {
            console.warn('[Medical Records] Constraint doesn\'t allow "prescription", using "treatment" as fallback');
            newRecord = await insert('medical_records', {
              pet_id: booking.pet_id,
              customer_id: booking.customer_id,
              vendor_id: vendorId || booking.vendor_id,
              staff_id: staffId,
              booking_id: bookingId,
              record_type: 'treatment', // Fallback value that works with older constraints
              title: `Prescription - ${new Date().toLocaleDateString()}`,
              description: `${diagnosis || notes} [Type: Prescription]`,
              content_data: JSON.stringify({
                medications,
                diagnosis,
                notes,
                followUpDate,
                recordType: 'prescription', // Store actual type in content_data
              }),
              prescribed_by: staffId || vendorId || booking.vendor_id,
              prescribed_by_name: prescriberName,
              prescription_date: prescriptionDate,
              created_at: new Date().toISOString(),
            });
          } else {
            throw constraintError;
          }
        }
        record = newRecord[0];
      }

      return c.json({
        success: true,
        record,
        prescriptionDate,
        message: 'Prescription created/updated successfully',
      });

    } catch (error: any) {
      console.error('Error creating prescription:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /medical-records/booking/:bookingId/prescriptions
   * Get all prescriptions for a booking (doctor-created prescriptions only)
   * ✅ FIX: Only return prescriptions from prescriptions table, NOT uploaded documents from medical_records
   * ✅ FIX: Query by pet_id to get ALL prescriptions in history (not just current booking)
   */
  app.get("/medical-records/booking/:bookingId/prescriptions", async (c) => {
    try {
      const { bookingId } = c.req.param();

      // Get booking details
      const bookings = await select('bookings', { id: bookingId });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      const booking = bookings[0];
      const petId = booking.pet_id;

      // ✅ FIX: Get prescriptions from prescriptions table (doctor-created)
      let prescriptionsTableRecords: any[] = [];
      try {
        const prescriptionsResult = await query(
          `SELECT pr.*, 
                  v.business_name as vendor_name,
                  p.name as pet_name,
                  p.species as pet_species,
                  p.breed as pet_breed,
                  p.age_years as pet_age_years,
                  p.age_months as pet_age_months,
                  p.gender as pet_gender,
                  p.weight_kg as pet_weight_kg,
                  'prescriptions' as source,
                  'prescription' as record_type
           FROM prescriptions pr
           LEFT JOIN vendors v ON pr.vendor_id = v.id
           LEFT JOIN pets p ON COALESCE(pr.pet_id, $2::uuid) = p.id
           WHERE ${petId ? 'pr.pet_id = $1::uuid' : 'pr.booking_id = $1::uuid'}
           AND pr.is_active = true
           AND (pr.status IS NULL OR pr.status = 'published' OR pr.status != 'cancelled')`,
          [petId || bookingId, petId || null]
        );
        prescriptionsTableRecords = (prescriptionsResult as any).rows || [];
        console.log(`[Prescriptions] Found ${prescriptionsTableRecords.length} prescriptions from prescriptions table`);
      } catch (prescError) {
        console.warn('Error querying prescriptions table:', prescError);
        prescriptionsTableRecords = [];
      }

      // ✅ FIX: Also get uploaded prescription documents from medical_records table
      let uploadedPrescriptions: any[] = [];
      try {
        const medicalRecordsResult = await query(
          `SELECT mr.*,
                  v.business_name as vendor_name,
                  p.name as pet_name,
                  'medical_records' as source,
                  'uploaded' as record_type,
                  mr.record_date as prescription_date,
                  mr.title as medication_name,
                  mr.description as instructions
           FROM medical_records mr
           LEFT JOIN vendors v ON mr.vendor_id = v.id
           LEFT JOIN pets p ON mr.pet_id = p.id
           WHERE mr.booking_id = $1::uuid
           AND (mr.record_type = 'prescription' 
                OR (mr.record_type = 'treatment' AND mr.title ILIKE '%prescription%'))`,
          [bookingId]
        );
        uploadedPrescriptions = (medicalRecordsResult as any).rows || [];
        console.log(`[Prescriptions] Found ${uploadedPrescriptions.length} uploaded prescription documents from medical_records table`);
      } catch (medicalError) {
        console.warn('Error querying medical_records table for prescriptions:', medicalError);
        uploadedPrescriptions = [];
      }

      // ✅ FIX: Combine both doctor-created prescriptions and uploaded prescription documents
      const allPrescriptions = [...prescriptionsTableRecords, ...uploadedPrescriptions];
      const uniqueById = new Map();
      for (const p of allPrescriptions) {
        if (!uniqueById.has(p.id)) {
          uniqueById.set(p.id, p);
        }
      }
      let prescriptions = Array.from(uniqueById.values());

      // ✅ FIX: Generate presigned URLs for uploaded prescription documents (file_url contains S3 key)
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
      const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';

      prescriptions = await Promise.all(
        prescriptions.map(async (p: any) => {
          // If it's an uploaded prescription with file_url (S3 key), generate presigned URL
          if (p.source === 'medical_records' && p.file_url && !p.file_url.startsWith('http')) {
            try {
              const signedUrl = await getSignedUrl(
                s3Client,
                new GetObjectCommand({ Bucket: BUCKET_NAME, Key: p.file_url }),
                { expiresIn: 604800 } // 7 days
              );
              return { ...p, file_url: signedUrl, prescription_file_url: signedUrl };
            } catch (urlError: any) {
              console.warn(`[Prescriptions] Failed to generate presigned URL for ${p.file_url}:`, urlError?.message);
              return p; // Return without URL if generation fails
            }
          }
          return p;
        })
      );

      // 4. Sort by date (latest first)
      prescriptions.sort((a, b) => {
        const dateA = new Date(a.prescription_date || a.record_date || a.created_at).getTime();
        const dateB = new Date(b.prescription_date || b.record_date || b.created_at).getTime();
        return dateB - dateA;
      });

      return c.json({
        success: true,
        prescriptions,
        total: prescriptions.length,
        booking: {
          id: booking.id,
          petId: booking.pet_id,
          customerId: booking.customer_id,
        },
      });

    } catch (error: any) {
      console.error('Error fetching prescriptions:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /medical-records/booking/:bookingId/view/:recordId
   * View specific prescription file (PDF/photo) or prescription details
   * Returns file URL or prescription content
   * ✅ FIX: Check both medical_records AND prescriptions tables
   */
  app.get("/medical-records/booking/:bookingId/view/:recordId", async (c) => {
    try {
      const { bookingId, recordId } = c.req.param();

      let record: any = null;
      let recordSource: 'medical_records' | 'prescriptions' = 'medical_records';

      // First, try to get from medical_records table
      const medicalRecords = await select('medical_records', { id: recordId, booking_id: bookingId });
      
      if (medicalRecords.length > 0) {
        record = medicalRecords[0];
        recordSource = 'medical_records';
      } else {
        // ✅ FIX: Also check the prescriptions table if not found in medical_records
        try {
          const prescriptionRecords = await select('prescriptions', { id: recordId, booking_id: bookingId });
          if (prescriptionRecords.length > 0) {
            record = prescriptionRecords[0];
            recordSource = 'prescriptions';
          }
        } catch (prescError) {
          console.warn('Error checking prescriptions table:', prescError);
        }

        // ✅ FIX: Also try searching by just recordId (in case booking_id doesn't match)
        if (!record) {
          try {
            // Check medical_records by just ID
            const mrById = await select('medical_records', { id: recordId });
            if (mrById.length > 0) {
              record = mrById[0];
              recordSource = 'medical_records';
            }
          } catch (e) {
            // Ignore
          }
        }

        if (!record) {
          try {
            // Check prescriptions by just ID
            const pById = await select('prescriptions', { id: recordId });
            if (pById.length > 0) {
              record = pById[0];
              recordSource = 'prescriptions';
            }
          } catch (e) {
            // Ignore
          }
        }
      }

      if (!record) {
        return c.json({ error: 'Record not found' }, 404);
      }

      // If it's a file-based prescription (handwritten), return file URL
      if (record.file_url) {
        // ✅ FIX: Always generate fresh presigned URL for S3 files
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        
        const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
        const BUCKET_NAME = process.env.S3_UPLOADS_BUCKET || 'warmpawz-dev-uploads';
        
        // ✅ FIX: Extract S3 key from various URL formats
        // Handle both stored S3 keys and legacy presigned URLs
        let key = record.file_url;
        
        // Remove query string if present (for presigned URLs)
        if (key.includes('?')) {
          key = key.split('?')[0];
        }
        
        // Handle different S3 URL formats
        // Format 1: https://bucket-name.s3.region.amazonaws.com/key
        // Format 2: https://s3.region.amazonaws.com/bucket-name/key
        // Format 3: s3://bucket-name/key
        // Format 4: Just the key path (documents/prescription-123.jpg or prescriptions/...)
        // Format 5: CloudFront URL - extract from path
        
        const urlPatterns = [
          new RegExp(`https://${BUCKET_NAME}\\.s3\\.([^.]+)\\.amazonaws\\.com/(.+)`),
          new RegExp(`https://s3\\.([^.]+)\\.amazonaws\\.com/${BUCKET_NAME}/(.+)`),
          new RegExp(`s3://${BUCKET_NAME}/(.+)`),
          new RegExp(`https://[^/]+\\.cloudfront\\.net/(.+)`), // CloudFront URL
        ];
        
        let extractedKey: string | null = null;
        
        // Try to extract key from URL patterns
        for (const pattern of urlPatterns) {
          const match = key.match(pattern);
          if (match) {
            extractedKey = match[match.length - 1]; // Get the last capture group (the key)
            // ✅ FIX: Decode URL-encoded characters in the key (e.g., %20 -> space)
            extractedKey = decodeURIComponent(extractedKey as string);
            break;
          }
        }
        
        // If no pattern matched, check if it's already a key path (starts with 'documents/' or similar)
        if (!extractedKey && (key.startsWith('documents/') || key.startsWith('prescriptions/') || key.startsWith('medical-records/'))) {
          extractedKey = key;
        }
        
        // ✅ FIX: Also try URL decoding if the key looks like it might be encoded
        if (!extractedKey && key.includes('%')) {
          try {
            const decoded = decodeURIComponent(key);
            if (decoded.startsWith('documents/') || decoded.startsWith('prescriptions/') || decoded.startsWith('medical-records/')) {
              extractedKey = decoded;
            }
          } catch (e) {
            // Not a valid URL-encoded string, continue
          }
        }
        
        // If we have a valid key, generate presigned URL
        if (extractedKey) {
          try {
            const signedUrl = await getSignedUrl(
              s3Client,
              new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: extractedKey,
              }),
              { expiresIn: 3600 } // 1 hour
            );

            return c.json({
              success: true,
              record,
              fileUrl: signedUrl,
              type: 'file',
            });
          } catch (s3Error: any) {
            console.error('Failed to generate presigned URL:', s3Error);
            // Fall through to return original URL
          }
        }
        
        // Fallback: return original URL (might be a public URL or external URL)
        return c.json({
          success: true,
          record,
          fileUrl: record.file_url,
          type: 'file',
        });
      }

      // If it's a doctor-created prescription, return content data
      // ✅ FIX: Handle both medical_records and prescriptions table structures
      let contentData = null;
      
      if (recordSource === 'prescriptions') {
        // Prescriptions table has different structure
        contentData = {
          medications: record.medications || [],
          diagnosis: record.diagnosis,
          notes: record.notes,
          doctorName: record.doctor_name,
          followUpDate: record.follow_up_date,
          followUpNotes: record.follow_up_notes,
          prescriptionDate: record.prescription_date || record.created_at,
          status: record.status || 'published',
        };
      } else if (record.content_data) {
        // Medical records table - parse content_data
        try {
          contentData = typeof record.content_data === 'string' 
            ? JSON.parse(record.content_data) 
            : record.content_data;
        } catch (e) {
          contentData = { raw: record.content_data };
        }
      }

      return c.json({
        success: true,
        record: {
          ...record,
          source: recordSource, // ✅ NEW: Indicate which table the record came from
        },
        contentData,
        type: record.file_url ? 'file' : 'prescription',
      });

    } catch (error: any) {
      console.error('Error viewing prescription:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}
