// ✅ MIGRATED TO SQL: Comprehensive Vet Services Booking Endpoints
import { Hono } from 'npm:hono';
import { getPrescriptionsRepository } from '../../lib/repositories/prescriptions.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getServicesRepository } from '../../lib/repositories/services.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getReviewsRepository } from '../../lib/repositories/reviews.ts';
import { getDiagnosticSamplesRepository } from '../../lib/repositories/diagnostic-samples.ts';
import { getMedicineOrdersRepository } from '../../lib/repositories/medicine-orders.ts';

const app = new Hono();

/**
 * GET /make-server-3dd53475/vet/services
 * Get all published vet services grouped by service type
 */
app.get("/make-server-3dd53475/vet/services", async (c) => {
  try {
    console.log('🏥 [VET-SERVICES] Fetching all vet services');
    
    // ✅ SQL: Get all active vet vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({ is_active: true });
    const vetVendors = allVendors.filter((v: any) => 
      (v.category === 'vet_clinic' || v.role_id === 'veterinarian' || v.role_id === 'veterinary_clinic') && 
      v.status === 'active'
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
      
      // ✅ SQL: Get vendor services
      const servicesRepo = getServicesRepository();
      const vendorServices = await servicesRepo.findByVendor(vendorId);
      
      for (const style of serviceStyles) {
        const publishedServices = vendorServices.filter(
          (s: any) => s.is_active && (s.service_style === style || s.category === style)
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
    
    // ✅ SQL: Get all active vet vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({ is_active: true });
    const vetDoctors = allVendors.filter((v: any) => 
      (v.category === 'vet_clinic' || v.role_id === 'veterinarian' || v.role_id === 'veterinary_clinic') && 
      v.status === 'active'
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
    
    // ✅ SQL: Get all active vet vendors
    const vendorsRepo = getVendorsRepository();
    const allVendors = await vendorsRepo.findAll({ is_active: true });
    const clinics = allVendors
      .filter((v: any) => 
        (v.category === 'vet_clinic' || v.role_id === 'veterinarian' || v.role_id === 'veterinary_clinic') && 
        v.status === 'active'
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
    
    // ✅ SQL: Get existing bookings for this vendor on this date
    const bookingsRepo = getBookingsRepository();
    const vendorsRepo = getVendorsRepository();
    const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
    const existingBookings = resolvedVendorId 
      ? await bookingsRepo.findByVendorAndDate(resolvedVendorId, date)
      : [];
    
    // Generate time slots (9 AM to 9 PM, 30-minute intervals)
    const slots = [];
    const startHour = 9;
    const endHour = 21;
    
    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute of [0, 30]) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const slotId = `${date}-${timeStr}`;
        
        const bookingTimeOnly = timeStr;
        const isBooked = existingBookings.some((b: any) => {
          const bTime = b.booking_time?.split(':').slice(0, 2).join(':') || b.booking_time;
          return bTime === bookingTimeOnly && b.status !== 'cancelled';
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
    const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
    
    if (!resolvedVendorId) {
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
      vendor_id: resolvedVendorId,
      service_id: serviceId,
      booking_date: date,
      booking_time: time,
      status: 'confirmed',
      service_type: serviceTypeMap[serviceType] || 'at_vendor',
      address: address,
      base_price: price,
      total_amount: price,
      payment_status: 'pending',
      notes: notes,
    });
    
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
    
    // ✅ SQL: Get customer bookings
    const bookingsRepo = getBookingsRepository();
    const vendorsRepo = getVendorsRepository();
    let allBookings = await bookingsRepo.findByCustomer(customerId);
    
    // Filter by type if provided
    if (type) {
      const typeMap: Record<string, string> = {
        'tele': 'online',
        'clinic': 'at_vendor',
        'home_visit': 'at_home'
      };
      allBookings = allBookings.filter(b => b.service_type === typeMap[type] || b.service_type === type);
    }
    
    // Enrich with vendor details
    const bookings = await Promise.all(allBookings.map(async (booking) => {
      let vendor = null;
      if (booking.vendor_id) {
        vendor = await vendorsRepo.findById(booking.vendor_id);
      }
      
      return {
        ...booking,
        customerId: booking.customer_id,
        petId: (booking as any).pet_id,
        vendorId: booking.vendor_id,
        serviceType: booking.service_type,
        date: booking.booking_date,
        time: booking.booking_time,
        price: booking.base_price,
        status: booking.status,
        paymentStatus: booking.payment_status,
        createdAt: booking.created_at,
        updatedAt: booking.updated_at,
        vendorName: vendor?.business_name,
        vendorRating: 4.5, // TODO: Add rating to vendors table
        vendorLocation: vendor ? `${vendor.city}, ${vendor.state}` : null
      };
    }));
    
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
 * 
 * ✅ MIGRATED: Uses SQL repository instead of KV
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
    
    // ✅ SQL: Get booking to verify and extract IDs
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      console.error(`❌ [PRESCRIPTION] Booking not found: ${bookingId}`);
      return c.json({ error: 'Booking not found' }, 404);
    }
    
    // Verify IDs match
    if (booking.vendor_id !== vendorId || booking.customer_id !== customerId || booking.pet_id !== petId) {
      console.error(`❌ [PRESCRIPTION] ID mismatch`);
      return c.json({ error: 'Booking IDs do not match' }, 400);
    }
    
    // ✅ SQL: Get vendor for created_by
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(vendorId);
    
    if (!vendor) {
      console.error(`❌ [PRESCRIPTION] Vendor not found: ${vendorId}`);
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Convert medicines to medications array format
    let medicationsArray: any[] = [];
    if (Array.isArray(medicines)) {
      medicationsArray = medicines.map((med: any) => {
        if (typeof med === 'string') {
          return { name: med, instructions: instructions || '' };
        }
        return { ...med, instructions: med.instructions || instructions || '' };
      });
    } else if (medicines) {
      medicationsArray = [{ name: medicines, instructions: instructions || '' }];
    }
    
    // ✅ SQL: Create prescription using repository
    const prescriptionsRepo = getPrescriptionsRepository();
    const createdBy = vendor.user_id || vendor.id;
    
    const prescription = await prescriptionsRepo.create({
      booking_id: bookingId,
      pet_id: petId,
      customer_id: customerId,
      vendor_id: vendorId,
      staff_id: booking.staff_id || undefined,
      diagnosis: undefined,
      observations: undefined,
      medications: medicationsArray,
      products_used: [],
      tests_recommended: [],
      general_notes: instructions || undefined,
      recommendations: undefined,
      follow_up_date: followUpDate || undefined,
      follow_up_reason: undefined,
      vitals: undefined,
      prescription_file_url: prescriptionUrl || undefined,
      attachments: [],
      created_by: createdBy,
      created_by_role: 'vendor',
      expires_at: undefined
    });
    
    console.log(`✅ [PRESCRIPTION] Created in SQL: ${prescription.id} (${prescription.prescription_number})`);
    
    return c.json({
      success: true,
      prescription: {
        id: prescription.id,
        prescriptionNumber: prescription.prescription_number,
        bookingId: prescription.booking_id,
        petId: prescription.pet_id,
        customerId: prescription.customer_id,
        vendorId: prescription.vendor_id,
        medications: prescription.medications,
        generalNotes: prescription.general_notes,
        followUpDate: prescription.follow_up_date,
        prescriptionFileUrl: prescription.prescription_file_url,
        createdAt: prescription.created_at
      },
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
 * 
 * ✅ MIGRATED: Uses SQL repository instead of KV
 */
app.get("/make-server-3dd53475/vet/prescription/:prescriptionId", async (c) => {
  try {
    const { prescriptionId } = c.req.param();
    const actorId = c.req.query('actor_id') || '';
    const actorRole = c.req.query('actor_role') || 'vendor';
    
    // ✅ SQL: Get prescription with access control
    const prescriptionsRepo = getPrescriptionsRepository();
    const prescription = await prescriptionsRepo.getById(
      prescriptionId,
      actorId || 'system',
      actorRole as any
    );
    
    if (!prescription) {
      return c.json({ error: 'Prescription not found or access denied' }, 404);
    }
    
    // ✅ SQL: Get vendor details
    const vendorsRepo = getVendorsRepository();
    const vendor = await vendorsRepo.findById(prescription.vendor_id);
    
    return c.json({
      success: true,
      prescription: {
        id: prescription.id,
        prescriptionNumber: prescription.prescription_number,
        bookingId: prescription.booking_id,
        petId: prescription.pet_id,
        customerId: prescription.customer_id,
        vendorId: prescription.vendor_id,
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
        prescriptionFileUrl: prescription.prescription_file_url,
        attachments: prescription.attachments,
        createdAt: prescription.created_at,
        status: prescription.status,
        vendorName: vendor?.business_name || vendor?.owner_name,
        vendorSpecialization: vendor?.category
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
    
    // ✅ SQL: Create diagnostic sample using repository
    const diagnosticSamplesRepo = getDiagnosticSamplesRepository();
    const vendorsRepo = getVendorsRepository();
    const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
    
    if (!resolvedVendorId) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Create a booking first (or use existing booking_id if provided)
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.create({
      customer_id: customerId,
      vendor_id: resolvedVendorId,
      service_id: 'diagnostic-service', // Default service ID for diagnostics
      booking_date: collectionDate,
      booking_time: collectionTime,
      status: 'confirmed',
      service_type: 'at_home',
      address: address,
      base_price: 0, // Will be calculated later
      total_amount: 0,
      notes: notes,
    });
    
    const sample = await diagnosticSamplesRepo.create({
      booking_id: booking.id,
      pet_id: petId,
      customer_id: customerId,
      vendor_id: resolvedVendorId,
      sample_type: testType as any,
      test_types: tests || [],
      collection_date: collectionDate,
      collection_time: collectionTime,
      collection_address: address,
      collection_notes: notes,
      status: 'pending_collection',
      custody_status: 'collected',
    });
    
    console.log(`✅ [LAB-TEST] Created: ${sample.id}`);
    
    return c.json({
      success: true,
      labTest: {
        id: sample.id,
        customerId,
        petId,
        vendorId: resolvedVendorId,
        testType,
        tests: sample.test_types,
        collectionDate: sample.collection_date,
        collectionTime: sample.collection_time,
        address: sample.collection_address,
        notes: sample.collection_notes,
        status: sample.status,
        createdAt: sample.created_at,
        updatedAt: sample.updated_at
      },
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
    
    // ✅ SQL: Create medicine order using repository
    const medicineOrdersRepo = getMedicineOrdersRepository();
    const vendorsRepo = getVendorsRepository();
    const resolvedVendorId = vendorId ? await vendorsRepo.resolveVendorId(vendorId) : null;
    
    const order = await medicineOrdersRepo.create({
      prescription_id: prescriptionId || '',
      customer_id: customerId,
      pet_id: petId,
      prescription_file_url: prescriptionUrl || '',
      delivery_address: deliveryAddress,
      delivery_city: null, // Extract from address if needed
      delivery_state: null,
      delivery_pincode: null,
      medicines: medicines || [],
      notes: notes,
      selected_pharmacy_id: resolvedVendorId || null,
    });
    
    console.log(`✅ [MEDICINE-ORDER] Created: ${order.id}`);
    
    return c.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        customerId: order.customer_id,
        petId: order.pet_id,
        vendorId: order.selected_pharmacy_id,
        prescriptionId: order.prescription_id,
        prescriptionUrl: order.prescription_file_url,
        medicines: order.proforma_items || medicines || [],
        deliveryAddress: order.delivery_address,
        notes: order.notes,
        status: order.status,
        paymentStatus: order.payment_status,
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
 */
app.get("/make-server-3dd53475/tracking/:bookingId", async (c) => {
  try {
    const { bookingId } = c.req.param();
    
    // ✅ SQL: Get tracking from booking (or create default)
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    const tracking = booking ? {
      status: booking.status === 'in_progress' ? 'en_route' : booking.status,
      currentLocation: (booking as any).current_location || null,
      estimatedArrival: (booking as any).estimated_arrival || null,
      technicianName: (booking as any).staff_name || 'Service Provider',
      technicianPhone: (booking as any).staff_phone || null,
      vehicleNumber: (booking as any).vehicle_number || null
    } : {
      status: 'scheduled',
      currentLocation: null,
      estimatedArrival: null,
      technicianName: 'Service Provider',
      technicianPhone: null,
      vehicleNumber: null
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
    
    // ✅ SQL: Save feedback using ReviewsRepository
    const reviewsRepo = getReviewsRepository();
    const vendorsRepo = getVendorsRepository();
    const bookingsRepo = getBookingsRepository();
    
    const resolvedVendorId = await vendorsRepo.resolveVendorId(vendorId);
    if (!resolvedVendorId) {
      return c.json({ error: 'Vendor not found' }, 404);
    }
    
    // Store detailed feedback in comment as JSON
    const detailedComment = JSON.stringify({
      review: review,
      serviceQuality: serviceQuality,
      punctuality: punctuality,
      cleanliness: cleanliness
    });
    
    const savedFeedback = await reviewsRepo.create({
      booking_id: bookingId,
      customer_id: customerId,
      vendor_id: resolvedVendorId,
      rating: rating,
      comment: detailedComment,
    });
    
    // ✅ SQL: Update booking status
    await bookingsRepo.update(bookingId, {
      status: 'completed',
    });
    
    // ✅ SQL: Update vendor rating (calculate from all reviews)
    const allReviews = await reviewsRepo.findByVendor(resolvedVendorId);
    const avgRating = allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : rating;
    
    await vendorsRepo.update(resolvedVendorId, {
      // Note: rating and review_count columns may need to be added to vendors table
      // For now, these can be calculated on-the-fly from reviews table
    });
    
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
