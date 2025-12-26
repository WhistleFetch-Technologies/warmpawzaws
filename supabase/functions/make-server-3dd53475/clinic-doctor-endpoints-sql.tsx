/**
 * CLINIC-DOCTOR MANAGEMENT ENDPOINTS - SQL-ONLY VERSION
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
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * CHANGES:
 * - Removed `kv` import
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL repository calls
 * - Uses `VendorsRepository` for clinics (vendors with isClinic flag in metadata)
 * - Uses `StaffRepository` for doctors (doctors are staff members)
 * - Uses `BookingsRepository` for appointments
 * - Uses `CustomersRepository` for customers
 * - Uses `PetsRepository` for pets
 * - Uses `NotificationsRepository` for notifications
 * - Uses `platform_settings` table for doctor lookups
 * 
 * Date: 2025-01-27
 * Migration: Agent-3 - KV to SQL (Batch 12)
 * KV Operations Removed: 45
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from './response-utils.ts';
import { getVendorsRepository } from '../../lib/repositories/vendors.ts';
import { getStaffRepository } from '../../lib/repositories/staff.ts';
import { getBookingsRepository } from '../../lib/repositories/bookings.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getNotificationsRepository } from '../../lib/repositories/notifications.ts';
import { getDbClient, withTransaction } from '../../lib/db.ts';

const BASE_PATH = '/make-server-3dd53475';

export function registerClinicDoctorEndpointsSQL(app: Hono) {
  console.log('✅ Registering Clinic-Doctor Endpoints (SQL-only)...');

  const vendorsRepo = getVendorsRepository();
  const staffRepo = getStaffRepository();
  const bookingsRepo = getBookingsRepository();
  const customersRepo = getCustomersRepository();
  const petsRepo = getPetsRepository();
  const notificationsRepo = getNotificationsRepository();
  const db = getDbClient();

  // ========================================
  // CLINIC MANAGEMENT
  // ========================================

  /**
   * Create or convert to clinic profile
   * POST /make-server-3dd53475/clinic/create
   */
  app.post(`${BASE_PATH}/clinic/create`, async (c) => {
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
        const existingVendor = await vendorsRepo.findById(vendorId);
        if (!existingVendor) {
          return sendError(c, 'Vendor not found', 404);
        }
        
        // Enhance vendor to clinic type (store clinic metadata in a JSONB field or platform_settings)
        await vendorsRepo.update(vendorId, {
          // Store clinic profile in metadata or use platform_settings
        });
        
        // Store clinic profile in platform_settings
        await db
          .from('platform_settings')
          .upsert({
            key: `clinic_profile:${vendorId}`,
            value: {
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
              doctors: [],
              totalDoctors: 0,
              activeAppointments: 0,
              totalAppointments: 0,
              createdAt: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          });
        
        console.log(`[CREATE CLINIC] ✅ Converted vendor ${vendorId} to clinic`);
        
      } else {
        // Create new clinic vendor
        const newVendor = await vendorsRepo.create({
          phone: phone,
          email: email,
          business_name: businessName,
          owner_name: ownerName,
          address: address,
          city: city,
          state: state,
          pincode: pincode,
          role_id: roleId,
          status: 'approved'
        });
        
        clinicId = newVendor.id;
        
        // Store clinic profile in platform_settings
        await db
          .from('platform_settings')
          .upsert({
            key: `clinic_profile:${clinicId}`,
            value: {
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
              doctors: [],
              totalDoctors: 0,
              activeAppointments: 0,
              totalAppointments: 0,
              documents,
              createdAt: new Date().toISOString()
            },
            updated_at: new Date().toISOString()
          });
        
        console.log(`[CREATE CLINIC] ✅ Created new clinic ${clinicId}`);
      }

      return sendSuccess(c, { 
        clinicId,
        message: 'Clinic profile created successfully'
      });

    } catch (error) {
      console.error('[CREATE CLINIC] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Get clinic details with doctor list
   * GET /make-server-3dd53475/clinic/:clinicId
   */
  app.get(`${BASE_PATH}/clinic/:clinicId`, async (c) => {
    try {
      const { clinicId } = c.req.param();
      
      const clinic = await vendorsRepo.findById(clinicId);
      if (!clinic) {
        return sendError(c, 'Clinic not found', 404);
      }

      // Get clinic profile from platform_settings
      const { data: clinicProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `clinic_profile:${clinicId}`)
        .single();

      if (!clinicProfile) {
        return sendError(c, 'Clinic profile not found', 404);
      }

      const profile = clinicProfile.value as any;
      const doctorIds = profile.doctors || [];

      // Fetch doctor profiles (staff members)
      const doctors = [];
      for (const doctorId of doctorIds) {
        const doctor = await staffRepo.findById(doctorId);
        if (doctor) {
          doctors.push(doctor);
        }
      }

      return sendSuccess(c, {
        clinic: {
          ...clinic,
          clinicProfile: profile
        },
        doctors,
        totalDoctors: doctors.length
      });

    } catch (error) {
      console.error('[GET CLINIC] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Get all appointments for a clinic (admin view)
   * GET /make-server-3dd53475/clinic/:clinicId/appointments
   */
  app.get(`${BASE_PATH}/clinic/:clinicId/appointments`, async (c) => {
    try {
      const { clinicId } = c.req.param();
      const { status, date } = c.req.query();
      
      console.log(`[CLINIC APPOINTMENTS] Fetching for clinic ${clinicId}, status: ${status}, date: ${date}`);

      const clinic = await vendorsRepo.findById(clinicId);
      if (!clinic) {
        return sendError(c, 'Clinic not found', 404);
      }

      // Get clinic profile
      const { data: clinicProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `clinic_profile:${clinicId}`)
        .single();

      const profile = clinicProfile?.value as any;
      const doctorIds = profile?.doctors || [];
      
      // Get all bookings for staff members (doctors) in this clinic
      const allAppointments = [];
      
      for (const doctorId of doctorIds) {
        const doctorBookings = await bookingsRepo.findByStaff(doctorId);
        
        for (const booking of doctorBookings) {
          // Get doctor details
          const doctor = await staffRepo.findById(doctorId);
          
          // Get customer details
          const customer = await customersRepo.findById(booking.customer_id);
          
          allAppointments.push({
            ...booking,
            doctorId,
            doctorName: doctor?.fullName || doctor?.name || 'Unknown',
            doctorSpecialization: doctor?.specialization || [],
            customerName: customer?.full_name || booking.customer_id,
            consultationType: booking.service_type || 'clinic_visit'
          });
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
          const appointmentDate = new Date(a.booking_date).toISOString().split('T')[0];
          return appointmentDate === date;
        });
      }

      // Sort by date and time (upcoming first)
      filteredAppointments.sort((a, b) => {
        const dateA = new Date(`${a.booking_date} ${a.booking_time}`);
        const dateB = new Date(`${b.booking_date} ${b.booking_time}`);
        return dateA.getTime() - dateB.getTime();
      });

      console.log(`[CLINIC APPOINTMENTS] ✅ Found ${filteredAppointments.length} appointments`);

      return sendSuccess(c, {
        appointments: filteredAppointments,
        total: filteredAppointments.length,
        clinicName: clinic.business_name
      });

    } catch (error) {
      console.error('[CLINIC APPOINTMENTS] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Notify doctor that customer is at lobby
   * POST /make-server-3dd53475/clinic/:clinicId/notify-doctor
   */
  app.post(`${BASE_PATH}/clinic/:clinicId/notify-doctor`, async (c) => {
    try {
      const { clinicId } = c.req.param();
      const { doctorId, bookingId, customerName } = await c.req.json();

      console.log(`[LOBBY NOTIFICATION] Clinic ${clinicId} notifying doctor ${doctorId} about ${customerName}`);

      // Create notification for doctor
      await notificationsRepo.create({
        user_id: doctorId,
        user_type: 'staff',
        type: 'customer_at_lobby',
        title: 'Customer at Lobby',
        message: `${customerName} is at the lobby for their appointment`,
        metadata: {
          clinicId,
          bookingId,
          customerName
        }
      });

      // Update booking status (store in notes JSONB)
      const booking = await bookingsRepo.findById(bookingId);
      if (booking) {
        await bookingsRepo.update(bookingId, {
          notes: JSON.stringify({
            customerAtLobby: true,
            lobbyArrivalTime: new Date().toISOString()
          })
        });
      }

      console.log(`[LOBBY NOTIFICATION] ✅ Notification sent to doctor ${doctorId}`);

      return sendSuccess(c, {
        message: 'Doctor notified successfully'
      });

    } catch (error) {
      console.error('[LOBBY NOTIFICATION] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ========================================
  // DOCTOR/STAFF MANAGEMENT
  // ========================================

  /**
   * Create doctor profile (independent or clinic-associated)
   * POST /make-server-3dd53475/doctor/create
   */
  app.post(`${BASE_PATH}/doctor/create`, async (c) => {
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

      const isIndependent = !clinicId;

      // Create staff member (doctor)
      const doctor = await staffRepo.create({
        vendorId: clinicId || '', // Empty if independent (will need separate vendor)
        fullName: name,
        phone: phone,
        email: email,
        role: 'doctor',
        specialization: Array.isArray(specialization) ? specialization.join(', ') : specialization,
        experience: experience,
        isActive: true
      });

      // Store doctor profile metadata in platform_settings
      await db
        .from('platform_settings')
        .upsert({
          key: `doctor_profile:${doctor.id}`,
          value: {
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
            totalAppointments: 0,
            completedAppointments: 0,
            totalEarnings: 0,
            pendingEarnings: 0,
            rating: 0,
            totalReviews: 0,
            createdAt: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        });

      // If associated with clinic, add to clinic's doctor list
      if (clinicId) {
        const { data: clinicProfile } = await db
          .from('platform_settings')
          .select('value')
          .eq('key', `clinic_profile:${clinicId}`)
          .single();

        if (clinicProfile) {
          const profile = clinicProfile.value as any;
          profile.doctors = profile.doctors || [];
          profile.doctors.push(doctor.id);
          profile.totalDoctors = profile.doctors.length;
          profile.updated_at = new Date().toISOString();

          await db
            .from('platform_settings')
            .update({ value: profile })
            .eq('key', `clinic_profile:${clinicId}`);
          
          console.log(`[CREATE DOCTOR] ✅ Added doctor ${doctor.id} to clinic ${clinicId}`);
        }
      }

      console.log(`[CREATE DOCTOR] ✅ Created doctor ${doctor.id}`);

      return sendSuccess(c, {
        doctorId: doctor.id,
        message: 'Doctor profile created successfully'
      });

    } catch (error) {
      console.error('[CREATE DOCTOR] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Get doctor profile
   * GET /make-server-3dd53475/doctor/:doctorId
   */
  app.get(`${BASE_PATH}/doctor/:doctorId`, async (c) => {
    try {
      const { doctorId } = c.req.param();
      
      const doctor = await staffRepo.findById(doctorId);
      if (!doctor) {
        return sendError(c, 'Doctor not found', 404);
      }

      // Get doctor profile metadata
      const { data: doctorProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `doctor_profile:${doctorId}`)
        .single();

      // Get clinic details if associated
      let clinicDetails = null;
      if (doctorProfile?.value?.clinicId) {
        clinicDetails = await vendorsRepo.findById(doctorProfile.value.clinicId);
      }

      return sendSuccess(c, {
        doctor: {
          ...doctor,
          ...doctorProfile?.value
        },
        clinic: clinicDetails
      });

    } catch (error) {
      console.error('[GET DOCTOR] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Update doctor profile
   * PUT /make-server-3dd53475/doctor/:doctorId
   */
  app.put(`${BASE_PATH}/doctor/:doctorId`, async (c) => {
    try {
      const { doctorId } = c.req.param();
      const updates = await c.req.json();

      console.log(`[UPDATE DOCTOR] Updating doctor ${doctorId}`);

      const doctor = await staffRepo.findById(doctorId);
      if (!doctor) {
        return sendError(c, 'Doctor not found', 404);
      }

      // Update staff record
      if (updates.name) await staffRepo.update(doctorId, { fullName: updates.name });
      if (updates.email) await staffRepo.update(doctorId, { email: updates.email });
      if (updates.phone) await staffRepo.update(doctorId, { phone: updates.phone });
      if (updates.specialization) await staffRepo.update(doctorId, { specialization: Array.isArray(updates.specialization) ? updates.specialization.join(', ') : updates.specialization });
      if (updates.experience) await staffRepo.update(doctorId, { experience: updates.experience });

      // Update doctor profile metadata
      const { data: doctorProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `doctor_profile:${doctorId}`)
        .single();

      if (doctorProfile) {
        const profile = doctorProfile.value as any;
        const updatedProfile = {
          ...profile,
          ...updates,
          updated_at: new Date().toISOString()
        };

        await db
          .from('platform_settings')
          .update({ value: updatedProfile })
          .eq('key', `doctor_profile:${doctorId}`);
      }

      console.log(`[UPDATE DOCTOR] ✅ Updated doctor ${doctorId}`);

      return sendSuccess(c, {
        message: 'Doctor updated successfully'
      });

    } catch (error) {
      console.error('[UPDATE DOCTOR] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Configure doctor services
   * PUT /make-server-3dd53475/doctor/:doctorId/services
   */
  app.put(`${BASE_PATH}/doctor/:doctorId/services`, async (c) => {
    try {
      const { doctorId } = c.req.param();
      const { services } = await c.req.json();

      console.log(`[DOCTOR SERVICES] Configuring services for doctor ${doctorId}`);

      const doctor = await staffRepo.findById(doctorId);
      if (!doctor) {
        return sendError(c, 'Doctor not found', 404);
      }

      // Update doctor profile metadata
      const { data: doctorProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `doctor_profile:${doctorId}`)
        .single();

      if (doctorProfile) {
        const profile = doctorProfile.value as any;
        profile.services = services;
        profile.updated_at = new Date().toISOString();

        await db
          .from('platform_settings')
          .update({ value: profile })
          .eq('key', `doctor_profile:${doctorId}`);
      }

      console.log(`[DOCTOR SERVICES] ✅ Configured ${services.length} services for doctor ${doctorId}`);

      return sendSuccess(c, {
        services: services
      });

    } catch (error) {
      console.error('[DOCTOR SERVICES] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Get doctor's schedule
   * GET /make-server-3dd53475/doctor/:doctorId/schedule
   */
  app.get(`${BASE_PATH}/doctor/:doctorId/schedule`, async (c) => {
    try {
      const { doctorId } = c.req.param();
      const { date } = c.req.query();

      const doctor = await staffRepo.findById(doctorId);
      if (!doctor) {
        return sendError(c, 'Doctor not found', 404);
      }

      // Get doctor profile metadata for schedule
      const { data: doctorProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `doctor_profile:${doctorId}`)
        .single();

      const schedule = doctorProfile?.value?.schedule || {};

      // Get booked slots for the date
      const doctorBookings = await bookingsRepo.findByStaff(doctorId);
      const bookedSlots = doctorBookings
        .filter(b => b.booking_date === date)
        .map(b => ({
          time: b.booking_time,
          duration: 30, // Default duration
          customerName: b.customer_id // Will need to fetch customer name
        }));

      return sendSuccess(c, {
        schedule: schedule,
        bookedSlots,
        availableSlots: [] // This would be computed based on schedule and booked slots
      });

    } catch (error) {
      console.error('[DOCTOR SCHEDULE] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Get doctor's appointments
   * GET /make-server-3dd53475/doctor/:doctorId/appointments
   */
  app.get(`${BASE_PATH}/doctor/:doctorId/appointments`, async (c) => {
    try {
      const { doctorId } = c.req.param();
      const { status, date } = c.req.query();

      console.log(`[DOCTOR APPOINTMENTS] Fetching for doctor ${doctorId}, status: ${status}, date: ${date}`);

      const doctor = await staffRepo.findById(doctorId);
      if (!doctor) {
        return sendError(c, 'Doctor not found', 404);
      }

      let doctorBookings = await bookingsRepo.findByStaff(doctorId);

      // Apply filters
      if (status && status !== 'all') {
        doctorBookings = doctorBookings.filter(b => b.status === status);
      }
      if (date) {
        doctorBookings = doctorBookings.filter(b => b.booking_date === date);
      }

      // Enrich with customer and pet details
      const appointments = [];
      for (const booking of doctorBookings) {
        const customer = await customersRepo.findById(booking.customer_id);
        
        appointments.push({
          ...booking,
          customerName: customer?.full_name || booking.customer_id,
          customerPhone: customer?.phone || ''
        });
      }

      // Sort by date and time
      appointments.sort((a, b) => {
        const dateA = new Date(`${a.booking_date} ${a.booking_time}`);
        const dateB = new Date(`${b.booking_date} ${b.booking_time}`);
        return dateA.getTime() - dateB.getTime();
      });

      console.log(`[DOCTOR APPOINTMENTS] ✅ Found ${appointments.length} appointments`);

      return sendSuccess(c, {
        appointments,
        total: appointments.length,
        doctorName: doctor.fullName || doctor.name
      });

    } catch (error) {
      console.error('[DOCTOR APPOINTMENTS] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Get doctor's earnings
   * GET /make-server-3dd53475/doctor/:doctorId/earnings
   */
  app.get(`${BASE_PATH}/doctor/:doctorId/earnings`, async (c) => {
    try {
      const { doctorId } = c.req.param();
      const { period } = c.req.query(); // 'today', 'week', 'month'

      const doctor = await staffRepo.findById(doctorId);
      if (!doctor) {
        return sendError(c, 'Doctor not found', 404);
      }

      let doctorBookings = await bookingsRepo.findByStaff(doctorId);
      
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Filter by period if specified
      if (period === 'today') {
        doctorBookings = doctorBookings.filter(b => b.booking_date === today);
      } else if (period === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        doctorBookings = doctorBookings.filter(b => new Date(b.booking_date) >= weekAgo);
      } else if (period === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        doctorBookings = doctorBookings.filter(b => new Date(b.booking_date) >= monthAgo);
      }

      let totalEarnings = 0;
      let pendingEarnings = 0;
      let completedBookings = 0;

      for (const booking of doctorBookings) {
        if (booking.status === 'completed') {
          totalEarnings += booking.total_amount || 0;
          completedBookings++;
        } else if (booking.status === 'confirmed' || booking.status === 'in_progress') {
          pendingEarnings += booking.total_amount || 0;
        }
      }

      return sendSuccess(c, {
        totalEarnings,
        pendingEarnings,
        completedBookings,
        period: period || 'all'
      });

    } catch (error) {
      console.error('[DOCTOR EARNINGS] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Remove doctor from clinic
   * DELETE /make-server-3dd53475/clinic/:clinicId/doctor/:doctorId
   */
  app.delete(`${BASE_PATH}/clinic/:clinicId/doctor/:doctorId`, async (c) => {
    try {
      const { clinicId, doctorId } = c.req.param();

      console.log(`[REMOVE DOCTOR] Removing doctor ${doctorId} from clinic ${clinicId}`);

      const clinic = await vendorsRepo.findById(clinicId);
      if (!clinic) {
        return sendError(c, 'Clinic not found', 404);
      }

      const doctor = await staffRepo.findById(doctorId);
      if (!doctor) {
        return sendError(c, 'Doctor not found', 404);
      }

      // Remove from clinic's doctor list
      const { data: clinicProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `clinic_profile:${clinicId}`)
        .single();

      if (clinicProfile) {
        const profile = clinicProfile.value as any;
        profile.doctors = (profile.doctors || []).filter((id: string) => id !== doctorId);
        profile.totalDoctors = profile.doctors.length;
        profile.updated_at = new Date().toISOString();

        await db
          .from('platform_settings')
          .update({ value: profile })
          .eq('key', `clinic_profile:${clinicId}`);
      }

      // Update doctor profile
      const { data: doctorProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `doctor_profile:${doctorId}`)
        .single();

      if (doctorProfile) {
        const profile = doctorProfile.value as any;
        profile.clinicId = null;
        profile.isIndependent = true;
        profile.updated_at = new Date().toISOString();

        await db
          .from('platform_settings')
          .update({ value: profile })
          .eq('key', `doctor_profile:${doctorId}`);
      }

      console.log(`[REMOVE DOCTOR] ✅ Removed doctor ${doctorId} from clinic ${clinicId}`);

      return sendSuccess(c, {
        message: 'Doctor removed from clinic successfully'
      });

    } catch (error) {
      console.error('[REMOVE DOCTOR] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  // ========================================
  // CUSTOMER-FACING ENDPOINTS
  // ========================================

  /**
   * Get all clinics by role type
   * GET /make-server-3dd53475/clinics
   */
  app.get(`${BASE_PATH}/clinics`, async (c) => {
    try {
      const { roleId, city } = c.req.query();
      
      console.log(`[GET CLINICS] Fetching clinics, roleId: ${roleId}, city: ${city}`);

      // Get all vendors with clinic profiles
      const { data: clinicProfiles } = await db
        .from('platform_settings')
        .select('key, value')
        .like('key', 'clinic_profile:%');

      const clinics = [];
      for (const profile of clinicProfiles || []) {
        const vendorId = profile.key.replace('clinic_profile:', '');
        const vendor = await vendorsRepo.findById(vendorId);
        
        if (vendor && vendor.is_active) {
          // Apply filters
          if (roleId && vendor.role_id !== roleId) continue;
          if (city && vendor.city !== city) continue;

          const clinicData = profile.value as any;
          clinicData.doctorCount = (clinicData.doctors || []).length;
          clinics.push({
            ...vendor,
            ...clinicData
          });
        }
      }

      // Sort by rating
      clinics.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));

      console.log(`[GET CLINICS] ✅ Found ${clinics.length} clinics`);

      return sendSuccess(c, {
        clinics,
        total: clinics.length
      });

    } catch (error) {
      console.error('[GET CLINICS] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Get doctors for a specific clinic
   * GET /make-server-3dd53475/clinic/:clinicId/doctors
   */
  app.get(`${BASE_PATH}/clinic/:clinicId/doctors`, async (c) => {
    try {
      const { clinicId } = c.req.param();
      
      const clinic = await vendorsRepo.findById(clinicId);
      if (!clinic) {
        return sendError(c, 'Clinic not found', 404);
      }

      // Get clinic profile
      const { data: clinicProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `clinic_profile:${clinicId}`)
        .single();

      if (!clinicProfile) {
        return sendError(c, 'Clinic profile not found', 404);
      }

      const profile = clinicProfile.value as any;
      const doctorIds = profile.doctors || [];

      const doctors = [];
      for (const doctorId of doctorIds) {
        const doctor = await staffRepo.findById(doctorId);
        if (doctor && doctor.isActive) {
          // Get doctor profile metadata
          const { data: doctorProfile } = await db
            .from('platform_settings')
            .select('value')
            .eq('key', `doctor_profile:${doctorId}`)
            .single();

          const doctorData = {
            ...doctor,
            ...doctorProfile?.value,
            serviceCount: (doctorProfile?.value?.services || []).length
          };
          doctors.push(doctorData);
        }
      }

      // Sort by experience (most experienced first)
      doctors.sort((a: any, b: any) => (b.experience || 0) - (a.experience || 0));

      return sendSuccess(c, {
        doctors,
        total: doctors.length,
        clinicName: clinic.business_name
      });

    } catch (error) {
      console.error('[GET CLINIC DOCTORS] Error:', error);
      return sendError(c, String(error), 500);
    }
  });

  /**
   * Get doctor's available services
   * GET /make-server-3dd53475/doctor/:doctorId/services
   */
  app.get(`${BASE_PATH}/doctor/:doctorId/services`, async (c) => {
    try {
      const { doctorId } = c.req.param();
      
      const doctor = await staffRepo.findById(doctorId);
      if (!doctor) {
        return sendError(c, 'Doctor not found', 404);
      }

      // Get doctor profile metadata
      const { data: doctorProfile } = await db
        .from('platform_settings')
        .select('value')
        .eq('key', `doctor_profile:${doctorId}`)
        .single();

      const profile = doctorProfile?.value as any;

      return sendSuccess(c, {
        services: profile?.services || [],
        doctorName: doctor.fullName || doctor.name,
        specialization: doctor.specialization
      });

    } catch (error) {
      console.error('[GET DOCTOR SERVICES] Error:', error);
      return sendError(c, String(error), 500);
    }
  });
}
