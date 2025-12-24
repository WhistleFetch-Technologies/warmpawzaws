import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import { getPrescriptionsRepository } from "../../lib/repositories/prescriptions.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";

const app = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// ============================================
// HELPER FUNCTION: Log Booking Activity
// ============================================
async function logBookingActivity(
  bookingId: string,
  type: string,
  description: string,
  actor: string,
  actorName: string
) {
  try {
    // Store activity in KV store with composite key
    const activityId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const activityKey = `booking_activity:${bookingId}:${activityId}`;
    
    const activity = {
      id: activityId,
      booking_id: bookingId,
      type,
      description,
      actor,
      actor_name: actorName,
      timestamp: new Date().toISOString()
    };

    await kv.set(activityKey, activity);
    console.log('✅ [ACTIVITY] Logged activity:', activityKey);
  } catch (error) {
    console.error('❌ Error logging activity:', error);
  }
}

// ============================================
// GET /vendor/bookings/:bookingId/details
// Get complete appointment details with history and prescriptions
// ============================================
app.get('/make-server-3dd53475/vendor/bookings/:bookingId/details', async (c) => {
  const bookingId = c.req.param('bookingId');
  
  console.log('📋 [APPOINTMENT-DETAIL] Loading details for booking:', bookingId);

  try {
    // 1. Load booking details from KV store
    const bookingKey = `booking:${bookingId}`;
    const bookingData = await kv.get(bookingKey);
    
    if (!bookingData) {
      console.error('❌ [APPOINTMENT-DETAIL] Booking not found:', bookingId);
      return c.json({ error: 'Booking not found' }, 404);
    }

    console.log('📦 [APPOINTMENT-DETAIL] Found booking:', bookingData);

    // 2. Load activities from KV store
    const activityPrefix = `booking_activity:${bookingId}:`;
    const activitiesData = await kv.getByPrefix(activityPrefix);
    
    // Sort activities by timestamp (newest first)
    const activities = activitiesData.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });

    console.log(`📝 [APPOINTMENT-DETAIL] Loaded ${activities.length} activities`);

    // 3. Load prescriptions from KV store
    const prescriptionPrefix = `prescription:${bookingId}:`;
    const prescriptionsData = await kv.getByPrefix(prescriptionPrefix);
    
    // Sort prescriptions by uploaded_at (newest first)
    const prescriptions = prescriptionsData.sort((a, b) => {
      const timeA = new Date(a.uploaded_at).getTime();
      const timeB = new Date(b.uploaded_at).getTime();
      return timeB - timeA;
    });

    console.log(`💊 [APPOINTMENT-DETAIL] Loaded ${prescriptions.length} prescriptions`);

    // 4. If this is a follow-up, load parent booking data
    let parentBooking = null;
    if (bookingData.isFollowUp && bookingData.parentBookingId) {
      const parentKey = `booking:${bookingData.parentBookingId}`;
      parentBooking = await kv.get(parentKey);
      console.log('🔗 [APPOINTMENT-DETAIL] Loaded parent booking:', parentBooking);
    }

    // 5. Format booking data
    const booking = {
      id: bookingData.id || bookingId,
      time: bookingData.scheduledTime || bookingData.time || '10:00 AM',
      date: bookingData.scheduledDate || bookingData.date,
      customerName: bookingData.customerName,
      customerPhone: bookingData.customerPhone,
      petName: bookingData.petName,
      petType: bookingData.petType,
      petBreed: bookingData.petBreed || 'Unknown',
      petAge: bookingData.petAge || 'Unknown',
      location: bookingData.location || bookingData.address,
      serviceType: bookingData.serviceType,
      serviceName: bookingData.serviceName,
      status: bookingData.status,
      price: bookingData.price || 0,
      duration: bookingData.duration || 30,
      createdAt: bookingData.createdAt,
      updatedAt: bookingData.updatedAt || bookingData.createdAt,
      isFollowUp: bookingData.isFollowUp || false,
      parentBookingId: bookingData.parentBookingId || null,
      hasPrescription: (prescriptions?.length || 0) > 0,
      communicationType: bookingData.communicationType
    };

    // 6. Format activities
    const formattedActivities = (activities || []).map(activity => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      timestamp: activity.timestamp,
      actor: activity.actor_name
    }));

    // 7. Format prescriptions
    const formattedPrescriptions = (prescriptions || []).map(prescription => ({
      id: prescription.id,
      bookingId: prescription.booking_id,
      notes: prescription.notes,
      medications: prescription.medications,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      diagnosis: prescription.diagnosis,
      followUpDate: prescription.follow_up_date,
      uploadedAt: prescription.uploaded_at,
      uploadedBy: prescription.vendor_name
    }));

    // 8. Return complete data
    const response = {
      booking,
      activities: formattedActivities,
      prescriptions: formattedPrescriptions,
      parentBooking
    };

    console.log('✅ [APPOINTMENT-DETAIL] Returning complete appointment data');
    
    return c.json(response);

  } catch (error) {
    console.error('❌ [APPOINTMENT-DETAIL] Error:', error);
    return c.json({ 
      error: 'Failed to load appointment details',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============================================
// POST /vendor/prescription/upload
// Upload prescription with detailed fields
// 
// ✅ MIGRATED: Uses SQL repository instead of KV
// ============================================
app.post('/make-server-3dd53475/vendor/prescription/upload', async (c) => {
  const body = await c.req.json();
  const {
    bookingId,
    vendorId,
    vendorName,
    diagnosis,
    medications,
    dosage,
    frequency,
    duration,
    notes,
    followUpDate
  } = body;

  console.log('💊 [PRESCRIPTION] Uploading prescription for booking:', bookingId);
  console.log('📝 [PRESCRIPTION] Data:', { diagnosis, medications, dosage, frequency, duration });

  // Validation
  if (!bookingId || !vendorId || !medications) {
    console.error('❌ [PRESCRIPTION] Missing required fields');
    return c.json({ 
      error: 'Missing required fields: bookingId, vendorId, medications' 
    }, 400);
  }

  try {
    // ✅ SQL: Get booking to extract required IDs
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      console.error('❌ [PRESCRIPTION] Booking not found:', bookingId);
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // Verify vendor owns this booking
    if (booking.vendor_id !== vendorId) {
      console.error('❌ [PRESCRIPTION] Vendor mismatch');
      return c.json({ error: 'Unauthorized' }, 403);
    }
    
    // ✅ SQL: Get vendor for created_by
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      console.error('❌ [PRESCRIPTION] Vendor not found:', vendorId);
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Convert medications array format if needed
    // Handle both old format (array of strings) and new format (array of objects)
    let medicationsArray: any[] = [];
    if (Array.isArray(medications)) {
      medicationsArray = medications.map((med: any) => {
        if (typeof med === 'string') {
          return { name: med, dosage: dosage || '', frequency: frequency || 'Once Daily', duration: duration || '7 days' };
        }
        return med;
      });
    } else if (medications) {
      // Single medication object
      medicationsArray = [medications];
    }
    
    // ✅ SQL: Create prescription using repository
    const prescriptionsRepo = getPrescriptionsRepository();
    const createdBy = vendor.user_id || vendor.id;
    
    const prescription = await prescriptionsRepo.create({
      booking_id: bookingId,
      pet_id: booking.pet_id || '',
      customer_id: booking.customer_id,
      vendor_id: vendorId,
      staff_id: booking.staff_id || undefined,
      diagnosis: diagnosis || undefined,
      observations: undefined,
      medications: medicationsArray,
      products_used: [],
      tests_recommended: [],
      general_notes: notes || undefined,
      recommendations: undefined,
      follow_up_date: followUpDate || undefined,
      follow_up_reason: undefined,
      vitals: undefined,
      prescription_file_url: undefined,
      attachments: [],
      created_by: createdBy,
      created_by_role: 'vendor',
      expires_at: undefined
    });

    console.log('✅ [PRESCRIPTION] Prescription saved to SQL:', prescription.id);

    // 3. Log activity (keep KV for activity logs for now)
    await logBookingActivity(
      bookingId,
      'prescription',
      `${vendorName || vendor.business_name || 'Vendor'} added prescription`,
      'vendor',
      vendorName || vendor.business_name || 'Vendor'
    );

    console.log('✅ [PRESCRIPTION] Activity logged');

    // 4. Return success
    return c.json({
      success: true,
      prescriptionId: prescription.id,
      prescriptionNumber: prescription.prescription_number,
      prescription: {
        id: prescription.id,
        prescriptionNumber: prescription.prescription_number,
        bookingId: prescription.booking_id,
        diagnosis: prescription.diagnosis,
        medications: prescription.medications,
        generalNotes: prescription.general_notes,
        followUpDate: prescription.follow_up_date,
        createdAt: prescription.created_at
      }
    });

  } catch (error) {
    console.error('❌ [PRESCRIPTION] Error:', error);
    return c.json({ 
      error: 'Failed to upload prescription',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============================================
// GET /vendor/prescription/:bookingId
// Get prescription for a booking
// 
// ✅ MIGRATED: Uses SQL repository instead of KV
// ============================================
app.get('/make-server-3dd53475/vendor/prescription/:bookingId', async (c) => {
  const bookingId = c.req.param('bookingId');
  const actorId = c.req.query('actor_id') || '';
  const actorRole = c.req.query('actor_role') || 'vendor';
  
  console.log('💊 [PRESCRIPTION] Loading prescription for booking:', bookingId);

  try {
    // ✅ SQL: Get prescriptions by booking ID
    const prescriptionsRepo = getPrescriptionsRepository();
    const prescriptions = await prescriptionsRepo.getByBookingId(
      bookingId,
      actorId || 'system',
      actorRole as any
    );

    if (!prescriptions || prescriptions.length === 0) {
      console.log('ℹ️ [PRESCRIPTION] No prescription found for booking:', bookingId);
      return c.json({ 
        prescription: null,
        message: 'No prescription found'
      });
    }

    // Get the most recent prescription (already sorted by created_at DESC)
    const prescription = prescriptions[0];
    
    // ✅ SQL: Get vendor details
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(prescription.vendor_id);

    console.log('✅ [PRESCRIPTION] Found prescription:', prescription.id);

    return c.json({
      prescription: {
        id: prescription.id,
        prescriptionNumber: prescription.prescription_number,
        bookingId: prescription.booking_id,
        diagnosis: prescription.diagnosis,
        observations: prescription.observations,
        medications: prescription.medications,
        productsUsed: prescription.products_used,
        testsRecommended: prescription.tests_recommended,
        generalNotes: prescription.general_notes,
        recommendations: prescription.recommendations,
        followUpDate: prescription.follow_up_date,
        followUpReason: prescription.follow_up_reason,
        vitals: prescription.vitals,
        notes: prescription.general_notes,
        uploadedAt: prescription.created_at,
        uploadedBy: vendor?.business_name || vendor?.owner_name || 'Vendor'
      }
    });

  } catch (error) {
    console.error('❌ [PRESCRIPTION] Error:', error);
    return c.json({ 
      error: 'Failed to load prescription',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

// ============================================
// POST /booking-activity/log
// Log activity for a booking
// ============================================
app.post('/make-server-3dd53475/booking-activity/log', async (c) => {
  const body = await c.req.json();
  const { bookingId, type, description, actor, actorName } = body;

  console.log('📝 [ACTIVITY] Logging activity:', { bookingId, type, description });

  // Validation
  if (!bookingId || !type || !description || !actor || !actorName) {
    return c.json({ 
      error: 'Missing required fields: bookingId, type, description, actor, actorName' 
    }, 400);
  }

  try {
    await logBookingActivity(bookingId, type, description, actor, actorName);
    
    console.log('✅ [ACTIVITY] Activity logged successfully');
    
    return c.json({ success: true });

  } catch (error) {
    console.error('❌ [ACTIVITY] Error:', error);
    return c.json({ 
      error: 'Failed to log activity',
      details: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

export default app;