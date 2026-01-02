// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
// ✅ Lambda Compatibility: Removed Deno.env.get() references
import { Hono } from "hono";
import { 
  getBookingsRepository,
  getPrescriptionsRepository,
  getDbClient
} from '../../../supabase/lib/repositories/index';

const app = new Hono();

// ============================================
// HELPER FUNCTION: Log Booking Activity
// ============================================
// ✅ SQL: Log booking activity in booking_activities table
async function logBookingActivity(
  bookingId: string,
  type: string,
  description: string,
  actor: string,
  actorName: string
) {
  try {
    const db = getDbClient();
    const activityId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await db
      .from('booking_activities')
      .insert({
        id: activityId,
        booking_id: bookingId,
        activity_type: type,
        description,
        actor_type: actor,
        actor_name: actorName,
        created_at: new Date().toISOString()
      });
    
    console.log('✅ [ACTIVITY] Logged activity:', activityId);
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
    // ✅ SQL: 1. Load booking details from bookings table
    const bookingsRepo = getBookingsRepository();
    const bookingData = await bookingsRepo.findById(bookingId);
    
    if (!bookingData) {
      console.error('❌ [APPOINTMENT-DETAIL] Booking not found:', bookingId);
      return c.json({ error: 'Booking not found' }, 404);
    }

    console.log('📦 [APPOINTMENT-DETAIL] Found booking:', bookingData);

    // ✅ SQL: 2. Load activities from booking_activities table
    const db = getDbClient();
    const { data: activitiesData } = await db
      .from('booking_activities')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false });
    
    const activities = (activitiesData || []).map((a: any) => ({
      id: a.id,
      type: a.activity_type,
      description: a.description,
      actor: a.actor_type,
      actor_name: a.actor_name,
      timestamp: a.created_at
    }));

    console.log(`📝 [APPOINTMENT-DETAIL] Loaded ${activities.length} activities`);

    // ✅ SQL: 3. Load prescriptions from prescriptions table
    const prescriptionsRepo = getPrescriptionsRepository();
    const prescriptionsData = await prescriptionsRepo.getByBookingId(bookingId, bookingData.customer_id, 'customer');

    console.log(`💊 [APPOINTMENT-DETAIL] Loaded ${prescriptionsData.length} prescriptions`);

    // ✅ SQL: 4. If this is a follow-up, load parent booking data
    let parentBooking = null;
    if (bookingData.metadata?.isFollowUp && bookingData.metadata?.parentBookingId) {
      parentBooking = await bookingsRepo.findById(bookingData.metadata.parentBookingId);
      console.log('🔗 [APPOINTMENT-DETAIL] Loaded parent booking:', parentBooking);
    }

    // 5. Format booking data (map SQL fields to API response format)
    const booking = {
      id: bookingData.id || bookingId,
      time: bookingData.booking_time || '10:00 AM',
      date: bookingData.booking_date,
      customerName: bookingData.metadata?.customerName,
      customerPhone: bookingData.metadata?.customerPhone,
      petName: bookingData.metadata?.petName,
      petType: bookingData.metadata?.petType,
      petBreed: bookingData.metadata?.petBreed || 'Unknown',
      petAge: bookingData.metadata?.petAge || 'Unknown',
      location: bookingData.address || bookingData.metadata?.location,
      serviceType: bookingData.service_type,
      serviceName: bookingData.metadata?.serviceName,
      status: bookingData.status,
      price: bookingData.total_amount || 0,
      duration: bookingData.metadata?.duration || 30,
      createdAt: bookingData.created_at,
      updatedAt: bookingData.updated_at || bookingData.created_at,
      isFollowUp: bookingData.metadata?.isFollowUp || false,
      parentBookingId: bookingData.metadata?.parentBookingId || null,
      hasPrescription: (prescriptionsData?.length || 0) > 0,
      communicationType: bookingData.metadata?.communicationType
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
    const formattedPrescriptions = prescriptionsData.map(prescription => ({
      id: prescription.id,
      bookingId: prescription.booking_id,
      notes: prescription.general_notes,
      medications: prescription.medications,
      dosage: prescription.medications?.[0]?.dosage,
      frequency: prescription.medications?.[0]?.frequency,
      duration: prescription.medications?.[0]?.duration,
      diagnosis: prescription.diagnosis,
      followUpDate: prescription.follow_up_date,
      uploadedAt: prescription.created_at,
      uploadedBy: prescription.metadata?.vendor_name
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
    // ✅ SQL: 1. Get booking to get customer_id and pet_id
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    // ✅ SQL: 2. Create prescription in prescriptions table
    const prescriptionsRepo = getPrescriptionsRepository();
    
    // Format medications array with dosage, frequency, duration
    const medicationsArray = Array.isArray(medications) ? medications.map((med: any) => ({
      name: med.name || med,
      dosage: med.dosage || dosage,
      frequency: med.frequency || frequency,
      duration: med.duration || duration
    })) : [{
      name: medications,
      dosage: dosage,
      frequency: frequency || 'Once Daily',
      duration: duration || '7 days'
    }];

    const prescription = await prescriptionsRepo.create({
      booking_id: bookingId,
      pet_id: booking.metadata?.pet_id || '',
      customer_id: booking.customer_id,
      vendor_id: vendorId,
      staff_id: booking.staff_id || null,
      diagnosis: diagnosis || null,
      medications: medicationsArray,
      general_notes: notes || null,
      follow_up_date: followUpDate || null,
      created_by: vendorId,
      created_by_role: 'vendor'
    });

    console.log('✅ [PRESCRIPTION] Prescription saved:', prescription.id);

    // ✅ SQL: 3. Update booking metadata to mark has_prescription = true
    await bookingsRepo.update(bookingId, {
      metadata: {
        ...booking.metadata,
        hasPrescription: true,
        prescriptionNotes: notes || medications
      }
    });
    
    console.log('✅ [PRESCRIPTION] Updated booking with prescription flag');

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
    // ✅ SQL: Load prescription from prescriptions table
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }

    const prescriptionsRepo = getPrescriptionsRepository();
    const prescriptions = await prescriptionsRepo.getByBookingId(bookingId, booking.customer_id, 'customer');
    
    // Get the most recent prescription
    const prescription = prescriptions.length > 0 ? prescriptions[0] : null;

    if (!prescription) {
      console.log('ℹ️ [PRESCRIPTION] No prescription found for booking:', bookingId);
      return c.json({ 
        prescription: null,
        message: 'No prescription found'
      });
    }

    console.log('✅ [PRESCRIPTION] Found prescription:', prescription.id);

    return c.json({
      prescription: prescription ? {
        id: prescription.id,
        bookingId: prescription.booking_id,
        diagnosis: prescription.diagnosis,
        medications: prescription.medications,
        dosage: prescription.medications?.[0]?.dosage,
        frequency: prescription.medications?.[0]?.frequency,
        duration: prescription.medications?.[0]?.duration,
        notes: prescription.general_notes,
        followUpDate: prescription.follow_up_date,
        uploadedAt: prescription.created_at,
        uploadedBy: prescription.metadata?.vendor_name
      } : null
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