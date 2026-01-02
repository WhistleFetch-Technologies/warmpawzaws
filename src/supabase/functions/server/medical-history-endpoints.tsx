// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// ✅ S3 MIGRATION: Supabase Storage replaced with AWS S3
import { Hono } from "hono";
import { getS3Helper } from '../../../supabase/lib/storage/s3-helper';
import {
  getBookingsRepository,
  getPetsRepository,
  getPrescriptionsRepository
} from '../../../supabase/lib/repositories/index';
import { getDbClient } from '../../../supabase/lib/db';

export function registerMedicalHistoryEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  
  // S3 bucket is configured via PlatformSettingsRepository

  // ==========================================================================
  // GET MEDICAL HISTORY BY APPOINTMENT (WITH STRICT ACCESS CONTROL)
  // ==========================================================================
  app.get(`${BASE_PATH}/appointments/:appointmentId/medical-records`, async (c) => {
    try {
      const { appointmentId } = c.req.param();
      const requesterId = c.req.header('X-User-Id'); // Vendor/Staff ID
      const requesterRole = c.req.header('X-User-Role'); // 'vendor' | 'staff'

      console.log(`[MEDICAL HISTORY] Request for appointment: ${appointmentId} by ${requesterRole}: ${requesterId}`);

      // ✅ SQL: 🔒 SECURITY CHECK 1: Verify appointment exists
      const bookingsRepo = getBookingsRepository();
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
      const vendorId = appointment.vendor_id || appointment.vendorId;
      const staffId = appointment.staff_id || appointment.staffId;
      const isAuthorized = 
        vendorId === requesterId || 
        staffId === requesterId;

      if (!isAuthorized) {
        console.log(`❌ Unauthorized access attempt by ${requesterId} to appointment ${appointmentId}`);
        return c.json({ error: 'Access Denied: You are not assigned to this appointment' }, 403);
      }

      // ✅ Authorization passed - fetch medical records
      const petId = appointment.pet_ids?.[0] || appointment.petIds?.[0] || appointment.pet_id || appointment.petId;
      
      if (!petId) {
        return c.json({ error: 'No pet associated with this appointment' }, 400);
      }

      console.log(`✅ Access granted - Fetching records for pet: ${petId}`);

      // ✅ SQL: Fetch pet profile
      const petsRepo = getPetsRepository();
      const petProfile = await petsRepo.findById(petId);

      // ✅ SQL: 1. Fetch medical records
      const db = getDbClient();
      const { data: allMedicalRecords } = await db
        .from('medical_records')
        .select('*')
        .eq('pet_id', petId);
      const petMedicalRecords = allMedicalRecords || [];

      // ✅ SQL: 2. Fetch prescriptions
      const prescriptionsRepo = getPrescriptionsRepository();
      const petPrescriptions = await prescriptionsRepo.findByPet(petId);

      // ✅ SQL: 3. Fetch vet summaries from past appointments
      const pastBookings = await bookingsRepo.findByPet(petId);
      const pastBookingsWithSummaries = pastBookings.filter((b: any) => 
        b.id !== appointmentId && // Exclude current appointment
        b.status === 'completed' &&
        (b.vet_summary || b.vetSummary || b.diagnosis || b.notes)
      );

      // 4. User-uploaded documents from pet profile
      const petDocuments = petProfile?.documents || [];

      // Aggregate all records with unified schema
      const records = [
        // A. Medical Records
        ...petMedicalRecords.map((r: any) => ({
          id: r.id,
          type: r.record_type || r.recordType,
          title: r.title,
          description: r.description,
          date: r.upload_date || r.uploadDate,
          uploadedBy: (r.uploader_role || r.uploaderRole) === 'customer' ? 'Owner' : (r.metadata?.doctorName || 'Vet'),
          url: r.file_url || r.fileUrl,
          fileName: r.file_name || r.fileName,
          fileType: r.file_type || r.fileType,
          metadata: r.metadata
        })),

        // B. Prescriptions
        ...petPrescriptions.map((p: any) => ({
          id: p.id,
          type: 'prescription',
          title: `Prescription: ${p.diagnosis || 'General Care'}`,
          description: `${p.medications} - ${p.dosage} for ${p.duration}`,
          date: p.created_at || p.createdAt,
          uploadedBy: p.doctor_name || p.doctorName || 'Vet',
          clinicName: p.clinic_name || p.clinicName,
          url: p.pdf_url || p.pdfUrl,
          metadata: {
            diagnosis: p.diagnosis,
            medications: p.medications,
            dosage: p.dosage,
            duration: p.duration,
            instructions: p.instructions
          }
        })),

        // C. Vet Summaries from Past Appointments
        ...pastBookingsWithSummaries.map((b: any) => ({
          id: `summary-${b.id}`,
          type: 'vet_summary',
          title: `Consultation: ${b.service_name || b.serviceName}`,
          description: (b.vet_summary?.summary || b.vetSummary?.summary) || b.diagnosis || b.notes,
          date: b.scheduled_date || b.scheduledDate,
          uploadedBy: b.staff_name || b.staffName || b.vendor_name || b.vendorName || 'Vet',
          clinicName: b.vendor_business_name || b.vendorBusinessName,
          metadata: {
            diagnosis: b.diagnosis,
            symptoms: (b.vet_summary?.symptoms || b.vetSummary?.symptoms),
            vitalSigns: (b.vet_summary?.vital_signs || b.vetSummary?.vitalSigns),
            treatmentPlan: (b.vet_summary?.treatment_plan || b.vetSummary?.treatmentPlan),
            followUpDate: (b.vet_summary?.follow_up_date || b.vetSummary?.followUpDate),
            followUpInstructions: (b.vet_summary?.follow_up_instructions || b.vetSummary?.followUpInstructions)
          }
        })),

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

      // ✅ S3: Refresh signed URLs for stored files (ensure they're not expired)
      const s3 = getS3Helper();
      for (const record of records) {
        if (record.url && (record.url.includes('medical-records') || record.fileName)) {
          // Extract S3 key from URL or use fileName
          let s3Key = '';
          if (record.url.includes('medical-records/')) {
            const urlParts = record.url.split('medical-records/');
            s3Key = urlParts[1]?.split('?')[0] || '';
          } else if (record.fileName) {
            s3Key = `medical-records/${record.fileName}`;
          }
          
          if (s3Key) {
            try {
              const signedUrl = await s3.getSignedUrl(s3Key, 3600);
              record.url = signedUrl;
            } catch (err) {
              console.warn('Warning: Could not refresh URL for', s3Key);
            }
          }
        }
      }

      return c.json({
        success: true,
        appointmentId,
        petId,
        petName: petProfile?.name || appointment.pet_name || appointment.petName,
        petPhoto: petProfile?.profile_photo_url || petProfile?.profilePhoto,
        petSpecies: petProfile?.species,
        petBreed: petProfile?.breed,
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

      // ✅ S3: Generate unique filename and upload
      const s3 = getS3Helper();
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(7);
      const fileExt = file.name.split('.').pop() || 'bin';
      const s3Key = `medical-records/${petId}/${recordType}_${timestamp}_${random}.${fileExt}`;

      // Convert File to Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload to S3
      const uploadResult = await s3.uploadFile(s3Key, buffer, {
        contentType: file.type,
        acl: 'private',
      });

      // ✅ SQL: Store medical record metadata
      const db = getDbClient();
      const recordId = generateId('medical_record');
      await db
        .from('medical_records')
        .insert({
          id: recordId,
          pet_id: petId,
          appointment_id: appointmentId || null,
          record_type: recordType,
          title: title || file.name,
          description: description || null,
          file_url: uploadResult.signedUrl || uploadResult.url,
          file_path: s3Key,
          file_name: file.name,
          file_type: file.type.startsWith('image/') ? 'image' : 'document',
          uploaded_by: uploadedBy,
          uploader_role: uploaderRole,
          upload_date: new Date().toISOString(),
          metadata: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      console.log(`✅ Medical document uploaded: ${recordId}`);

      return c.json({
        success: true,
        recordId,
        fileName: file.name,
        key: s3Key,
        url: uploadResult.signedUrl || uploadResult.url
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

      // ✅ SQL: 🔒 SECURITY CHECK: Verify appointment and authorization
      const bookingsRepo = getBookingsRepository();
      const appointment = await bookingsRepo.findById(appointmentId);
      
      if (!appointment) {
        return c.json({ error: 'Appointment not found' }, 404);
      }

      const vendorId = appointment.vendor_id || appointment.vendorId;
      const staffId = appointment.staff_id || appointment.staffId;
      const isAuthorized = 
        vendorId === requesterId || 
        staffId === requesterId;

      if (!isAuthorized) {
        return c.json({ error: 'Access Denied: You are not assigned to this appointment' }, 403);
      }

      // Update appointment with vet summary
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

      // ✅ SQL: Update appointment with vet summary
      await bookingsRepo.update(appointmentId, {
        vet_summary: vetSummary,
        diagnosis: body.diagnosis,
        updated_at: new Date().toISOString()
      });

      // ✅ SQL: Also create a medical record entry for searchability
      const petId = appointment.pet_ids?.[0] || appointment.petIds?.[0] || appointment.pet_id || appointment.petId;
      if (petId) {
        const db = getDbClient();
        const recordId = generateId('medical_record');
        await db
          .from('medical_records')
          .insert({
            id: recordId,
            pet_id: petId,
            appointment_id: appointmentId,
            record_type: 'vet_summary',
            title: `Consultation: ${appointment.service_name || appointment.serviceName}`,
            description: body.summary,
            uploaded_by: requesterId,
            uploader_role: requesterRole,
            upload_date: new Date().toISOString(),
            metadata: vetSummary,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
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
      const prescriptionsRepo = getPrescriptionsRepository();
      const prescription = await prescriptionsRepo.findById(prescriptionId);
      
      if (!prescription) {
        return c.json({ error: 'Prescription not found' }, 404);
      }

      // ✅ S3: Refresh signed URL if it exists
      if (prescription.pdfUrl || prescription.pdf_url) {
        const s3 = getS3Helper();
        const pdfUrl = prescription.pdf_url || prescription.pdfUrl;
        
        if (pdfUrl) {
          // Extract S3 key from URL
          let s3Key = '';
          if (pdfUrl.includes('medical-records/')) {
            const urlParts = pdfUrl.split('medical-records/');
            s3Key = urlParts[1]?.split('?')[0] || '';
            if (s3Key) {
              s3Key = `medical-records/${s3Key}`;
            }
          } else if (prescription.file_path) {
            s3Key = prescription.file_path;
          }
          
          if (s3Key) {
            try {
              const signedUrl = await s3.getSignedUrl(s3Key, 3600);
              prescription.pdfUrl = signedUrl;
              prescription.pdf_url = signedUrl;
            } catch (err) {
              console.warn('Warning: Could not refresh prescription PDF URL', s3Key);
            }
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
      const bookingsRepo = getBookingsRepository();
      const appointment = await bookingsRepo.findById(appointmentId);
      
      if (!appointment) {
        return c.json({ error: 'Appointment not found' }, 404);
      }

      const vendorId = appointment.vendor_id || appointment.vendorId;
      const staffId = appointment.staff_id || appointment.staffId;
      const isAuthorized = 
        vendorId === requesterId || 
        staffId === requesterId;

      if (!isAuthorized) {
        return c.json({ error: 'Access Denied' }, 403);
      }

      const petId = appointment.pet_ids?.[0] || appointment.petIds?.[0] || appointment.pet_id || appointment.petId;
      const prescriptionId = generateId('prescription');
      
      // ✅ SQL: Create prescription
      const prescriptionsRepo = getPrescriptionsRepository();
      await prescriptionsRepo.create({
        id: prescriptionId,
        appointment_id: appointmentId,
        pet_id: petId,
        customer_id: appointment.customer_id || appointment.customerId,
        vendor_id: appointment.vendor_id || appointment.vendorId,
        staff_id: appointment.staff_id || appointment.staffId,
        diagnosis: body.diagnosis,
        medications: body.medications,
        dosage: body.dosage,
        duration: body.duration,
        instructions: body.instructions,
        doctor_name: body.doctorName || appointment.staff_name || appointment.staffName,
        clinic_name: body.clinicName || appointment.vendor_business_name || appointment.vendorBusinessName,
        pdf_url: body.pdfUrl || null, // If PDF was generated
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
      const prescription = await prescriptionsRepo.findById(prescriptionId);

      console.log(`✅ Prescription created: ${prescriptionId}`);

      return c.json({
        success: true,
        prescriptionId,
        prescription
      });

    } catch (error) {
      console.error('[PRESCRIPTION] Error:', error);
      return c.json({ error: 'Failed to create prescription' }, 500);
    }
  });
}