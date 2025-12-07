import { Hono } from "npm:hono";
import * as kv from './kv_store.tsx';

export function registerMedicalHistoryEndpoints(app: Hono) {
  // Helper to get pet medical history with STRICT access control
  app.get("/make-server-3dd53475/pet/:petId/medical-history", async (c) => {
    try {
      const { petId } = c.req.param();
      const bookingId = c.req.query('bookingId');

      console.log(`[MEDICAL HISTORY] Fetching for pet: ${petId}, booking: ${bookingId}`);

      if (!bookingId) {
        return c.json({ error: 'Access Denied: Appointment context required' }, 403);
      }

      // 🔒 SECURITY CHECK: Verify Booking Context
      // 1. Does booking exist?
      // 2. Is it for this pet?
      // 3. Is the requester (vendor/staff) associated with this booking? 
      // (Implicitly trusted here if they have the valid bookingId, but we verify the link)
      
      const currentBooking = await kv.get(`booking:${bookingId}`);
      
      if (!currentBooking) {
        return c.json({ error: 'Access Denied: Invalid appointment' }, 403);
      }

      if (currentBooking.petId !== petId) {
        return c.json({ error: 'Access Denied: Pet mismatch' }, 403);
      }

      // ✅ Valid Context Established. Proceed to fetch data.

      // 1. Fetch existing prescriptions for this pet
      const allPrescriptions = await kv.getByPrefix('prescription:');
      const petPrescriptions = allPrescriptions.filter((p: any) => p.petId === petId);

      // 2. Fetch documents uploaded to pet profile (User Uploads)
      const petProfile = await kv.get(`pet:${petId}`);
      const petDocuments = petProfile?.documents || []; // e.g. Lab reports, X-rays uploaded by user

      // 3. Fetch past booking notes/summaries (Vet Consultation Summaries)
      // We scan all bookings to find past history for this pet
      const allBookings = await kv.getByPrefix('booking:');
      const pastBookings = allBookings.filter((b: any) => 
        b.petId === petId && 
        b.status === 'completed' &&
        b.id !== bookingId && // Exclude current booking from "history"
        (b.notes || b.diagnosis || b.prescriptionUrl)
      );

      // Combine into unified records with standardized schema
      const records = [
        // A. Prescriptions (Structured Data)
        ...petPrescriptions.map((p: any) => ({
          id: p.id,
          type: 'prescription',
          title: `Prescription: ${p.diagnosis || 'General Care'}`,
          description: `Meds: ${p.medications}. Dosage: ${p.dosage}`,
          date: p.createdAt,
          doctorName: p.doctorName || p.uploadedBy,
          clinicName: p.clinicName,
          url: p.pdfUrl,
          metadata: { 
            diagnosis: p.diagnosis,
            medications: p.medications
          }
        })),

        // B. User Uploaded Documents
        ...petDocuments.map((d: any, idx: number) => ({
          id: d.id || `doc-${idx}`,
          type: d.type === 'vaccination' ? 'vaccination' : 'lab_report',
          title: d.name || d.fileName || 'Medical Document',
          description: d.notes || 'Uploaded by owner',
          date: d.uploadedAt || d.date || new Date().toISOString(),
          url: d.url,
          metadata: {
            uploadedBy: 'Owner'
          }
        })),

        // C. Previous Consultation Summaries
        ...pastBookings.map((b: any) => ({
          id: `visit-${b.id}`,
          type: 'consultation_note',
          title: `Consultation: ${b.serviceName}`,
          description: `Diagnosis: ${b.diagnosis || 'Not recorded'}. Notes: ${b.notes || 'None'}`,
          date: b.date,
          doctorName: b.staffName || b.vendorName,
          clinicName: b.vendorBusinessName,
          url: null, // Text-only record unless PDF was generated
          metadata: {
            serviceType: b.serviceType,
            symptoms: b.metadata?.symptoms
          }
        }))
      ];

      // Sort by date descending (newest first)
      records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return c.json({
        success: true,
        petName: petProfile?.name || currentBooking.petName,
        records
      });

    } catch (error) {
      console.error('[MEDICAL HISTORY] Error:', error);
      return c.json({ error: 'Failed to retrieve medical records' }, 500);
    }
  });
}
