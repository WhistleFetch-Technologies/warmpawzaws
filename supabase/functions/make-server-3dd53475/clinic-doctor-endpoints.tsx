import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";

const app = new Hono();

/**
 * ========================================
 * CLINIC-DOCTOR MANAGEMENT ENDPOINTS
 * ========================================
 * 
 * Multi-level vendor capability system for Vet/Clinic, Grooming Centers, Training Centers
 * 
 * Two operational models:
 * 1. Independent Doctor/Trainer - Manages everything at their profile level
 * 2. Clinic/Center with Multiple Staff - Clinic manages roles, staff delivers services
 * 
 * Key Features:
 * - Clinic-level: Role management, appointment overview (no service delivery)
 * - Doctor/Staff-level: Full service delivery (chat, video, prescriptions)
 * - Customer sees: Clinic → Doctor list → Book with specific doctor
 */

// ========================================
// CLINIC MANAGEMENT
// ========================================

/**
 * Create or convert to clinic profile
 * POST /make-server-3dd53475/clinic/create
 */
app.post("/make-server-3dd53475/clinic/create", async (c) => {
  try {
    const {
      vendorId, // Existing vendor ID or null for new clinic
      businessName,
      ownerName,
      phone,
      email,
      address,
      city,
      state,
      pincode,
      roleId, // 'veterinary_clinic', 'grooming_center', 'training_center'
      facilities,
      operatingHours,
      coordinates,
      documents
    } = await c.req.json();

    console.log(`[CREATE CLINIC] Creating clinic profile for vendorId: ${vendorId || 'NEW'}`);

    let clinicId = vendorId;
    
    // If converting existing vendor to clinic
    if (vendorId) {
      const existingVendor = await kv.get(`vendor:${vendorId}`);
      if (!existingVendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }
      
      // Enhance vendor to clinic type
      existingVendor.isClinic = true;
      existingVendor.clinicProfile = {
        businessName,
        ownerName,
        phone,
        email,
        address,
        city,
        state,
        pincode,
        facilities,
        operatingHours,
        coordinates,
        doctors: [], // Staff members will be added separately
        totalDoctors: 0,
        activeAppointments: 0,
        totalAppointments: 0,
        createdAt: new Date().toISOString()
      };
      
      await kv.set(`vendor:${vendorId}`, existingVendor);
      console.log(`[CREATE CLINIC] ✅ Converted vendor ${vendorId} to clinic`);
      
    } else {
      // Create new clinic vendor
      clinicId = `vendor_clinic_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const clinicProfile = {
        id: clinicId,
        roleId,
        businessName,
        ownerName,
        phone,
        email,
        address,
        city,
        state,
        pincode,
        coordinates,
        isClinic: true,
        isActive: true,
        status: 'approved', // Assuming pre-approved for now
        facilities,
        operatingHours,
        doctors: [],
        totalDoctors: 0,
        activeAppointments: 0,
        totalAppointments: 0,
        totalEarnings: 0,
        rating: 0,
        totalReviews: 0,
        documents,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      await kv.set(`vendor:${clinicId}`, clinicProfile);
      
      // Create phone lookup
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      await kv.set(`vendor:phone:${cleanPhone}`, clinicId);
      
      console.log(`[CREATE CLINIC] ✅ Created new clinic ${clinicId}`);
    }

    return c.json({ 
      success: true, 
      clinicId,
      message: 'Clinic profile created successfully'
    });

  } catch (error) {
    console.error('[CREATE CLINIC] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Get clinic details with doctor list
 * GET /make-server-3dd53475/clinic/:clinicId
 */
app.get("/make-server-3dd53475/clinic/:clinicId", async (c) => {
  try {
    const { clinicId } = c.req.param();
    
    const clinic = await kv.get(`vendor:${clinicId}`);
    if (!clinic || !clinic.isClinic) {
      return c.json({ error: 'Clinic not found' }, 404);
    }

    // Fetch doctor profiles
    const doctors = [];
    if (clinic.doctors && clinic.doctors.length > 0) {
      for (const doctorId of clinic.doctors) {
        const doctor = await kv.get(`doctor:${doctorId}`);
        if (doctor) {
          doctors.push(doctor);
        }
      }
    }

    return c.json({
      clinic,
      doctors,
      totalDoctors: doctors.length
    });

  } catch (error) {
    console.error('[GET CLINIC] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Get all appointments for a clinic (admin view)
 * GET /make-server-3dd53475/clinic/:clinicId/appointments
 */
app.get("/make-server-3dd53475/clinic/:clinicId/appointments", async (c) => {
  try {
    const { clinicId } = c.req.param();
    const { status, date } = c.req.query();
    
    console.log(`[CLINIC APPOINTMENTS] Fetching for clinic ${clinicId}, status: ${status}, date: ${date}`);

    const clinic = await kv.get(`vendor:${clinicId}`);
    if (!clinic || !clinic.isClinic) {
      return c.json({ error: 'Clinic not found' }, 404);
    }

    // Get all doctors in this clinic
    const doctorIds = clinic.doctors || [];
    
    const allAppointments = [];
    
    // Fetch appointments for each doctor
    for (const doctorId of doctorIds) {
      const doctorBookingIds = await kv.get(`doctor:${doctorId}:bookings`) || [];
      
      for (const bookingId of doctorBookingIds) {
        const booking = await kv.get(`booking:${bookingId}`);
        if (booking) {
          // Get doctor details
          const doctor = await kv.get(`doctor:${doctorId}`);
          
          // Get customer details
          const customer = await kv.get(`customer:${booking.customerId}`);
          
          allAppointments.push({
            ...booking,
            doctorId,
            doctorName: doctor?.name || 'Unknown',
            doctorSpecialization: doctor?.specialization || [],
            customerName: customer?.name || booking.customerName,
            petName: booking.petName,
            consultationType: booking.serviceType || 'clinic_visit'
          });
        }
      }
    }

    // Filter by status if provided
    let filteredAppointments = allAppointments;
    if (status && status !== 'all') {
      filteredAppointments = allAppointments.filter(a => a.status === status);
    }

    // Filter by date if provided
    if (date) {
      filteredAppointments = filteredAppointments.filter(a => {
        const appointmentDate = new Date(a.date).toISOString().split('T')[0];
        return appointmentDate === date;
      });
    }

    // Sort by date and time (upcoming first)
    filteredAppointments.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });

    console.log(`[CLINIC APPOINTMENTS] ✅ Found ${filteredAppointments.length} appointments`);

    return c.json({
      appointments: filteredAppointments,
      total: filteredAppointments.length,
      clinicName: clinic.businessName
    });

  } catch (error) {
    console.error('[CLINIC APPOINTMENTS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Notify doctor that customer is at lobby
 * POST /make-server-3dd53475/clinic/:clinicId/notify-doctor
 */
app.post("/make-server-3dd53475/clinic/:clinicId/notify-doctor", async (c) => {
  try {
    const { clinicId } = c.req.param();
    const { doctorId, bookingId, customerName } = await c.req.json();

    console.log(`[LOBBY NOTIFICATION] Clinic ${clinicId} notifying doctor ${doctorId} about ${customerName}`);

    // Create notification for doctor
    const notification = {
      id: `notif_${Date.now()}`,
      type: 'customer_at_lobby',
      doctorId,
      clinicId,
      bookingId,
      customerName,
      message: `${customerName} is at the lobby for their appointment`,
      createdAt: new Date().toISOString(),
      isRead: false
    };

    // Save notification
    const doctorNotifications = await kv.get(`doctor:${doctorId}:notifications`) || [];
    doctorNotifications.unshift(notification);
    await kv.set(`doctor:${doctorId}:notifications`, doctorNotifications);

    // Update booking status
    const booking = await kv.get(`booking:${bookingId}`);
    if (booking) {
      booking.customerAtLobby = true;
      booking.lobbyArrivalTime = new Date().toISOString();
      await kv.set(`booking:${bookingId}`, booking);
    }

    console.log(`[LOBBY NOTIFICATION] ✅ Notification sent to doctor ${doctorId}`);

    return c.json({
      success: true,
      message: 'Doctor notified successfully'
    });

  } catch (error) {
    console.error('[LOBBY NOTIFICATION] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ========================================
// DOCTOR/STAFF MANAGEMENT
// ========================================

/**
 * Create doctor profile (independent or clinic-associated)
 * POST /make-server-3dd53475/doctor/create
 */
app.post("/make-server-3dd53475/doctor/create", async (c) => {
  try {
    const {
      name,
      email,
      phone,
      password, // For independent doctors who need login
      specialization, // Array: ['Cardiology', 'Surgery']
      experience, // Years
      qualifications,
      about,
      clinicId, // If associated with a clinic, null for independent
      services, // Array of service configurations
      schedule, // Doctor's availability
      consultationFee,
      profilePhoto,
      documents // Certifications, licenses
    } = await c.req.json();

    console.log(`[CREATE DOCTOR] Creating doctor profile, clinicId: ${clinicId || 'INDEPENDENT'}`);

    const doctorId = `doctor_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const isIndependent = !clinicId;

    const doctorProfile = {
      id: doctorId,
      name,
      email,
      phone,
      specialization,
      experience,
      qualifications,
      about,
      clinicId: clinicId || null,
      isIndependent,
      services: services || [],
      schedule: schedule || {
        monday: { enabled: true, slots: [] },
        tuesday: { enabled: true, slots: [] },
        wednesday: { enabled: true, slots: [] },
        thursday: { enabled: true, slots: [] },
        friday: { enabled: true, slots: [] },
        saturday: { enabled: true, slots: [] },
        sunday: { enabled: false, slots: [] }
      },
      consultationFee: consultationFee || 0,
      profilePhoto,
      documents,
      isActive: true,
      totalAppointments: 0,
      completedAppointments: 0,
      totalEarnings: 0,
      pendingEarnings: 0,
      rating: 0,
      totalReviews: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save doctor profile
    await kv.set(`doctor:${doctorId}`, doctorProfile);

    // Create phone lookup
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    await kv.set(`doctor:phone:${cleanPhone}`, doctorId);

    // If associated with clinic, add to clinic's doctor list
    if (clinicId) {
      const clinic = await kv.get(`vendor:${clinicId}`);
      if (clinic && clinic.isClinic) {
        clinic.doctors = clinic.doctors || [];
        clinic.doctors.push(doctorId);
        clinic.totalDoctors = clinic.doctors.length;
        clinic.updated_at = new Date().toISOString();
        await kv.set(`vendor:${clinicId}`, clinic);
        console.log(`[CREATE DOCTOR] ✅ Added doctor ${doctorId} to clinic ${clinicId}`);
      }
    }

    // For independent doctors, create vendor-like profile for login
    if (isIndependent && password) {
      // This would integrate with auth system
      // For now, just create a mapping
      await kv.set(`doctor:email:${email}`, doctorId);
      console.log(`[CREATE DOCTOR] ✅ Created independent doctor with login capability`);
    }

    console.log(`[CREATE DOCTOR] ✅ Created doctor ${doctorId}`);

    return c.json({
      success: true,
      doctorId,
      message: 'Doctor profile created successfully'
    });

  } catch (error) {
    console.error('[CREATE DOCTOR] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Get doctor profile
 * GET /make-server-3dd53475/doctor/:doctorId
 */
app.get("/make-server-3dd53475/doctor/:doctorId", async (c) => {
  try {
    const { doctorId } = c.req.param();
    
    const doctor = await kv.get(`doctor:${doctorId}`);
    if (!doctor) {
      return c.json({ error: 'Doctor not found' }, 404);
    }

    // Get clinic details if associated
    let clinicDetails = null;
    if (doctor.clinicId) {
      clinicDetails = await kv.get(`vendor:${doctor.clinicId}`);
    }

    return c.json({
      doctor,
      clinic: clinicDetails
    });

  } catch (error) {
    console.error('[GET DOCTOR] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Update doctor profile
 * PUT /make-server-3dd53475/doctor/:doctorId
 */
app.put("/make-server-3dd53475/doctor/:doctorId", async (c) => {
  try {
    const { doctorId } = c.req.param();
    const updates = await c.req.json();

    console.log(`[UPDATE DOCTOR] Updating doctor ${doctorId}`);

    const doctor = await kv.get(`doctor:${doctorId}`);
    if (!doctor) {
      return c.json({ error: 'Doctor not found' }, 404);
    }

    // Update fields
    const updatedDoctor = {
      ...doctor,
      ...updates,
      updated_at: new Date().toISOString()
    };

    await kv.set(`doctor:${doctorId}`, updatedDoctor);

    console.log(`[UPDATE DOCTOR] ✅ Updated doctor ${doctorId}`);

    return c.json({
      success: true,
      doctor: updatedDoctor
    });

  } catch (error) {
    console.error('[UPDATE DOCTOR] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Configure doctor services
 * PUT /make-server-3dd53475/doctor/:doctorId/services
 */
app.put("/make-server-3dd53475/doctor/:doctorId/services", async (c) => {
  try {
    const { doctorId } = c.req.param();
    const { services } = await c.req.json();

    console.log(`[DOCTOR SERVICES] Configuring services for doctor ${doctorId}`);

    const doctor = await kv.get(`doctor:${doctorId}`);
    if (!doctor) {
      return c.json({ error: 'Doctor not found' }, 404);
    }

    doctor.services = services;
    doctor.updated_at = new Date().toISOString();

    await kv.set(`doctor:${doctorId}`, doctor);

    console.log(`[DOCTOR SERVICES] ✅ Configured ${services.length} services for doctor ${doctorId}`);

    return c.json({
      success: true,
      services: doctor.services
    });

  } catch (error) {
    console.error('[DOCTOR SERVICES] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Get doctor's schedule
 * GET /make-server-3dd53475/doctor/:doctorId/schedule
 */
app.get("/make-server-3dd53475/doctor/:doctorId/schedule", async (c) => {
  try {
    const { doctorId } = c.req.param();
    const { date } = c.req.query();

    const doctor = await kv.get(`doctor:${doctorId}`);
    if (!doctor) {
      return c.json({ error: 'Doctor not found' }, 404);
    }

    // Get booked slots for the date
    const doctorBookingIds = await kv.get(`doctor:${doctorId}:bookings`) || [];
    const bookedSlots = [];

    for (const bookingId of doctorBookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking && booking.date === date) {
        bookedSlots.push({
          time: booking.time,
          duration: booking.duration || 30,
          customerName: booking.customerName
        });
      }
    }

    return c.json({
      schedule: doctor.schedule,
      bookedSlots,
      availableSlots: [] // This would be computed based on schedule and booked slots
    });

  } catch (error) {
    console.error('[DOCTOR SCHEDULE] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Get doctor's appointments
 * GET /make-server-3dd53475/doctor/:doctorId/appointments
 */
app.get("/make-server-3dd53475/doctor/:doctorId/appointments", async (c) => {
  try {
    const { doctorId } = c.req.param();
    const { status, date } = c.req.query();

    console.log(`[DOCTOR APPOINTMENTS] Fetching for doctor ${doctorId}, status: ${status}, date: ${date}`);

    const doctor = await kv.get(`doctor:${doctorId}`);
    if (!doctor) {
      return c.json({ error: 'Doctor not found' }, 404);
    }

    const doctorBookingIds = await kv.get(`doctor:${doctorId}:bookings`) || [];
    const appointments = [];

    for (const bookingId of doctorBookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (booking) {
        // Apply filters
        if (status && status !== 'all' && booking.status !== status) {
          continue;
        }
        if (date && booking.date !== date) {
          continue;
        }

        // Get customer and pet details
        const customer = await kv.get(`customer:${booking.customerId}`);
        const pet = booking.petId ? await kv.get(`pet:${booking.petId}`) : null;

        appointments.push({
          ...booking,
          customerName: customer?.name || booking.customerName,
          customerPhone: customer?.phone || booking.customerPhone,
          petDetails: pet
        });
      }
    }

    // Sort by date and time
    appointments.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateA.getTime() - dateB.getTime();
    });

    console.log(`[DOCTOR APPOINTMENTS] ✅ Found ${appointments.length} appointments`);

    return c.json({
      appointments,
      total: appointments.length,
      doctorName: doctor.name
    });

  } catch (error) {
    console.error('[DOCTOR APPOINTMENTS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Get doctor's earnings
 * GET /make-server-3dd53475/doctor/:doctorId/earnings
 */
app.get("/make-server-3dd53475/doctor/:doctorId/earnings", async (c) => {
  try {
    const { doctorId } = c.req.param();
    const { period } = c.req.query(); // 'today', 'week', 'month'

    const doctor = await kv.get(`doctor:${doctorId}`);
    if (!doctor) {
      return c.json({ error: 'Doctor not found' }, 404);
    }

    const doctorBookingIds = await kv.get(`doctor:${doctorId}:bookings`) || [];
    
    let totalEarnings = 0;
    let pendingEarnings = 0;
    let completedBookings = 0;

    const now = new Date();
    const today = now.toISOString().split('T')[0];

    for (const bookingId of doctorBookingIds) {
      const booking = await kv.get(`booking:${bookingId}`);
      if (!booking) continue;

      // Filter by period if specified
      if (period === 'today' && booking.date !== today) continue;
      if (period === 'week') {
        const bookingDate = new Date(booking.date);
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (bookingDate < weekAgo) continue;
      }
      if (period === 'month') {
        const bookingDate = new Date(booking.date);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (bookingDate < monthAgo) continue;
      }

      if (booking.status === 'completed') {
        totalEarnings += booking.totalAmount || 0;
        completedBookings++;
      } else if (booking.status === 'confirmed' || booking.status === 'in_progress') {
        pendingEarnings += booking.totalAmount || 0;
      }
    }

    return c.json({
      totalEarnings,
      pendingEarnings,
      completedBookings,
      period: period || 'all'
    });

  } catch (error) {
    console.error('[DOCTOR EARNINGS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Remove doctor from clinic
 * DELETE /make-server-3dd53475/clinic/:clinicId/doctor/:doctorId
 */
app.delete("/make-server-3dd53475/clinic/:clinicId/doctor/:doctorId", async (c) => {
  try {
    const { clinicId, doctorId } = c.req.param();

    console.log(`[REMOVE DOCTOR] Removing doctor ${doctorId} from clinic ${clinicId}`);

    const clinic = await kv.get(`vendor:${clinicId}`);
    if (!clinic || !clinic.isClinic) {
      return c.json({ error: 'Clinic not found' }, 404);
    }

    const doctor = await kv.get(`doctor:${doctorId}`);
    if (!doctor) {
      return c.json({ error: 'Doctor not found' }, 404);
    }

    // Remove from clinic's doctor list
    clinic.doctors = (clinic.doctors || []).filter((id: string) => id !== doctorId);
    clinic.totalDoctors = clinic.doctors.length;
    clinic.updated_at = new Date().toISOString();
    await kv.set(`vendor:${clinicId}`, clinic);

    // Update doctor profile
    doctor.clinicId = null;
    doctor.isIndependent = true;
    doctor.updated_at = new Date().toISOString();
    await kv.set(`doctor:${doctorId}`, doctor);

    console.log(`[REMOVE DOCTOR] ✅ Removed doctor ${doctorId} from clinic ${clinicId}`);

    return c.json({
      success: true,
      message: 'Doctor removed from clinic successfully'
    });

  } catch (error) {
    console.error('[REMOVE DOCTOR] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

// ========================================
// CUSTOMER-FACING ENDPOINTS
// ========================================

/**
 * Get all clinics by role type
 * GET /make-server-3dd53475/clinics
 */
app.get("/make-server-3dd53475/clinics", async (c) => {
  try {
    const { roleId, city } = c.req.query();
    
    console.log(`[GET CLINICS] Fetching clinics, roleId: ${roleId}, city: ${city}`);

    const allVendors = await kv.getByPrefix('vendor:vendor_');
    
    let clinics = allVendors.filter((v: any) => {
      if (!v || !v.isClinic || !v.isActive) return false;
      if (roleId && v.roleId !== roleId) return false;
      if (city && v.city !== city) return false;
      return true;
    });

    // Enrich with doctor count
    for (const clinic of clinics) {
      clinic.doctorCount = (clinic.doctors || []).length;
    }

    // Sort by rating
    clinics.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));

    console.log(`[GET CLINICS] ✅ Found ${clinics.length} clinics`);

    return c.json({
      clinics,
      total: clinics.length
    });

  } catch (error) {
    console.error('[GET CLINICS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Get doctors for a specific clinic
 * GET /make-server-3dd53475/clinic/:clinicId/doctors
 */
app.get("/make-server-3dd53475/clinic/:clinicId/doctors", async (c) => {
  try {
    const { clinicId } = c.req.param();
    
    const clinic = await kv.get(`vendor:${clinicId}`);
    if (!clinic || !clinic.isClinic) {
      return c.json({ error: 'Clinic not found' }, 404);
    }

    const doctors = [];
    for (const doctorId of (clinic.doctors || [])) {
      const doctor = await kv.get(`doctor:${doctorId}`);
      if (doctor && doctor.isActive) {
        // Include service count
        doctor.serviceCount = (doctor.services || []).length;
        doctors.push(doctor);
      }
    }

    // Sort by experience (most experienced first)
    doctors.sort((a: any, b: any) => (b.experience || 0) - (a.experience || 0));

    return c.json({
      doctors,
      total: doctors.length,
      clinicName: clinic.businessName
    });

  } catch (error) {
    console.error('[GET CLINIC DOCTORS] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * Get doctor's available services
 * GET /make-server-3dd53475/doctor/:doctorId/services
 */
app.get("/make-server-3dd53475/doctor/:doctorId/services", async (c) => {
  try {
    const { doctorId } = c.req.param();
    
    const doctor = await kv.get(`doctor:${doctorId}`);
    if (!doctor) {
      return c.json({ error: 'Doctor not found' }, 404);
    }

    return c.json({
      services: doctor.services || [],
      doctorName: doctor.name,
      specialization: doctor.specialization
    });

  } catch (error) {
    console.error('[GET DOCTOR SERVICES] Error:', error);
    return c.json({ error: String(error) }, 500);
  }
});

export default app;
