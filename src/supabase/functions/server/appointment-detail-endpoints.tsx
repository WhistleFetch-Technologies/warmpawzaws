import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

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
    // 1. Create prescription object and store in KV store
    const prescriptionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const prescriptionKey = `prescription:${bookingId}:${prescriptionId}`;
    
    const prescription = {
      id: prescriptionId,
      booking_id: bookingId,
      vendor_id: vendorId,
      vendor_name: vendorName || 'Vendor',
      diagnosis: diagnosis || null,
      medications,
      dosage: dosage || null,
      frequency: frequency || 'Once Daily',
      duration: duration || '7 days',
      notes: notes || null,
      follow_up_date: followUpDate || null,
      uploaded_at: new Date().toISOString()
    };

    await kv.set(prescriptionKey, prescription);
    console.log('✅ [PRESCRIPTION] Prescription saved:', prescriptionId);

    // 2. Update booking to mark has_prescription = true
    const bookingKey = `booking:${bookingId}`;
    const bookingData = await kv.get(bookingKey);
    
    if (bookingData) {
      bookingData.hasPrescription = true;
      bookingData.prescriptionNotes = notes || medications;
      await kv.set(bookingKey, bookingData);
      console.log('✅ [PRESCRIPTION] Updated booking with prescription flag');
    }

    // 3. Log activity
    await logBookingActivity(
      bookingId,
      'prescription',
      `${vendorName} added prescription`,
      'vendor',
      vendorName
    );

    console.log('✅ [PRESCRIPTION] Activity logged');

    // 4. Return success
    return c.json({
      success: true,
      prescriptionId: prescription.id,
      prescription: {
        id: prescription.id,
        bookingId: prescription.booking_id,
        diagnosis: prescription.diagnosis,
        medications: prescription.medications,
        dosage: prescription.dosage,
        frequency: prescription.frequency,
        duration: prescription.duration,
        notes: prescription.notes,
        followUpDate: prescription.follow_up_date,
        uploadedAt: prescription.uploaded_at
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
// ============================================
app.get('/make-server-3dd53475/vendor/prescription/:bookingId', async (c) => {
  const bookingId = c.req.param('bookingId');
  
  console.log('💊 [PRESCRIPTION] Loading prescription for booking:', bookingId);

  try {
    // Load prescriptions from KV store
    const prescriptionPrefix = `prescription:${bookingId}:`;
    const prescriptionsData = await kv.getByPrefix(prescriptionPrefix);
    
    // Sort prescriptions by uploaded_at (newest first) and get the most recent
    const sortedPrescriptions = prescriptionsData.sort((a, b) => {
      const timeA = new Date(a.uploaded_at).getTime();
      const timeB = new Date(b.uploaded_at).getTime();
      return timeB - timeA;
    });

    const prescription = sortedPrescriptions[0];

    if (!prescription) {
      console.log('ℹ️ [PRESCRIPTION] No prescription found for booking:', bookingId);
      return c.json({ 
        prescription: null,
        message: 'No prescription found'
      });
    }

    console.log('✅ [PRESCRIPTION] Found prescription:', prescription.id);

    return c.json({
      prescription: {
        id: prescription.id,
        bookingId: prescription.booking_id,
        diagnosis: prescription.diagnosis,
        medications: prescription.medications,
        dosage: prescription.dosage,
        frequency: prescription.frequency,
        duration: prescription.duration,
        notes: prescription.notes,
        followUpDate: prescription.follow_up_date,
        uploadedAt: prescription.uploaded_at,
        uploadedBy: prescription.vendor_name
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