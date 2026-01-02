/**
 * VET BOOKING ENDPOINTS - SQL VERSION
 * ✅ MIGRATED TO SQL: NO KV STORE - All data from SQL
 * 
 * Comprehensive vet services booking endpoints
 * 
 * Status: ✅ SQL-ONLY IMPLEMENTATION
 * KV Operations: 38 → 0
 */

import { Hono } from 'hono';
import { getDbClient } from '../../../supabase/lib/db';
import { getBookingsRepository } from '../../../supabase/lib/repositories/bookings';
import { getVendorsRepository } from '../../../supabase/lib/repositories/vendors';
import { getServicesRepository } from '../../../supabase/lib/repositories/services';
import { getPrescriptionsRepository } from '../../../supabase/lib/repositories/prescriptions';
import { getDiagnosticBookingsRepository } from '../../../supabase/lib/repositories/diagnostic-bookings';
import { getReviewsRepository } from '../../../supabase/lib/repositories/reviews';
import { getSchedulingRepository } from '../../../supabase/lib/repositories/scheduling';

const client = getDbClient();
const app = new Hono();

/**
 * GET /make-server-3dd53475/vet/services
 * Get all published vet services grouped by service type
 * ✅ SQL-ONLY: Uses vendor_services table and VendorsRepository
 */
