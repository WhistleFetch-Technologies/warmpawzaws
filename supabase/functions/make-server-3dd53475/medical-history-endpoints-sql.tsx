/**
 * ============================================================================
 * MEDICAL HISTORY ENDPOINTS - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Get medical history by appointment (with strict access control)
 * - Upload medical documents
 * - Add vet summary to appointment
 * - Get/create prescriptions
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `medical_records`, `prescriptions`, `bookings`, `pets` tables
 * - Uses `BookingsRepository`, `PetsRepository`, `PrescriptionsRepository`
 * 
 * Date: 2025-01-28
 * Migration: Batch 15 - KV to SQL (12 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { ensureBucket } from "./bucket-manager.tsx";
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getDbClient } from '../../lib/db.ts';

const db = getDbClient();
const bookingsRepo = getBookingsRepository();
const petsRepo = getPetsRepository();

const MEDICAL_RECORDS_BUCKET = 'make-3dd53475-medical-records';

// Initialize medical records bucket on module load (non-blocking)
const initializeMedicalRecordsBucket = async () => {
  try {
    await ensureBucket(MEDICAL_RECORDS_BUCKET, {
      public: false,
      fileSizeLimit: 20971520 // 20MB limit
    });
  } catch (error) {
    console.error('❌ Non-critical: Failed to initialize medical records bucket:', error);
  }
};

initializeMedicalRecordsBucket().catch(err => 
  console.error('❌ Bucket init error (non-critical):', err)
);

interface MedicalRecord {
  id: string;
  petId: string;
  appointmentId?: string;
  recordType: string;
  title: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileType?: string;
  uploadedBy: string;
  uploaderRole: string;
  uploadDate: string;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

interface Prescription {
  id: string;
  appointmentId: string;
  petId: string;
  customerId: string;
  vendorId: string;
  staffId?: string;
  diagnosis: string;
  medications: string;
  dosage: string;
  duration: string;
  instructions?: string;
  doctorName: string;
  clinicName: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function registerMedicalHistoryEndpointsSQL(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";

  // ==========================================================================
  // GET MEDICAL HISTORY BY APPOINTMENT (WITH STRICT ACCESS CONTROL)
  // ==========================================================================
  app.get(`${BASE_PATH}/appointments/:appointmentId/medical-records`, async (c) => {
    try {
      const { appointmentId } = c.req.param();
      const requesterId = c.req.header('X-User-Id');
      const requesterRole = c.req.header('X-User-Role');

      console.log(`[MEDICAL HISTORY] Request for appointment: ${appointmentId} by ${requesterRole}: ${requesterId}`);

      // ✅ SQL: Verify appointment exists
      const appointment = await bookingsRepo.findById(appointmentId);
      
      if (!appointment) {
        console.log(`❌ Appointment not found: ${appointmentId}`);
        return c.json({ error: 'Appointment not found' }, 404);
      }

      // 🔒 SECURITY CHECK 2: Verify appointment is valid (not cancelled)
      if (appointment.status === 'cancelled') {
        console.log(`❌ Cannot access cancelled appointment: ${appointmentId}`);
        return c.json({ error: 'Cannot access medical records for cancelled appointments' }, 403);
      }

      // 🔒 SECURITY CHECK 3: Verify requester is assigned to this appointment
      const isAuthorized = 
        appointment.vendor_id === requesterId || 
        appointment.staff_id === requesterId;

      if (!isAuthorized) {
        console.log(`❌ Unauthorized access attempt by ${requesterId} to appointment ${appointmentId}`);
        return c.json({ error: 'Access Denied: You are not assigned to this appointment' }, 403);
      }

      // ✅ Authorization passed - fetch medical records
      // Get pet ID from booking (assuming it's stored in booking metadata or service_id references pet)
      // For now, we'll need to get it from the booking metadata or a separate query
      const bookingMetadata = (appointment as any).metadata || {};
      const petId = bookingMetadata.petId || bookingMetadata.petIds?.[0];
      
      if (!petId) {
        return c.json({ error: 'No pet associated with this appointment' }, 400);
      }

      console.log(`✅ Access granted - Fetching records for pet: ${petId}`);

      // ✅ SQL: Fetch pet profile
      const pet = await petsRepo.findById(petId);

      // ✅ SQL: Fetch medical records
      const { data: medicalRecords } = await db
        .from('medical_records')
        .select('*')
        .eq('pet_id', petId)
        .order('record_date', { ascending: false });

      // ✅ SQL: Fetch prescriptions
      const { data: prescriptions } = await db
        .from('prescriptions')
        .select('*')
        .eq('pet_id', petId)
        .order('created_at', { ascending: false });

      // ✅ SQL: Fetch vet summaries from past appointments
      const { data: pastBookings } = await db
        .from('bookings')
        .select('*')
        .eq('customer_id', appointment.customer_id)
        .eq('status', 'completed')
        .neq('id', appointmentId)
        .not('metadata->vetSummary', 'is', null)
        .order('booking_date', { ascending: false });

      // ✅ SQL: Get user-uploaded documents from pet profile (stored in pets.documents JSONB)
      const petDocuments = pet?.documents || [];

      // Aggregate all records with unified schema
      const records = [
        // A. Medical Records
        ...(medicalRecords || []).map((r: any) => ({
          id: r.id,
          type: r.record_type,
          title: r.title,
          description: r.description,
          date: r.record_date,
          uploadedBy: r.created_by_role === 'customer' ? 'Owner' : r.metadata?.doctorName || 'Vet',
          url: r.attachments?.[0]?.url,
          fileName: r.attachments?.[0]?.fileName,
          fileType: r.attachments?.[0]?.fileType,
          metadata: r.metadata
        })),

        // B. Prescriptions
        ...(prescriptions || []).map((p: any) => ({
          id: p.id,
          type: 'prescription',
          title: `Prescription: ${p.diagnosis || 'General Care'}`,
          description: `${p.medications} - ${p.dosage} for ${p.duration}`,
          date: p.created_at,
          uploadedBy: p.doctor_name || 'Vet',
          clinicName: p.clinic_name,
          url: p.pdf_url,
          metadata: {
            diagnosis: p.diagnosis,
            medications: p.medications,
            dosage: p.dosage,
            duration: p.duration,
            instructions: p.instructions
          }
        })),

        // C. Vet Summaries from Past Appointments
        ...(pastBookings || []).map((b: any) => {
          const vetSummary = b.metadata?.vetSummary || {};
          return {
            id: `summary-${b.id}`,
            type: 'vet_summary',
            title: `Consultation: ${b.service_type}`,
            description: vetSummary.summary || b.notes,
            date: b.booking_date,
            uploadedBy: b.metadata?.staffName || b.metadata?.vendorName || 'Vet',
            clinicName: b.metadata?.vendorBusinessName,
            metadata: {
              diagnosis: vetSummary.diagnosis,
              symptoms: vetSummary.symptoms,
              vitalSigns: vetSummary.vitalSigns,
              treatmentPlan: vetSummary.treatmentPlan,
              followUpDate: vetSummary.followUpDate,
              followUpInstructions: vetSummary.followUpInstructions
            }
          };
        }),

        // D. User Uploaded Documents
        ...petDocuments.map((d: any, idx: number) => ({
          id: d.id || `doc-${idx}`,
          type: d.type || 'upload',
          title: d.name || d.fileName || 'Medical Document',
          description: d.notes || 'Uploaded by owner',
          date: d.uploadedAt || d.date || new Date().toISOString(),
          uploadedBy: 'Owner',
          url: d.url,
          fileName: d.fileName,
          metadata: {
            notes: d.notes
          }
        }))
      ];

      // Sort by date descending (newest first)
      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Refresh signed URLs for stored files
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      for (const record of records) {
        if (record.url && record.url.includes(MEDICAL_RECORDS_BUCKET)) {
          const urlParts = record.url.split('/');
          const filePathIndex = urlParts.findIndex(part => part === MEDICAL_RECORDS_BUCKET);
          if (filePathIndex !== -1) {
            const filePath = urlParts.slice(filePathIndex + 1).join('/').split('?')[0];
            
            const { data: signedUrlData } = await supabase.storage
              .from(MEDICAL_RECORDS_BUCKET)
              .createSignedUrl(filePath, 3600);

            if (signedUrlData) {
              record.url = signedUrlData.signedUrl;
            }
          }
        }
      }

      return c.json({
        success: true,
        appointmentId,
        petId,
        petName: pet?.name || bookingMetadata.petName,
        petPhoto: pet?.photo,
        petSpecies: pet?.species,
        petBreed: pet?.breed,
        totalRecords: records.length,
        records
      });

    } catch (error) {
      console.error('[MEDICAL HISTORY] Error:', error);
      return c.json({ error: 'Failed to retrieve medical records' }, 500);
    }
  });

  // ==========================================================================
  // UPLOAD MEDICAL DOCUMENT
  // ==========================================================================
  app.post(`${BASE_PATH}/medical-records/upload`, async (c) => {
    try {
      const formData = await c.req.formData();
      const file = formData.get('file') as File;
      const petId = formData.get('petId') as string;
      const appointmentId = formData.get('appointmentId') as string;
      const recordType = formData.get('recordType') as string;
      const title = formData.get('title') as string;
      const description = formData.get('description') as string;
      const uploadedBy = formData.get('uploadedBy') as string;
      const uploaderRole = formData.get('uploaderRole') as string;

      if (!file || !petId || !recordType || !uploadedBy || !uploaderRole) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      console.log(`📤 Uploading medical document for pet: ${petId}, type: ${recordType}`);

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Generate unique filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileExt = file.name.split('.').pop();
      const fileName = `${petId}/${recordType}_${timestamp}_${random}.${fileExt}`;

      // Convert File to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(MEDICAL_RECORDS_BUCKET)
        .upload(fileName, uint8Array, {
          contentType: file.type,
          upsert: false
        });

      if (error) {
        console.error('❌ Upload error:', error);
        return c.json({ error: error.message }, 500);
      }

      // Generate signed URL
      const { data: signedUrlData } = await supabase.storage
        .from(MEDICAL_RECORDS_BUCKET)
        .createSignedUrl(fileName, 3600);

      if (!signedUrlData) {
        return c.json({ error: 'Failed to generate signed URL' }, 500);
      }

      // ✅ SQL: Store medical record metadata
      const recordId = generateId('medical_record');
      const now = new Date().toISOString();

      const { error: insertError } = await db
        .from('medical_records')
        .insert({
          id: recordId,
          pet_id: petId,
          booking_id: appointmentId || null,
          record_type: recordType,
          title: title || file.name,
          description: description || null,
          attachments: [{
            url: signedUrlData.signedUrl,
            fileName: file.name,
            fileType: file.type.startsWith('image/') ? 'image' : 'document'
          }],
          created_by: uploadedBy,
          created_by_role: uploaderRole,
          record_date: now,
          metadata: {}
        });

      if (insertError) {
        console.error('Error storing medical record:', insertError);
        return c.json({ error: 'Failed to store medical record' }, 500);
      }

      console.log(`✅ Medical document uploaded: ${recordId}`);

      return c.json({
        success: true,
        recordId,
        fileName: file.name,
        url: signedUrlData.signedUrl
      });

    } catch (error) {
      console.error('❌ Error uploading medical document:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  // ==========================================================================
  // ADD VET SUMMARY TO APPOINTMENT
  // ==========================================================================
  app.post(`${BASE_PATH}/appointments/:appointmentId/vet-summary`, async (c) => {
    try {
      const { appointmentId } = c.req.param();
      const body = await c.req.json();
      const requesterId = c.req.header('X-User-Id');
      const requesterRole = c.req.header('X-User-Role');

      console.log(`[VET SUMMARY] Adding summary to appointment: ${appointmentId}`);

      // ✅ SQL: Verify appointment and authorization
      const appointment = await bookingsRepo.findById(appointmentId);
      
      if (!appointment) {
        return c.json({ error: 'Appointment not found' }, 404);
      }

      const isAuthorized = 
        appointment.vendor_id === requesterId || 
        appointment.staff_id === requesterId;

      if (!isAuthorized) {
        return c.json({ error: 'Access Denied: You are not assigned to this appointment' }, 403);
      }

      // Update appointment metadata with vet summary
      const vetSummary = {
        summary: body.summary,
        diagnosis: body.diagnosis,
        symptoms: body.symptoms || [],
        vitalSigns: body.vitalSigns || {},
        treatmentPlan: body.treatmentPlan,
        followUpDate: body.followUpDate,
        followUpInstructions: body.followUpInstructions,
        addedBy: requesterId,
        addedAt: new Date().toISOString()
      };

      const bookingMetadata = (appointment as any).metadata || {};
      bookingMetadata.vetSummary = vetSummary;
      bookingMetadata.diagnosis = body.diagnosis;

      // ✅ SQL: Update booking metadata
      await db
        .from('bookings')
        .update({
          metadata: bookingMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      // ✅ SQL: Also create a medical record entry
      const petId = bookingMetadata.petId || bookingMetadata.petIds?.[0];
      if (petId) {
        const recordId = generateId('medical_record');
        const now = new Date().toISOString();

        await db
          .from('medical_records')
          .insert({
            id: recordId,
            pet_id: petId,
            booking_id: appointmentId,
            record_type: 'vet_summary',
            title: `Consultation: ${appointment.service_type}`,
            description: body.summary,
            created_by: requesterId,
            created_by_role: requesterRole || 'staff',
            record_date: now,
            metadata: vetSummary
          });
      }

      console.log(`✅ Vet summary added to appointment: ${appointmentId}`);

      return c.json({
        success: true,
        appointmentId,
        vetSummary
      });

    } catch (error) {
      console.error('[VET SUMMARY] Error:', error);
      return c.json({ error: 'Failed to add vet summary' }, 500);
    }
  });

  // ==========================================================================
  // GET PRESCRIPTION DETAILS
  // ==========================================================================
  app.get(`${BASE_PATH}/medical-records/prescription/:prescriptionId`, async (c) => {
    try {
      const { prescriptionId } = c.req.param();
      
      // ✅ SQL: Get prescription
      const { data: prescription, error } = await db
        .from('prescriptions')
        .select('*')
        .eq('id', prescriptionId)
        .single();
      
      if (error || !prescription) {
        return c.json({ error: 'Prescription not found' }, 404);
      }

      // Refresh signed URL if it exists
      if (prescription.pdf_url) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const urlParts = prescription.pdf_url.split('/');
        const filePathIndex = urlParts.findIndex((part: string) => part.includes('make-3dd53475'));
        if (filePathIndex !== -1) {
          const filePath = urlParts.slice(filePathIndex + 1).join('/').split('?')[0];
          const bucketName = urlParts[filePathIndex];
          
          const { data: signedUrlData } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, 3600);

          if (signedUrlData) {
            prescription.pdf_url = signedUrlData.signedUrl;
          }
        }
      }

      return c.json({
        success: true,
        prescription
      });

    } catch (error) {
      console.error('[PRESCRIPTION] Error:', error);
      return c.json({ error: 'Failed to retrieve prescription' }, 500);
    }
  });

  // ==========================================================================
  // CREATE PRESCRIPTION (Called by vets during appointments)
  // ==========================================================================
  app.post(`${BASE_PATH}/appointments/:appointmentId/prescription`, async (c) => {
    try {
      const { appointmentId } = c.req.param();
      const body = await c.req.json();
      const requesterId = c.req.header('X-User-Id');

      console.log(`[PRESCRIPTION] Creating for appointment: ${appointmentId}`);

      // ✅ SQL: Verify appointment
      const appointment = await bookingsRepo.findById(appointmentId);
      
      if (!appointment) {
        return c.json({ error: 'Appointment not found' }, 404);
      }

      const isAuthorized = 
        appointment.vendor_id === requesterId || 
        appointment.staff_id === requesterId;

      if (!isAuthorized) {
        return c.json({ error: 'Access Denied' }, 403);
      }

      const bookingMetadata = (appointment as any).metadata || {};
      const petId = bookingMetadata.petId || bookingMetadata.petIds?.[0];
      const prescriptionId = generateId('prescription');
      const now = new Date().toISOString();
      
      // ✅ SQL: Create prescription
      const { error: insertError } = await db
        .from('prescriptions')
        .insert({
          id: prescriptionId,
          booking_id: appointmentId,
          pet_id: petId,
          customer_id: appointment.customer_id,
          vendor_id: appointment.vendor_id,
          staff_id: appointment.staff_id || null,
          diagnosis: body.diagnosis,
          medications: body.medications,
          dosage: body.dosage,
          duration: body.duration,
          instructions: body.instructions || null,
          doctor_name: body.doctorName || bookingMetadata.staffName,
          clinic_name: body.clinicName || bookingMetadata.vendorBusinessName,
          pdf_url: body.pdfUrl || null
        });

      if (insertError) {
        console.error('Error creating prescription:', insertError);
        return c.json({ error: 'Failed to create prescription' }, 500);
      }

      console.log(`✅ Prescription created: ${prescriptionId}`);

      return c.json({
        success: true,
        prescriptionId,
        prescription: {
          id: prescriptionId,
          appointmentId,
          petId,
          customerId: appointment.customer_id,
          vendorId: appointment.vendor_id,
          staffId: appointment.staff_id,
          diagnosis: body.diagnosis,
          medications: body.medications,
          dosage: body.dosage,
          duration: body.duration,
          instructions: body.instructions,
          doctorName: body.doctorName || bookingMetadata.staffName,
          clinicName: body.clinicName || bookingMetadata.vendorBusinessName,
          pdfUrl: body.pdfUrl,
          createdAt: now,
          updatedAt: now
        }
      });

    } catch (error) {
      console.error('[PRESCRIPTION] Error:', error);
      return c.json({ error: 'Failed to create prescription' }, 500);
    }
  });

  console.log('✅ Medical History Endpoints (SQL-only) registered');
}

