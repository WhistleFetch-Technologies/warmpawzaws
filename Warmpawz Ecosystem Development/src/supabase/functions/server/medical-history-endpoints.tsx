import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { ensureBucket } from "./bucket-manager.tsx";

export function registerMedicalHistoryEndpoints(app: Hono) {
  const BASE_PATH = "/make-server-3dd53475";
  
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

  // Initialize bucket (fire and forget)
  initializeMedicalRecordsBucket().catch(err => 
    console.error('❌ Bucket init error (non-critical):', err)
  );

  // ==========================================================================
  // GET MEDICAL HISTORY BY APPOINTMENT (WITH STRICT ACCESS CONTROL)
  // ==========================================================================
  app.get(`${BASE_PATH}/appointments/:appointmentId/medical-records`, async (c) => {
    try {
      const { appointmentId } = c.req.param();
      const requesterId = c.req.header('X-User-Id'); // Vendor/Staff ID
      const requesterRole = c.req.header('X-User-Role'); // 'vendor' | 'staff'

      console.log(`[MEDICAL HISTORY] Request for appointment: ${appointmentId} by ${requesterRole}: ${requesterId}`);

      // 🔒 SECURITY CHECK 1: Verify appointment exists
      const appointment = await kv.get(`booking:${appointmentId}`);
      
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
        appointment.vendorId === requesterId || 
        appointment.staffId === requesterId;

      if (!isAuthorized) {
        console.log(`❌ Unauthorized access attempt by ${requesterId} to appointment ${appointmentId}`);
        return c.json({ error: 'Access Denied: You are not assigned to this appointment' }, 403);
      }

      // ✅ Authorization passed - fetch medical records
      const petId = appointment.petIds?.[0] || appointment.petId;
      
      if (!petId) {
        return c.json({ error: 'No pet associated with this appointment' }, 400);
      }

      console.log(`✅ Access granted - Fetching records for pet: ${petId}`);

      // Fetch pet profile
      const petProfile = await kv.get(`pet:${petId}`);

      // 1. Fetch medical records from our records store
      const allMedicalRecords = await kv.getByPrefix('medical_record:');
      const petMedicalRecords = allMedicalRecords.filter((r: any) => r.petId === petId);

      // 2. Fetch prescriptions
      const allPrescriptions = await kv.getByPrefix('prescription:');
      const petPrescriptions = allPrescriptions.filter((p: any) => p.petId === petId);

      // 3. Fetch vet summaries from past appointments
      const allBookings = await kv.getByPrefix('booking:');
      const pastBookingsWithSummaries = allBookings.filter((b: any) => 
        b.petId === petId && 
        b.status === 'completed' &&
        b.id !== appointmentId && // Exclude current appointment
        (b.vetSummary || b.diagnosis || b.notes)
      );

      // 4. User-uploaded documents from pet profile
      const petDocuments = petProfile?.documents || [];

      // Aggregate all records with unified schema
      const records = [
        // A. Medical Records
        ...petMedicalRecords.map((r: any) => ({
          id: r.id,
          type: r.recordType,
          title: r.title,
          description: r.description,
          date: r.uploadDate,
          uploadedBy: r.uploaderRole === 'customer' ? 'Owner' : r.metadata?.doctorName || 'Vet',
          url: r.fileUrl,
          fileName: r.fileName,
          fileType: r.fileType,
          metadata: r.metadata
        })),

        // B. Prescriptions
        ...petPrescriptions.map((p: any) => ({
          id: p.id,
          type: 'prescription',
          title: `Prescription: ${p.diagnosis || 'General Care'}`,
          description: `${p.medications} - ${p.dosage} for ${p.duration}`,
          date: p.createdAt,
          uploadedBy: p.doctorName || 'Vet',
          clinicName: p.clinicName,
          url: p.pdfUrl,
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
          title: `Consultation: ${b.serviceName}`,
          description: b.vetSummary?.summary || b.diagnosis || b.notes,
          date: b.date || b.scheduledDate,
          uploadedBy: b.staffName || b.vendorName || 'Vet',
          clinicName: b.vendorBusinessName,
          metadata: {
            diagnosis: b.diagnosis,
            symptoms: b.vetSummary?.symptoms,
            vitalSigns: b.vetSummary?.vitalSigns,
            treatmentPlan: b.vetSummary?.treatmentPlan,
            followUpDate: b.vetSummary?.followUpDate,
            followUpInstructions: b.vetSummary?.followUpInstructions
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

      // Refresh signed URLs for stored files (ensure they're not expired)
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      for (const record of records) {
        if (record.url && record.url.includes(MEDICAL_RECORDS_BUCKET)) {
          // Extract file path from URL
          const urlParts = record.url.split('/');
          const filePathIndex = urlParts.findIndex(part => part === MEDICAL_RECORDS_BUCKET);
          if (filePathIndex !== -1) {
            const filePath = urlParts.slice(filePathIndex + 1).join('/').split('?')[0];
            
            // Generate fresh signed URL (1 hour expiry)
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
        petName: petProfile?.name || appointment.petName,
        petPhoto: petProfile?.profilePhoto,
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

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Generate unique filename organized by pet
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

      // Generate signed URL (1 hour expiry for security)
      const { data: signedUrlData } = await supabase.storage
        .from(MEDICAL_RECORDS_BUCKET)
        .createSignedUrl(fileName, 3600);

      if (!signedUrlData) {
        return c.json({ error: 'Failed to generate signed URL' }, 500);
      }

      // Store medical record metadata in KV
      const recordId = generateId('medical_record');
      const medicalRecord: MedicalRecord = {
        id: recordId,
        petId,
        appointmentId: appointmentId || undefined,
        recordType: recordType as any,
        title: title || file.name,
        description,
        fileUrl: signedUrlData.signedUrl,
        fileName: file.name,
        fileType: file.type.startsWith('image/') ? 'image' : 'document',
        uploadedBy,
        uploaderRole: uploaderRole as any,
        uploadDate: new Date().toISOString(),
        metadata: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`medical_record:${recordId}`, medicalRecord);

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

      // 🔒 SECURITY CHECK: Verify appointment and authorization
      const appointment = await kv.get(`booking:${appointmentId}`);
      
      if (!appointment) {
        return c.json({ error: 'Appointment not found' }, 404);
      }

      const isAuthorized = 
        appointment.vendorId === requesterId || 
        appointment.staffId === requesterId;

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

      appointment.vetSummary = vetSummary;
      appointment.diagnosis = body.diagnosis; // Legacy field
      appointment.updatedAt = new Date().toISOString();

      await kv.set(`booking:${appointmentId}`, appointment);

      // Also create a medical record entry for searchability
      const petId = appointment.petIds?.[0] || appointment.petId;
      if (petId) {
        const recordId = generateId('medical_record');
        const medicalRecord: MedicalRecord = {
          id: recordId,
          petId,
          appointmentId,
          recordType: 'vet_summary',
          title: `Consultation: ${appointment.serviceName}`,
          description: body.summary,
          uploadedBy: requesterId,
          uploaderRole: requesterRole as any,
          uploadDate: new Date().toISOString(),
          metadata: vetSummary,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await kv.set(`medical_record:${recordId}`, medicalRecord);
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
      
      const prescription = await kv.get(`prescription:${prescriptionId}`);
      
      if (!prescription) {
        return c.json({ error: 'Prescription not found' }, 404);
      }

      // Refresh signed URL if it exists
      if (prescription.pdfUrl) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Extract file path and refresh signed URL
        const urlParts = prescription.pdfUrl.split('/');
        const filePathIndex = urlParts.findIndex((part: string) => part.includes('make-3dd53475'));
        if (filePathIndex !== -1) {
          const filePath = urlParts.slice(filePathIndex + 1).join('/').split('?')[0];
          const bucketName = urlParts[filePathIndex];
          
          const { data: signedUrlData } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(filePath, 3600);

          if (signedUrlData) {
            prescription.pdfUrl = signedUrlData.signedUrl;
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

      // Verify appointment
      const appointment = await kv.get(`booking:${appointmentId}`);
      
      if (!appointment) {
        return c.json({ error: 'Appointment not found' }, 404);
      }

      const isAuthorized = 
        appointment.vendorId === requesterId || 
        appointment.staffId === requesterId;

      if (!isAuthorized) {
        return c.json({ error: 'Access Denied' }, 403);
      }

      const petId = appointment.petIds?.[0] || appointment.petId;
      const prescriptionId = generateId('prescription');
      
      const prescription: Prescription = {
        id: prescriptionId,
        appointmentId,
        petId,
        customerId: appointment.customerId,
        vendorId: appointment.vendorId,
        staffId: appointment.staffId,
        diagnosis: body.diagnosis,
        medications: body.medications,
        dosage: body.dosage,
        duration: body.duration,
        instructions: body.instructions,
        doctorName: body.doctorName || appointment.staffName,
        clinicName: body.clinicName || appointment.vendorBusinessName,
        pdfUrl: body.pdfUrl, // If PDF was generated
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`prescription:${prescriptionId}`, prescription);

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