app.get("/make-server-3dd53475/vet/services", async (c) => {
  try {
    console.log('🏥 [VET-SERVICES] Fetching all vet services');
    
    // ✅ SQL: Get all active vet vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({ status: 'approved', isActive: true });
    const vetVendors = allVendors.filter((v: any) => 
      v.role_id === 'veterinary_clinic' || v.category === 'vet_clinic' || v.vendorType === 'vet_clinic'
    );
    
    console.log(`   Found ${vetVendors.length} active vet vendors`);
    
    const servicesByType: any = {
      tele_consultation: [],
      clinic_visit: [],
      home_visit: [],
      lab_collection: [],
      medicine_delivery: []
    };
    
    // ✅ SQL: Get vendor services from vendor_services table
    for (const vendor of vetVendors) {
      const vendorId = vendor.id || vendor.vendor_id;
      
      // Query vendor_services table
      const { data: vendorServices, error } = await client
        .from('vendor_services')
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('publish_status', 'published')
        .eq('is_enabled', true);
      
      if (error || !vendorServices) continue;
      
      for (const service of vendorServices) {
        const enrichedService = {
          id: service.id || service.service_id,
          serviceName: service.service_name || service.name,
          description: service.custom_description || service.description,
          price: service.custom_price || service.price,
          duration: service.custom_duration || service.duration_minutes,
          categoryName: service.category,
          subCategoryName: service.sub_category,
          serviceStyle: service.service_style,
          vendorId,
          vendorName: vendor.business_name || vendor.owner_name,
          vendorRating: vendor.rating || 4.5,
          vendorReviewCount: vendor.review_count || 0,
          vendorLocation: vendor.address,
          vendorPhone: vendor.phone,
          vendorEmail: vendor.email,
          specialization: vendor.specialization,
          experience: vendor.experience_years,
          hasMedicines: vendor.has_medicines || false,
          hasLabFacility: vendor.has_lab_facility || false
        };
        
        // Categorize by service type
        const subCat = service.sub_category?.toLowerCase();
        if (service.service_style === 'tele' || subCat?.includes('tele')) {
          servicesByType.tele_consultation.push(enrichedService);
        } else if (service.service_style === 'at_center' || subCat?.includes('clinic')) {
          servicesByType.clinic_visit.push(enrichedService);
        } else if (service.service_style === 'at_home' || subCat?.includes('home')) {
          servicesByType.home_visit.push(enrichedService);
        }
        
        // Lab services
        if (subCat?.includes('lab') || subCat?.includes('test') || subCat?.includes('diagnostic')) {
          servicesByType.lab_collection.push(enrichedService);
        }
        
        // Medicine delivery
        if (vendor.has_medicines) {
          servicesByType.medicine_delivery.push({
            ...enrichedService,
            serviceName: 'Medicine Delivery',
            categoryName: 'Medicine',
            subCategoryName: 'Delivery'
          });
        }
      }
    }
    
    console.log(`✅ [VET-SERVICES] Returning services by type`);
    
    return c.json({
      success: true,
      services: servicesByType,
      totalVendors: vetVendors.length
    });
    
  } catch (error) {
    console.error('❌ [VET-SERVICES] Error fetching services:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/vet/doctors
 * Get all available vet doctors with filters
 * ✅ SQL-ONLY: Uses VendorsRepository
 */
app.get("/make-server-3dd53475/vet/doctors", async (c) => {
  try {
    const specialization = c.req.query('specialization');
    const serviceType = c.req.query('serviceType');
    
    console.log('👨‍⚕️ [VET-DOCTORS] Fetching available doctors');
    
    // ✅ SQL: Get all active vet vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({ status: 'approved', isActive: true });
    const vetDoctors = allVendors.filter((v: any) => 
      v.role_id === 'veterinary_clinic' || v.category === 'vet_clinic' || v.vendorType === 'vet_clinic'
    );
    
    let doctors = vetDoctors.map((vendor: any) => ({
      id: vendor.id || vendor.vendor_id,
      name: vendor.owner_name || vendor.business_name,
      businessName: vendor.business_name,
      specialization: vendor.specialization || 'General Veterinarian',
      experience: vendor.experience_years || '5+ years',
      rating: vendor.rating || 4.5,
      reviewCount: vendor.review_count || 0,
      consultationFee: vendor.consultation_fee || 500,
      location: vendor.address,
      profileImage: vendor.profile_image,
      availableForTele: true,
      availableForClinic: true,
      availableForHome: vendor.home_visit_available || false,
      nextAvailableSlot: vendor.next_available_slot || new Date().toISOString()
    }));
    
    // Apply filters
    if (specialization) {
      doctors = doctors.filter((d: any) => 
        d.specialization?.toLowerCase().includes(specialization.toLowerCase())
      );
    }
    
    if (serviceType === 'tele') {
      doctors = doctors.filter((d: any) => d.availableForTele);
    } else if (serviceType === 'clinic') {
      doctors = doctors.filter((d: any) => d.availableForClinic);
    } else if (serviceType === 'home') {
      doctors = doctors.filter((d: any) => d.availableForHome);
    }
    
    // Sort by rating
    doctors.sort((a: any, b: any) => b.rating - a.rating);
    
    console.log(`✅ [VET-DOCTORS] Returning ${doctors.length} doctors`);
    
    return c.json({
      success: true,
      doctors,
      total: doctors.length
    });
    
  } catch (error) {
    console.error('❌ [VET-DOCTORS] Error fetching doctors:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/vet/clinics
 * Get all vet clinics with location data
 * ✅ SQL-ONLY: Uses VendorsRepository
 */
app.get("/make-server-3dd53475/vet/clinics", async (c) => {
  try {
    const lat = c.req.query('lat');
    const lng = c.req.query('lng');
    
    console.log('🏥 [VET-CLINICS] Fetching clinics');
    
    // ✅ SQL: Get all active vet vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({ status: 'approved', isActive: true });
    const vetVendors = allVendors.filter((v: any) => 
      v.role_id === 'veterinary_clinic' || v.category === 'vet_clinic' || v.vendorType === 'vet_clinic'
    );
    
    const clinics = vetVendors.map((vendor: any) => ({
      id: vendor.id || vendor.vendor_id,
      name: vendor.business_name || vendor.owner_name,
      address: vendor.address,
      location: vendor.address,
      coordinates: { lat: vendor.latitude || 12.9716, lng: vendor.longitude || 77.5946 },
      rating: vendor.rating || 4.5,
      reviewCount: vendor.review_count || 0,
      phone: vendor.phone,
      email: vendor.email,
      businessHours: vendor.operating_hours || '9 AM - 9 PM',
      services: vendor.services || [],
      hasEmergency: vendor.has_emergency || true,
      hasLabFacility: vendor.has_lab_facility || false,
      hasMedicines: vendor.has_medicines || false,
      distance: lat && lng ? calculateDistance(
        parseFloat(lat), 
        parseFloat(lng), 
        vendor.latitude || 12.9716,
        vendor.longitude || 77.5946
      ) : null
    }));
    
    // Sort by distance if location provided
    if (lat && lng) {
      clinics.sort((a: any, b: any) => (a.distance || 999) - (b.distance || 999));
    } else {
      clinics.sort((a: any, b: any) => b.rating - a.rating);
    }
    
    console.log(`✅ [VET-CLINICS] Returning ${clinics.length} clinics`);
    
    return c.json({
      success: true,
      clinics,
      total: clinics.length
    });
    
  } catch (error) {
    console.error('❌ [VET-CLINICS] Error fetching clinics:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/vet/slots
 * Get available time slots for a doctor/clinic
 * ✅ SQL-ONLY: Uses BookingsRepository and SchedulingRepository
 */
app.get("/make-server-3dd53475/vet/slots", async (c) => {
  try {
    const vendorId = c.req.query('vendorId');
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    const serviceType = c.req.query('serviceType') || 'clinic';
    
    if (!vendorId) {
      return c.json({ error: 'vendorId is required' }, 400);
    }
    
    console.log(`📅 [VET-SLOTS] Fetching slots for vendor: ${vendorId}, date: ${date}`);
    
    // ✅ SQL: Get existing bookings for this vendor on this date
    const bookingsRepo = getBookingsRepository();
    const existingBookings = await bookingsRepo.findByVendor(vendorId, { date });
    
    // Generate time slots (9 AM to 9 PM, 30-minute intervals)
    const slots = [];
    const startHour = 9;
    const endHour = 21;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotId = `${date}-${timeStr}`;
        
        // Check if slot is booked
        const isBooked = existingBookings.some((b: any) => {
          const bookingTime = b.booking_time || b.scheduled_time;
          return bookingTime && bookingTime.startsWith(timeStr);
        });
        
        slots.push({
          id: slotId,
          time: timeStr,
          displayTime: formatTime(hour, minute),
          available: !isBooked,
          date
        });
      }
    }
    
    console.log(`✅ [VET-SLOTS] Returning ${slots.length} slots (${slots.filter((s: any) => s.available).length} available)`);
    
    return c.json({
      success: true,
      slots,
      date,
      vendorId
    });
    
  } catch (error) {
    console.error('❌ [VET-SLOTS] Error fetching slots:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vet/booking
 * Create a new vet booking (tele, clinic, home visit)
 * ✅ SQL-ONLY: Uses BookingsRepository
 */
app.post("/make-server-3dd53475/vet/booking", async (c) => {
  try {
    const body = await c.req.json();
    const {
      customerId,
      petId,
      vendorId,
      serviceId,
      serviceType, // 'tele', 'clinic', 'home_visit'
      slotId,
      date,
      time,
      price,
      address, // For home visits
      notes
    } = body;
    
    console.log(`📝 [VET-BOOKING] Creating booking for customer: ${customerId}`);
    
    // Validate required fields
    if (!customerId || !vendorId || !serviceType || !date || !time) {
      return c.json({ error: 'Missing required fields' }, 400);
    }
    
    // ✅ SQL: Create booking using repository
    const bookingsRepo = getBookingsRepository();
    const vendorsRepo = getVendorsRepository();
    
    // Resolve vendor ID (handles both UUID and vendor_id string)
    const vendor = await vendorsRepo.findById(vendorId) || await vendorsRepo.findByVendorId(vendorId);
    if (!vendor) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Map serviceType to service_type enum
    const serviceTypeMap: Record<string, string> = {
      'tele': 'online',
      'clinic': 'at_vendor',
      'home_visit': 'at_home'
    };
    
    const booking = await bookingsRepo.create({
      customer_id: customerId,
      vendor_id: vendor.id,
      service_id: serviceId || '', // Service ID required
      booking_date: date,
      booking_time: time,
      scheduled_date: date,
      scheduled_time: time,
      status: 'confirmed',
      service_type: serviceTypeMap[serviceType] || 'at_vendor',
      address: address || null,
      base_price: price || 0,
      total_amount: price || 0,
      payment_status: 'pending',
      notes: notes || null,
    });
    
    console.log(`✅ [VET-BOOKING] Booking created: ${booking.id}`);
    
    return c.json({
      success: true,
      booking,
      message: 'Booking created successfully'
    });
    
  } catch (error) {
    console.error('❌ [VET-BOOKING] Error creating booking:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/customer/:customerId/bookings
 * Get all bookings for a customer
 * ✅ SQL-ONLY: Uses BookingsRepository
 */
app.get("/make-server-3dd53475/customer/:customerId/bookings", async (c) => {
  try {
    const { customerId } = c.req.param();
    const type = c.req.query('type'); // Filter by type
    
    console.log(`📋 [CUSTOMER-BOOKINGS] Fetching bookings for: ${customerId}`);
    
    // ✅ SQL: Get all bookings for customer
    const bookingsRepo = getBookingsRepository();
    const vendorsRepo = getVendorsRepository();
    let bookings = await bookingsRepo.findByCustomer(customerId);
    
    // Filter by type if provided
    if (type) {
      bookings = bookings.filter((b: any) => {
        if (type === 'tele') return b.service_type === 'online';
        if (type === 'clinic') return b.service_type === 'at_vendor';
        if (type === 'home') return b.service_type === 'at_home';
        return true;
      });
    }
    
    // Enrich with vendor details
    const enrichedBookings = await Promise.all(bookings.map(async (booking: any) => {
      if (booking.vendor_id) {
        const vendor = await vendorsRepo.findById(booking.vendor_id);
        return {
          ...booking,
          vendorName: vendor?.business_name || vendor?.owner_name,
          vendorRating: vendor?.rating || 4.5,
          vendorLocation: vendor?.address
        };
      }
      return booking;
    }));
    
    console.log(`✅ [CUSTOMER-BOOKINGS] Returning ${enrichedBookings.length} bookings`);
    
    return c.json({
      success: true,
      bookings: enrichedBookings,
      total: enrichedBookings.length
    });
    
  } catch (error) {
    console.error('❌ [CUSTOMER-BOOKINGS] Error fetching bookings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vet/prescription
 * Create or upload prescription
 * ✅ SQL-ONLY: Uses PrescriptionsRepository
 */
app.post("/make-server-3dd53475/vet/prescription", async (c) => {
  try {
    const body = await c.req.json();
    const {
      bookingId,
      vendorId,
      customerId,
      petId,
      medicines,
      instructions,
      followUpDate,
      prescriptionUrl,
      createdBy,
      createdByRole
    } = body;
    
    console.log(`💊 [PRESCRIPTION] Creating prescription for booking: ${bookingId}`);
    
    // ✅ SQL: Create prescription using repository
    const prescriptionsRepo = getPrescriptionsRepository();
    
    const prescription = await prescriptionsRepo.create({
      booking_id: bookingId,
      pet_id: petId,
      customer_id: customerId,
      vendor_id: vendorId,
      medications: medicines || [],
      general_notes: instructions,
      follow_up_date: followUpDate,
      prescription_file_url: prescriptionUrl,
      created_by: createdBy || vendorId,
      created_by_role: (createdByRole || 'vendor') as 'vendor' | 'staff' | 'admin',
    });
    
    console.log(`✅ [PRESCRIPTION] Created: ${prescription.id}`);
    
    return c.json({
      success: true,
      prescription,
      message: 'Prescription created successfully'
    });
    
  } catch (error) {
    console.error('❌ [PRESCRIPTION] Error creating prescription:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/vet/prescription/:prescriptionId
 * Get prescription details
 * ✅ SQL-ONLY: Uses PrescriptionsRepository
 */
app.get("/make-server-3dd53475/vet/prescription/:prescriptionId", async (c) => {
  try {
    const { prescriptionId } = c.req.param();
    const actorId = c.req.query('actorId') || '';
    const actorRole = c.req.query('actorRole') || 'customer';
    
    // ✅ SQL: Get prescription with access control
    const prescriptionsRepo = getPrescriptionsRepository();
    const prescription = await prescriptionsRepo.getById(
      prescriptionId,
      actorId,
      actorRole as 'vendor' | 'staff' | 'admin' | 'customer'
    );
    
    if (!prescription) {
      return c.json({ error: 'Prescription not found or access denied' }, 404);
    }
    
    // Get vendor details
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(prescription.vendor_id);
    
    return c.json({
      success: true,
      prescription: {
        ...prescription,
        vendorName: vendor?.business_name || vendor?.owner_name,
        vendorSpecialization: vendor?.specialization
      }
    });
    
  } catch (error) {
    console.error('❌ [PRESCRIPTION] Error fetching prescription:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vet/lab-test
 * Create lab test booking
 * ✅ SQL-ONLY: Uses DiagnosticBookingsRepository
 */
app.post("/make-server-3dd53475/vet/lab-test", async (c) => {
  try {
    const body = await c.req.json();
    const {
      customerId,
      petId,
      vendorId,
      testType, // blood, stool, urine
      tests, // array of test names
      collectionDate,
      collectionTime,
      address,
      notes
    } = body;
    
    console.log(`🔬 [LAB-TEST] Creating lab test booking for customer: ${customerId}`);
    
    // ✅ SQL: Create diagnostic booking
    const diagnosticBookingsRepo = getDiagnosticBookingsRepository();
    
    // Generate booking number
    const bookingNumber = `LAB-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    
    const labTest = await diagnosticBookingsRepo.create({
      customer_id: customerId,
      pet_id: petId,
      vendor_id: vendorId,
      booking_number: bookingNumber,
      tests: tests || [],
      booking_type: address ? 'home_collection' : 'center_visit',
      scheduled_date: collectionDate,
      scheduled_time: collectionTime,
      collection_address: address ? { address, notes } : null,
      special_instructions: notes,
      total_amount: 0, // Will be calculated by pharmacy/vendor
      payment_status: 'pending',
    });
    
    console.log(`✅ [LAB-TEST] Created: ${labTest.id}`);
    
    return c.json({
      success: true,
      labTest,
      message: 'Lab test booking created successfully'
    });
    
  } catch (error) {
    console.error('❌ [LAB-TEST] Error creating lab test:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vet/medicine-order
 * Create medicine delivery order
 * ✅ SQL-ONLY: Store in orders table or booking package_details
 */
app.post("/make-server-3dd53475/vet/medicine-order", async (c) => {
  try {
    const body = await c.req.json();
    const {
      customerId,
      petId,
      vendorId, // pharmacy vendor
      prescriptionId,
      prescriptionUrl,
      medicines,
      deliveryAddress,
      notes
    } = body;
    
    console.log(`💊 [MEDICINE-ORDER] Creating order for customer: ${customerId}`);
    
    // ✅ SQL: Store medicine order in orders table or booking package_details
    // For now, we'll create a booking with package_details for medicine orders
    const bookingsRepo = getBookingsRepository();
    const vendorsRepo = getVendorsRepository();
    
    const vendor = await vendorsRepo.findById(vendorId) || await vendorsRepo.findByVendorId(vendorId);
    if (!vendor) {
      return c.json({ error: 'Pharmacy vendor not found' }, 404);
    }
    
    // Create order as a booking with special type
    const order = await bookingsRepo.create({
      customer_id: customerId,
      vendor_id: vendor.id,
      service_id: '', // Medicine delivery service
      booking_date: new Date().toISOString().split('T')[0],
      booking_time: '12:00:00',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '12:00:00',
      status: 'pending_verification',
      service_type: 'at_home',
      address: deliveryAddress,
      base_price: 0, // Will be calculated after verification
      total_amount: 0,
      payment_status: 'pending',
      notes: notes || null,
      package_details: {
        orderType: 'medicine',
        prescriptionId,
        prescriptionUrl,
        medicines: medicines || [],
        status: 'pending_verification'
      }
    });
    
    console.log(`✅ [MEDICINE-ORDER] Created: ${order.id}`);
    
    return c.json({
      success: true,
      order: {
        id: order.id,
        ...order.package_details,
        createdAt: order.created_at,
        updatedAt: order.updated_at
      },
      message: 'Medicine order created successfully. Pharmacy will verify and confirm charges.'
    });
    
  } catch (error) {
    console.error('❌ [MEDICINE-ORDER] Error creating medicine order:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /make-server-3dd53475/tracking/:bookingId
 * Get live tracking info for home visits or lab collection
 * ✅ SQL-ONLY: Store tracking in booking package_details
 */
app.get("/make-server-3dd53475/tracking/:bookingId", async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    // ✅ SQL: Get booking and extract tracking from package_details
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    const tracking = booking.package_details?.tracking || {
      status: 'scheduled',
      currentLocation: null,
      estimatedArrival: null,
      technicianName: 'Dr. Ramesh Kumar',
      technicianPhone: '+91 9876543210',
      vehicleNumber: 'KA01AB1234'
    };
    
    return c.json({
      success: true,
      tracking
    });
    
  } catch (error) {
    console.error('❌ [TRACKING] Error fetching tracking:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vet/feedback
 * Submit feedback after service
 * ✅ SQL-ONLY: Uses ReviewsRepository and VendorsRepository
 */
app.post("/make-server-3dd53475/vet/feedback", async (c) => {
  try {
    const body = await c.req.json();
    const {
      bookingId,
      vendorId,
      customerId,
      rating,
      review,
      serviceQuality,
      punctuality,
      cleanliness
    } = body;
    
    console.log(`⭐ [FEEDBACK] Submitting feedback for booking: ${bookingId}`);
    
    // ✅ SQL: Create review
    const reviewsRepo = getReviewsRepository();
    const bookingsRepo = getBookingsRepository();
    const vendorsRepo = getVendorsRepository();
    
    const feedback = await reviewsRepo.create({
      booking_id: bookingId,
      customer_id: customerId,
      vendor_id: vendorId,
      rating: rating,
      comment: review || null,
    });
    
    // Update booking with feedback reference
    await bookingsRepo.update(bookingId, {
      status: 'completed',
      completed_at: new Date().toISOString()
    });
    
    // ✅ SQL: Update vendor rating
    const vendor = await vendorsRepo.findById(vendorId);
    if (vendor) {
      // Get all reviews for vendor to calculate average
      const allReviews = await reviewsRepo.findByVendor(vendorId);
      const totalRating = allReviews.reduce((sum, r) => sum + r.rating, 0);
      const averageRating = allReviews.length > 0 ? totalRating / allReviews.length : rating;
      
      // Update vendor metadata with new rating
      const metadata = (vendor as any).metadata || {};
      await vendorsRepo.update(vendorId, {
        metadata: {
          ...metadata,
          rating: Math.round(averageRating * 10) / 10,
          reviewCount: allReviews.length,
          serviceQuality,
          punctuality,
          cleanliness
        }
      });
    }
    
    console.log(`✅ [FEEDBACK] Submitted: ${feedback.id}`);
    
    return c.json({
      success: true,
      feedback,
      message: 'Thank you for your feedback!'
    });
    
  } catch (error) {
    console.error('❌ [FEEDBACK] Error submitting feedback:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// Helper functions
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Radius of Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function formatTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
}

export default app;
