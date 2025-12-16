// Comprehensive Vet Services Booking Endpoints
import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

/**
 * GET /make-server-3dd53475/vet/services
 * Get all published vet services grouped by service type
 */
app.get("/make-server-3dd53475/vet/services", async (c) => {
  try {
    console.log('🏥 [VET-SERVICES] Fetching all vet services');
    
    // Get all active vet vendors
    const allVendors = await kv.getByPrefix('vendor:');
    const vetVendors = allVendors.filter((v: any) => 
      v.vendorType === 'vet_clinic' && 
      v.status === 'active' && 
      v.approvalStatus === 'approved'
    );
    
    console.log(`   Found ${vetVendors.length} active vet vendors`);
    
    const servicesByType: any = {
      tele_consultation: [],
      clinic_visit: [],
      home_visit: [],
      lab_collection: [],
      medicine_delivery: []
    };
    
    // Iterate through each vet vendor to get their services
    for (const vendor of vetVendors) {
      const vendorId = vendor.id || vendor.vendorId;
      const serviceStyles = ['at_center', 'at_home', 'tele'];
      
      for (const style of serviceStyles) {
        const vendorServicesKey = `vendor_services:${vendorId}:${style}`;
        const vendorServices = await kv.get(vendorServicesKey);
        
        if (vendorServices && vendorServices.services) {
          const publishedServices = vendorServices.services.filter(
            (s: any) => s.publishStatus === 'published' && s.isEnabled
          );
          
          for (const service of publishedServices) {
            const enrichedService = {
              id: service.id || service.serviceId,
              serviceName: service.serviceName || service.name,
              description: service.description || service.customDescription,
              price: service.customPrice || service.price,
              duration: service.customDuration || service.duration,
              categoryName: service.categoryName,
              subCategoryName: service.subCategoryName,
              serviceStyle: style,
              vendorId,
              vendorName: vendor.businessName || vendor.fullName,
              vendorRating: vendor.rating || 4.5,
              vendorReviewCount: vendor.reviewCount || 0,
              vendorLocation: vendor.location || vendor.address,
              vendorPhone: vendor.phone,
              vendorEmail: vendor.email,
              specialization: vendor.specialization,
              experience: vendor.experience,
              hasMedicines: vendor.hasMedicines || false,
              hasLabFacility: vendor.hasLabFacility || false
            };
            
            // Categorize by service type
            const subCat = service.subCategoryName?.toLowerCase();
            if (style === 'tele' || subCat?.includes('tele')) {
              servicesByType.tele_consultation.push(enrichedService);
            } else if (style === 'at_center' || subCat?.includes('clinic')) {
              servicesByType.clinic_visit.push(enrichedService);
            } else if (style === 'at_home' || subCat?.includes('home')) {
              servicesByType.home_visit.push(enrichedService);
            }
            
            // Lab services
            if (subCat?.includes('lab') || subCat?.includes('test') || subCat?.includes('diagnostic')) {
              servicesByType.lab_collection.push(enrichedService);
            }
            
            // Medicine delivery
            if (vendor.hasMedicines) {
              servicesByType.medicine_delivery.push({
                ...enrichedService,
                serviceName: 'Medicine Delivery',
                categoryName: 'Medicine',
                subCategoryName: 'Delivery'
              });
            }
          }
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
 */
app.get("/make-server-3dd53475/vet/doctors", async (c) => {
  try {
    const specialization = c.req.query('specialization');
    const serviceType = c.req.query('serviceType');
    
    console.log('👨‍⚕️ [VET-DOCTORS] Fetching available doctors');
    
    const allVendors = await kv.getByPrefix('vendor:');
    const vetDoctors = allVendors.filter((v: any) => 
      v.vendorType === 'vet_clinic' && 
      v.status === 'active' && 
      v.approvalStatus === 'approved'
    );
    
    let doctors = vetDoctors.map((vendor: any) => ({
      id: vendor.id || vendor.vendorId,
      name: vendor.fullName || vendor.businessName,
      businessName: vendor.businessName,
      specialization: vendor.specialization || 'General Veterinarian',
      experience: vendor.experience || '5+ years',
      rating: vendor.rating || 4.5,
      reviewCount: vendor.reviewCount || 0,
      consultationFee: vendor.consultationFee || 500,
      location: vendor.location || vendor.address,
      profileImage: vendor.profileImage,
      availableForTele: true,
      availableForClinic: true,
      availableForHome: vendor.homeVisitAvailable || false,
      nextAvailableSlot: vendor.nextAvailableSlot || new Date().toISOString()
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
 */
app.get("/make-server-3dd53475/vet/clinics", async (c) => {
  try {
    const lat = c.req.query('lat');
    const lng = c.req.query('lng');
    
    console.log('🏥 [VET-CLINICS] Fetching clinics');
    
    const allVendors = await kv.getByPrefix('vendor:');
    const clinics = allVendors
      .filter((v: any) => 
        v.vendorType === 'vet_clinic' && 
        v.status === 'active' && 
        v.approvalStatus === 'approved'
      )
      .map((vendor: any) => ({
        id: vendor.id || vendor.vendorId,
        name: vendor.businessName || vendor.fullName,
        address: vendor.address || vendor.location,
        location: vendor.location,
        coordinates: vendor.coordinates || { lat: 12.9716, lng: 77.5946 }, // Default Bangalore
        rating: vendor.rating || 4.5,
        reviewCount: vendor.reviewCount || 0,
        phone: vendor.phone,
        email: vendor.email,
        businessHours: vendor.businessHours || '9 AM - 9 PM',
        services: vendor.services || [],
        hasEmergency: vendor.hasEmergency || true,
        hasLabFacility: vendor.hasLabFacility || false,
        hasMedicines: vendor.hasMedicines || false,
        distance: lat && lng ? calculateDistance(
          parseFloat(lat), 
          parseFloat(lng), 
          vendor.coordinates?.lat || 12.9716,
          vendor.coordinates?.lng || 77.5946
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
    
    // Get existing bookings for this vendor on this date
    const bookingsKey = `bookings:vendor:${vendorId}:${date}`;
    const existingBookings = await kv.get(bookingsKey) || { slots: [] };
    
    // Generate time slots (9 AM to 9 PM, 30-minute intervals)
    const slots = [];
    const startHour = 9;
    const endHour = 21;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotId = `${date}-${timeStr}`;
        
        const isBooked = existingBookings.slots.some((b: any) => b.slotId === slotId);
        
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
    
    // Generate booking ID
    const bookingId = `booking:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    // Create booking object
    const booking = {
      id: bookingId,
      customerId,
      petId,
      vendorId,
      serviceId,
      serviceType,
      slotId,
      date,
      time,
      price,
      address,
      notes,
      status: 'confirmed',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save booking
    await kv.set(bookingId, booking);
    
    // Add to customer's bookings
    const customerBookingsKey = `customer:${customerId}:bookings`;
    const customerBookings = await kv.get(customerBookingsKey) || { bookings: [] };
    customerBookings.bookings.unshift(bookingId);
    await kv.set(customerBookingsKey, customerBookings);
    
    // Add to vendor's bookings
    const vendorBookingsKey = `vendor:${vendorId}:bookings`;
    const vendorBookings = await kv.get(vendorBookingsKey) || { bookings: [] };
    vendorBookings.bookings.unshift(bookingId);
    await kv.set(vendorBookingsKey, vendorBookings);
    
    // Mark slot as booked
    const bookingsKey = `bookings:vendor:${vendorId}:${date}`;
    const existingBookings = await kv.get(bookingsKey) || { slots: [] };
    existingBookings.slots.push({ slotId, bookingId });
    await kv.set(bookingsKey, existingBookings);
    
    console.log(`✅ [VET-BOOKING] Booking created: ${bookingId}`);
    
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
 */
app.get("/make-server-3dd53475/customer/:customerId/bookings", async (c) => {
  try {
    const { customerId } = c.req.param();
    const type = c.req.query('type'); // Filter by type
    
    console.log(`📋 [CUSTOMER-BOOKINGS] Fetching bookings for: ${customerId}`);
    
    const customerBookingsKey = `customer:${customerId}:bookings`;
    const customerBookings = await kv.get(customerBookingsKey) || { bookings: [] };
    
    const bookings = [];
    for (const bookingId of customerBookings.bookings) {
      const booking = await kv.get(bookingId);
      if (booking) {
        // Get vendor details
        const vendor = await kv.get(`vendor:${booking.vendorId}`);
        
        // Filter by type if provided
        if (!type || booking.serviceType === type) {
          bookings.push({
            ...booking,
            vendorName: vendor?.businessName || vendor?.fullName,
            vendorRating: vendor?.rating || 4.5,
            vendorLocation: vendor?.location
          });
        }
      }
    }
    
    console.log(`✅ [CUSTOMER-BOOKINGS] Returning ${bookings.length} bookings`);
    
    return c.json({
      success: true,
      bookings,
      total: bookings.length
    });
    
  } catch (error) {
    console.error('❌ [CUSTOMER-BOOKINGS] Error fetching bookings:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /make-server-3dd53475/vet/prescription
 * Create or upload prescription
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
      prescriptionUrl
    } = body;
    
    console.log(`💊 [PRESCRIPTION] Creating prescription for booking: ${bookingId}`);
    
    const prescriptionId = `prescription:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    const prescription = {
      id: prescriptionId,
      bookingId,
      vendorId,
      customerId,
      petId,
      medicines: medicines || [],
      instructions,
      followUpDate,
      prescriptionUrl,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(prescriptionId, prescription);
    
    // Link to booking
    if (bookingId) {
      const booking = await kv.get(bookingId);
      if (booking) {
        booking.prescriptionId = prescriptionId;
        booking.updatedAt = new Date().toISOString();
        await kv.set(bookingId, booking);
      }
    }
    
    // Add to pet's health records
    const petRecordsKey = `pet:${petId}:health_records`;
    const records = await kv.get(petRecordsKey) || { prescriptions: [] };
    records.prescriptions.unshift(prescriptionId);
    await kv.set(petRecordsKey, records);
    
    console.log(`✅ [PRESCRIPTION] Created: ${prescriptionId}`);
    
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
 */
app.get("/make-server-3dd53475/vet/prescription/:prescriptionId", async (c) => {
  try {
    const { prescriptionId } = c.req.param();
    
    const prescription = await kv.get(prescriptionId);
    if (!prescription) {
      return c.json({ error: 'Prescription not found' }, 404);
    }
    
    // Get vendor details
    const vendor = await kv.get(`vendor:${prescription.vendorId}`);
    
    return c.json({
      success: true,
      prescription: {
        ...prescription,
        vendorName: vendor?.businessName || vendor?.fullName,
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
    
    const labTestId = `labtest:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    const labTest = {
      id: labTestId,
      customerId,
      petId,
      vendorId,
      testType,
      tests: tests || [],
      collectionDate,
      collectionTime,
      address,
      notes,
      status: 'scheduled', // scheduled, collected, processing, completed
      technicianId: null,
      technicianName: null,
      reportUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(labTestId, labTest);
    
    // Add to customer's lab tests
    const customerLabTestsKey = `customer:${customerId}:lab_tests`;
    const customerTests = await kv.get(customerLabTestsKey) || { tests: [] };
    customerTests.tests.unshift(labTestId);
    await kv.set(customerLabTestsKey, customerTests);
    
    // Add to vendor's lab tests
    const vendorLabTestsKey = `vendor:${vendorId}:lab_tests`;
    const vendorTests = await kv.get(vendorLabTestsKey) || { tests: [] };
    vendorTests.tests.unshift(labTestId);
    await kv.set(vendorLabTestsKey, vendorTests);
    
    console.log(`✅ [LAB-TEST] Created: ${labTestId}`);
    
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
 */
app.post("/make-server-3dd53475/vet/medicine-order", async (c) => {
  try {
    const body = await c.req.json();
    const {
      customerId,
      petId,
      vendorId, // pharmacy vendor
      prescriptionId,
      prescriptionUrl, // uploaded prescription
      medicines, // array of medicine items
      deliveryAddress,
      notes
    } = body;
    
    console.log(`💊 [MEDICINE-ORDER] Creating order for customer: ${customerId}`);
    
    const orderId = `medicine_order:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    const order = {
      id: orderId,
      customerId,
      petId,
      vendorId,
      prescriptionId,
      prescriptionUrl,
      medicines: medicines || [],
      deliveryAddress,
      notes,
      status: 'pending_verification', // pending_verification, verified, confirmed, shipped, delivered
      totalAmount: null,
      estimatedDelivery: null,
      trackingId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(orderId, order);
    
    // Add to customer's medicine orders
    const customerOrdersKey = `customer:${customerId}:medicine_orders`;
    const customerOrders = await kv.get(customerOrdersKey) || { orders: [] };
    customerOrders.orders.unshift(orderId);
    await kv.set(customerOrdersKey, customerOrders);
    
    // Add to vendor's medicine orders
    if (vendorId) {
      const vendorOrdersKey = `vendor:${vendorId}:medicine_orders`;
      const vendorOrders = await kv.get(vendorOrdersKey) || { orders: [] };
      vendorOrders.orders.unshift(orderId);
      await kv.set(vendorOrdersKey, vendorOrders);
    }
    
    console.log(`✅ [MEDICINE-ORDER] Created: ${orderId}`);
    
    return c.json({
      success: true,
      order,
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
 */
app.get("/make-server-3dd53475/tracking/:bookingId", async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    const tracking = await kv.get(`tracking:${bookingId}`) || {
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
    
    const feedbackId = `feedback:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    const feedback = {
      id: feedbackId,
      bookingId,
      vendorId,
      customerId,
      rating,
      review,
      serviceQuality,
      punctuality,
      cleanliness,
      createdAt: new Date().toISOString()
    };
    
    await kv.set(feedbackId, feedback);
    
    // Update booking
    const booking = await kv.get(bookingId);
    if (booking) {
      booking.feedbackId = feedbackId;
      booking.status = 'completed';
      await kv.set(bookingId, booking);
    }
    
    // Update vendor rating
    const vendor = await kv.get(`vendor:${vendorId}`);
    if (vendor) {
      const currentRating = vendor.rating || 0;
      const currentCount = vendor.reviewCount || 0;
      const newRating = ((currentRating * currentCount) + rating) / (currentCount + 1);
      
      vendor.rating = Math.round(newRating * 10) / 10;
      vendor.reviewCount = currentCount + 1;
      await kv.set(`vendor:${vendorId}`, vendor);
    }
    
    console.log(`✅ [FEEDBACK] Submitted: ${feedbackId}`);
    
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
