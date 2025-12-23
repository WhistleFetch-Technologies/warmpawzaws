/**
 * ============================================================================
 * CUSTOMER ROUTES - SQL-ONLY VERSION
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete customer-facing API endpoints:
 * - OTP & Authentication
 * - Customer Profile Management
 * - Pet Management
 * - Service Discovery
 * - Vendor Discovery
 * - Booking Management
 * - Rating & Review
 * - Notifications
 * 
 * CHANGES:
 * - Removed `kv` parameter from function signature
 * - Replaced all `kv.get()`, `kv.set()`, `kv.del()` with repository calls
 * - All data now comes from SQL tables
 * 
 * Date: 2024-12-22
 * Migration: Phase 5 - KV to SQL
 * ============================================================================
 */

import { Hono } from "npm:hono";
import type { Customer, Pet, Booking, ChatMessage, Review, Notification } from "./database-schema.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { normalizePhone, isValidIndianMobile } from "./phone-utils.tsx";
import { getOtpRepository } from "../../lib/repositories/otp.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getPetsRepository } from "../../lib/repositories/pets.ts";
import { getSessionsRepository } from "../../lib/repositories/sessions.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getServicesRepository } from "../../lib/repositories/services.ts";
import { getReviewsRepository } from "../../lib/repositories/reviews.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getSearchHistoryRepository } from "../../lib/repositories/search-history.ts";
import { getDbClient } from "../../lib/db.ts";

export function registerCustomerRoutes(app: Hono) {
  console.log('✅ Registering Customer Routes (SQL-only)...');

  // ============================================
  // OTP & AUTHENTICATION
  // ============================================

  // Generate OTP
  app.post("/make-server-3dd53475/otp/generate", async (c) => {
    try {
      console.log('📱 [OTP-GENERATE] Request received');
      const body = await c.req.json();
      console.log('📱 [OTP-GENERATE] Request body:', body);
      
      let { phone } = body;
      
      if (!phone) {
        console.error('❌ [OTP-GENERATE] Phone number missing');
        return sendError(c, 'Phone number is required', 400);
      }
      
      // ✅ CRITICAL FIX: Normalize phone number
      phone = normalizePhone(phone);
      console.log(`📱 [OTP-GENERATE] Normalized phone: ${phone}`);
      
      if (!isValidIndianMobile(phone)) {
        console.error('❌ [OTP-GENERATE] Invalid phone number:', phone);
        return sendError(c, 'Valid 10-digit Indian mobile number required', 400);
      }
      
      console.log(`🔑 [OTP-GENERATE] Generating OTP for: ${phone}`);
      
      // ⚠️ UAT MODE: Fixed OTP for ALL users for testing
      const UAT_MODE = true; // Set to false in production
      const finalOTP = UAT_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
      
      // ✅ SQL: Create OTP token using repository
      await getOtpRepository().create({
        phone,
        otp_code: finalOTP,
        otp_type: 'login',
        expires_in_minutes: 5,
        max_attempts: 3,
      });
      
      console.log(`✅ [OTP-GENERATE] OTP generated successfully for ${phone}: ${finalOTP} ${UAT_MODE ? '(UAT MODE - Fixed OTP)' : ''}`);
      
      // TODO: Send SMS via provider (Twilio, MSG91, etc.)
      
      return sendSuccess(c, {
        // In UAT mode, return OTP in response for testing
        ...(UAT_MODE ? { otp: finalOTP, uatMode: true } : {})
      }, 'OTP sent successfully');
    } catch (error) {
      console.error('❌ [OTP-GENERATE] Error:', error);
      return sendError(c, `OTP generation failed: ${String(error)}`, 500);
    }
  });

  // Verify OTP & Login
  app.post("/make-server-3dd53475/otp/verify", async (c) => {
    try {
      console.log('🔐 [OTP-VERIFY] Request received');
      const body = await c.req.json();
      console.log('🔐 [OTP-VERIFY] Request body:', body);
      
      let { phone, otp } = body;
      
      if (!phone || !otp) {
        console.error('❌ [OTP-VERIFY] Missing phone or OTP');
        return sendError(c, 'Phone and OTP are required', 400);
      }
      
      // ✅ CRITICAL FIX: Normalize phone number
      phone = normalizePhone(phone);
      console.log(`🔐 [OTP-VERIFY] Normalized phone: ${phone}`);
      
      console.log(`🔍 [OTP-VERIFY] Looking up OTP for: ${phone}`);
      
      // ✅ SQL: Verify OTP using repository
      const isValid = await getOtpRepository().verify(phone, otp, true);
      
      if (!isValid) {
        console.error('❌ [OTP-VERIFY] Invalid or expired OTP');
        return sendError(c, 'Invalid or expired OTP', 400);
      }
      
      console.log(`✅ [OTP-VERIFY] OTP verified successfully`);
      
      // ✅ SQL: Check if customer exists
      let customer = await getCustomersRepository().findByPhone(phone);
      let isNewUser = false;
      
      if (!customer) {
        // ✅ SQL: Create new customer
        isNewUser = true;
        customer = await getCustomersRepository().create({
          phone,
          full_name: 'Customer',
          is_active: true,
        });
        
        // ✅ SQL: Update last login
        await getCustomersRepository().updateLastLogin(customer.id);
      } else {
        // ✅ SQL: Update last login
        await getCustomersRepository().updateLastLogin(customer.id);
      }
      
      // ✅ SQL: Create session
      const sessionToken = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await getSessionsRepository().create({
        user_id: customer.id,
        user_type: 'customer',
        token: sessionToken,
        expires_in_days: 30,
      });
      
      console.log(`✅ [OTP-VERIFY] Login successful for ${phone}, isNewUser: ${isNewUser}`);
      
      return sendSuccess(c, {
        isNewUser,
        customer,
        sessionToken
      });
    } catch (error) {
      console.error('❌ [OTP-VERIFY] Error:', error);
      return sendError(c, `OTP verification failed: ${String(error)}`, 500);
    }
  });

  // ============================================
  // CUSTOMER PROFILE MANAGEMENT
  // ============================================

  // Helper to resolve customer ID from phone or ID
  async function resolveCustomerId(identifier: string): Promise<string | null> {
    // Allow 10-15 digits, optionally starting with +
    if (/^\+?\d{10,15}$/.test(identifier)) {
      const customer = await getCustomersRepository().findByPhone(identifier);
      if (customer) return customer.id;
    }
    // Check if it's already a customer ID
    const customer = await getCustomersRepository().findById(identifier);
    if (customer) return customer.id;
    return null;
  }

  // Get customer by phone number
  app.get("/make-server-3dd53475/customer-by-phone/:phone", async (c) => {
    try {
      const { phone } = c.req.param();
      
      // ✅ SQL: Get customer by phone
      const customer = await getCustomersRepository().findByPhone(phone);
      
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // ✅ SQL: Get customer's pets
      const pets = await getPetsRepository().findByCustomer(customer.id);
      
      return sendSuccess(c, { 
        customerId: customer.id, 
        customer: {
          ...customer,
          petIds: pets.map(p => p.id)
        }
      });
    } catch (error) {
      console.log('Get customer by phone error:', error);
      return sendError(c, error, 500);
    }
  });

  // Get customer profile
  app.get("/make-server-3dd53475/customer/:customerId", async (c) => {
    try {
      const rawId = c.req.param('customerId');
      const customerId = await resolveCustomerId(rawId);
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Get customer
      const customer = await getCustomersRepository().findById(customerId);
      
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // ✅ SQL: Get customer's pets
      const pets = await getPetsRepository().findByCustomer(customerId);
      
      return sendSuccess(c, { 
        customer: {
          ...customer,
          petIds: pets.map(p => p.id)
        }
      });
    } catch (error) {
      console.log('Get customer error:', error);
      return sendError(c, error, 500);
    }
  });

  // Get customer profile (Path param style) - for frontend compatibility
  app.get("/make-server-3dd53475/customer/profile/:identifier", async (c) => {
    try {
      const { identifier } = c.req.param();
      
      // Resolve identifier (phone or customer ID)
      const customerId = await resolveCustomerId(identifier);
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Get customer
      const customer = await getCustomersRepository().findById(customerId);
      if (!customer) return sendError(c, 'Customer not found', 404);
      
      // Map backend fields to UI fields
      const nameParts = (customer.full_name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      // Extract photo from preferences JSONB (profile_photo_url doesn't exist as a column)
      const preferences = (customer.preferences as any) || {};
      const photoUrl = preferences.profile_photo_url || null;
      
      // Extract address fields from JSONB
      const addressData = (customer.address as any) || {};
      
      const profile = {
        firstName,
        lastName,
        email: customer.email || '',
        phone: customer.phone || identifier,
        address: addressData.street || '',
        pincode: addressData.pincode || '',
        photo: photoUrl || ''
      };
      
      return sendSuccess(c, { profile });
    } catch (error) {
      console.error('Get profile path param error:', error);
      return sendError(c, `Failed to get profile: ${String(error)}`, 500);
    }
  });

  // Update customer profile
  app.put("/make-server-3dd53475/customer/:customerId", async (c) => {
    try {
      const rawId = c.req.param('customerId');
      const customerId = await resolveCustomerId(rawId);
      const updates = await c.req.json();
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Update customer
      const updatedCustomer = await getCustomersRepository().update(customerId, {
        email: updates.email,
        full_name: updates.name || updates.full_name,
        date_of_birth: updates.date_of_birth,
        gender: updates.gender,
        address: updates.address,
        city: updates.city,
        state: updates.state,
        pincode: updates.pincode,
        profile_photo_url: updates.photo || updates.profile_photo_url,
      });
      
      return sendSuccess(c, { customer: updatedCustomer });
    } catch (error) {
      console.log('Update customer error:', error);
      return sendError(c, error, 500);
    }
  });

  // Complete onboarding
  app.post("/make-server-3dd53475/customer/:customerId/onboarding", async (c) => {
    try {
      const rawId = c.req.param('customerId');
      const customerId = await resolveCustomerId(rawId);
      const { name, address, coordinates } = await c.req.json();
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Update customer with onboarding data
      const customer = await getCustomersRepository().update(customerId, {
        full_name: name,
        address: address,
        // TODO: Store coordinates in address table
      });
      
      return sendSuccess(c, { customer });
    } catch (error) {
      console.log('Onboarding error:', error);
      return sendError(c, error, 500);
    }
  });

  // Get customer profile (Query param style)
  app.get("/make-server-3dd53475/customer/profile", async (c) => {
    try {
      const { phone } = c.req.query();
      if (!phone) return sendError(c, 'Phone number required', 400);
      
      const customerId = await resolveCustomerId(phone);
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Get customer
      const customer = await getCustomersRepository().findById(customerId);
      if (!customer) return sendError(c, 'Customer not found', 404);
      
      // Map backend fields to UI fields
      const nameParts = (customer.full_name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const profile = {
        firstName,
        lastName,
        email: customer.email || '',
        phone: customer.phone || phone,
        address: customer.address || '',
        pincode: customer.pincode || '',
        photo: customer.profile_photo_url || ''
      };
      
      return sendSuccess(c, { profile });
    } catch (error) {
      console.log('Get profile query error:', error);
      return sendError(c, error, 500);
    }
  });

  // Update customer profile details
  app.post("/make-server-3dd53475/customer/profile", async (c) => {
    try {
      const body = await c.req.json();
      
      // Support both flat structure and nested "profile" object
      let { firstName, lastName, email, phone, address, pincode, photo } = body;
      
      if (body.profile) {
        firstName = body.profile.firstName;
        lastName = body.profile.lastName;
        email = body.profile.email;
        address = body.profile.address;
        pincode = body.profile.pincode;
        photo = body.profile.photo;
        phone = body.phone || body.profile.phone;
      }
      
      if (!phone) {
        return sendError(c, 'Phone number is required', 400);
      }
      
      const customerId = await resolveCustomerId(phone);
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Update customer
      const customer = await getCustomersRepository().update(customerId, {
        full_name: `${firstName} ${lastName}`.trim(),
        email,
        address,
        pincode,
        profile_photo_url: photo,
      });
      
      return sendSuccess(c, { 
        profile: {
          firstName, 
          lastName, 
          email, 
          phone, 
          address, 
          pincode, 
          photo: customer.profile_photo_url
        }
      });
    } catch (error) {
      console.log('Update profile error:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // PET MANAGEMENT
  // ============================================

  // Get pets by phone or customer ID
  app.get("/make-server-3dd53475/customer/pets/:identifier", async (c) => {
    try {
      const { identifier } = c.req.param();
      let customerId = identifier;

      // Check if identifier is a phone number
      if (/^\d{10}$/.test(identifier)) {
        const customer = await getCustomersRepository().findByPhone(identifier);
        if (customer) {
          customerId = customer.id;
        } else {
          return sendSuccess(c, { pets: [] }); 
        }
      }

      // ✅ SQL: Get pets for customer
      const pets = await getPetsRepository().findByCustomer(customerId);
      
      return sendSuccess(c, { pets });
    } catch (error) {
      console.log('Get pets by identifier error:', error);
      return sendError(c, error, 500);
    }
  });

  // Get all pets for a customer
  app.get("/make-server-3dd53475/customer/:customerId/pets", async (c) => {
    try {
      const rawId = c.req.param('customerId');
      const customerId = await resolveCustomerId(rawId);
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Get pets for customer
      const pets = await getPetsRepository().findByCustomer(customerId);
      
      return sendSuccess(c, { pets });
    } catch (error) {
      console.log('Get pets error:', error);
      return sendError(c, error, 500);
    }
  });

  // Add a pet
  app.post("/make-server-3dd53475/customer/:customerId/pets", async (c) => {
    try {
      const rawId = c.req.param('customerId');
      const customerId = await resolveCustomerId(rawId);
      const petData = await c.req.json();
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Create pet using repository
      const pet = await getPetsRepository().create({
        customer_id: customerId,
        name: petData.name,
        type: petData.type,
        breed: petData.breed,
        age: petData.age,
        gender: petData.gender,
        weight: petData.weight,
        color: petData.color,
        photo_url: petData.photo || petData.photo_url,
        medical_conditions: petData.medicalConditions || petData.medical_conditions,
        allergies: petData.allergies,
        vaccinations: petData.vaccinations,
      });
      
      return sendSuccess(c, { pet });
    } catch (error) {
      console.log('Add pet error:', error);
      return sendError(c, error, 500);
    }
  });

  // Bulk Update / Add Pets
  app.post("/make-server-3dd53475/customer/pets", async (c) => {
    try {
      const { phone, pets } = await c.req.json();
      
      if (!phone) {
        return sendError(c, 'Phone number is required', 400);
      }

      const customerId = await resolveCustomerId(phone);
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }

      const savedPets = [];

      // Process each pet in the list
      for (const p of pets) {
        if (p.id) {
          // ✅ SQL: Update existing pet
          const updated = await getPetsRepository().update(p.id, {
            name: p.name,
            type: p.type,
            breed: p.breed,
            age: p.age,
            gender: p.gender,
            weight: p.weight,
            color: p.color,
            photo_url: p.photo || p.photo_url,
            medical_conditions: p.medicalConditions || p.medical_conditions,
            allergies: p.allergies,
            vaccinations: p.vaccinations,
          });
          savedPets.push(updated);
        } else {
          // ✅ SQL: Create new pet
          const newPet = await getPetsRepository().create({
            customer_id: customerId,
            name: p.name,
            type: p.type,
            breed: p.breed,
            age: p.age,
            gender: p.gender,
            weight: p.weight,
            color: p.color,
            photo_url: p.photo || p.photo_url,
            medical_conditions: p.medicalConditions || p.medical_conditions,
            allergies: p.allergies,
            vaccinations: p.vaccinations,
          });
          savedPets.push(newPet);
        }
      }

      return sendSuccess(c, { pets: savedPets });
    } catch (error) {
      console.log('Bulk save pets error:', error);
      return sendError(c, error, 500);
    }
  });

  // Update a pet
  app.put("/make-server-3dd53475/pet/:petId", async (c) => {
    try {
      const { petId } = c.req.param();
      const updates = await c.req.json();
      
      // ✅ SQL: Update pet using repository
      const updatedPet = await getPetsRepository().update(petId, {
        name: updates.name,
        type: updates.type,
        breed: updates.breed,
        age: updates.age,
        gender: updates.gender,
        weight: updates.weight,
        color: updates.color,
        photo_url: updates.photo || updates.photo_url,
        medical_conditions: updates.medicalConditions || updates.medical_conditions,
        allergies: updates.allergies,
        vaccinations: updates.vaccinations,
      });
      
      return sendSuccess(c, { pet: updatedPet });
    } catch (error) {
      console.log('Update pet error:', error);
      return sendError(c, error, 500);
    }
  });

  // Delete a pet
  app.delete("/make-server-3dd53475/pet/:petId", async (c) => {
    try {
      const { petId } = c.req.param();
      
      // ✅ SQL: Delete pet (soft delete)
      await getPetsRepository().delete(petId);
      
      return sendSuccess(c, {});
    } catch (error) {
      console.log('Delete pet error:', error);
      return sendError(c, error, 500);
    }
  });

  // Get a single pet
  app.get("/make-server-3dd53475/pet/:petId", async (c) => {
    try {
      const { petId } = c.req.param();
      
      // ✅ SQL: Get pet using repository
      const pet = await getPetsRepository().findById(petId);
      
      if (!pet) {
        return sendError(c, 'Pet not found', 404);
      }
      
      return sendSuccess(c, { pet });
    } catch (error) {
      console.log('Get pet error:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // SERVICE DISCOVERY
  // ============================================

  // Get all services
  app.get("/make-server-3dd53475/services", async (c) => {
    try {
      // ✅ SQL: Get all active services
      const services = await getServicesRepository().findByCategory('', { limit: 100 });
      
      return sendSuccess(c, { services });
    } catch (error) {
      console.log('Get services error:', error);
      return sendError(c, error, 500);
    }
  });

  // Get service details
  app.get("/make-server-3dd53475/service/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      
      // ✅ SQL: Get service using repository
      const service = await getServicesRepository().findById(serviceId);
      
      if (!service) {
        return sendError(c, 'Service not found', 404);
      }
      
      return sendSuccess(c, { service });
    } catch (error) {
      console.log('Get service error:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // VENDOR DISCOVERY & FILTERING
  // ============================================

  // Get vendors by service
  app.get("/make-server-3dd53475/vendors/service/:serviceId", async (c) => {
    try {
      const { serviceId } = c.req.param();
      const { lat, lng, radius = 10, serviceType } = c.req.query();
      
      // ✅ SQL: Get vendors offering this service
      // TODO: Add vendor_service_offerings table for many-to-many relationship
      const client = getDbClient();
      const { data: vendorServices } = await client
        .from('vendor_services')
        .select('vendor_id')
        .eq('service_id', serviceId);
      
      const vendorIds = vendorServices?.map((vs: any) => vs.vendor_id) || [];
      
      if (vendorIds.length === 0) {
        return sendSuccess(c, { vendors: [] });
      }
      
      // ✅ SQL: Get vendors
      const vendors = [];
      for (const vendorId of vendorIds) {
        const vendor = await getVendorsRepository().findById(vendorId);
        if (vendor && vendor.status === 'approved' && vendor.is_active) {
          vendors.push(vendor);
        }
      }
      
      // Filter by location if coordinates provided
      if (lat && lng) {
        const userLat = parseFloat(lat as string);
        const userLng = parseFloat(lng as string);
        const radiusKm = parseFloat(radius as string);
        
        const filteredVendors = vendors
          .filter((v: any) => {
            if (!v.latitude || !v.longitude) return false;
            const distance = calculateDistance(
              userLat, userLng,
              v.latitude, v.longitude
            );
            return distance <= radiusKm;
          })
          .map((v: any) => ({
            ...v,
            distance: calculateDistance(
              userLat, userLng,
              v.latitude, v.longitude
            )
          }));
        
        // Sort by distance
        filteredVendors.sort((a: any, b: any) => a.distance - b.distance);
        
        return sendSuccess(c, { vendors: filteredVendors });
      }
      
      return sendSuccess(c, { vendors });
    } catch (error) {
      console.log('Get vendors error:', error);
      return sendError(c, error, 500);
    }
  });

  // Get vendor details
  app.get("/make-server-3dd53475/vendor/:vendorId", async (c) => {
    try {
      const { vendorId } = c.req.param();
      
      // ✅ SQL: Get vendor
      const vendor = await getVendorsRepository().findById(vendorId);
      
      if (!vendor) {
        return sendError(c, 'Vendor not found', 404);
      }
      
      // ✅ SQL: Get vendor reviews
      const reviews = await getReviewsRepository().findByVendor(vendorId, { limit: 10 });
      
      return sendSuccess(c, { 
        vendor,
        reviews
      });
    } catch (error) {
      console.log('Get vendor error:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // BOOKING MANAGEMENT
  // ============================================

  // Get bookings by phone or customer ID
  app.get("/make-server-3dd53475/bookings/:identifier", async (c) => {
    try {
      const { identifier } = c.req.param();
      const customerId = await resolveCustomerId(identifier);
      
      if (!customerId) {
        return sendSuccess(c, { bookings: [] });
      }
      
      console.log(`🔍 [GET-BOOKINGS] Resolving bookings for: ${identifier} -> ${customerId}`);

      // ✅ SQL: Get bookings for customer
      const bookings = await getBookingsRepository().findByCustomer(customerId);
      
      // Sort by date desc
      bookings.sort((a, b) => 
        new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime()
      );
      
      return sendSuccess(c, { bookings });
    } catch (error) {
      console.log('Get bookings by identifier error:', error);
      return sendError(c, error, 500);
    }
  });

  // Get customer bookings
  app.get("/make-server-3dd53475/customer/:customerId/bookings", async (c) => {
    try {
      const rawId = c.req.param('customerId');
      const customerId = await resolveCustomerId(rawId);
      const { status, limit = 20 } = c.req.query();
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Get bookings for customer
      const bookings = await getBookingsRepository().findByCustomer(customerId, {
        status: status as string || undefined,
        limit: parseInt(limit as string),
      });
      
      return sendSuccess(c, { bookings });
    } catch (error) {
      console.log('Get customer bookings error:', error);
      return sendError(c, error, 500);
    }
  });

  // Create booking
  app.post("/make-server-3dd53475/booking/create", async (c) => {
    try {
      const bookingData = await c.req.json();
      
      // ✅ Resolve customer ID from potential phone number
      const customerId = await resolveCustomerId(bookingData.customerId);
      
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Create booking using repository
      const booking = await getBookingsRepository().create({
        customer_id: customerId,
        vendor_id: bookingData.vendorId,
        staff_id: bookingData.staffId,
        service_id: bookingData.serviceId,
        booking_date: bookingData.bookingDate,
        booking_time: bookingData.startTime || bookingData.bookingTime,
        service_type: bookingData.serviceType || bookingData.serviceName,
        address: bookingData.address || bookingData.serviceLocation,
        city: bookingData.city,
        state: bookingData.state,
        pincode: bookingData.pincode,
        latitude: bookingData.coordinates?.lat,
        longitude: bookingData.coordinates?.lng,
        base_price: bookingData.basePrice || 0,
        discount_amount: bookingData.discount || 0,
        tax_amount: bookingData.taxes || 0,
        total_amount: bookingData.totalAmount || bookingData.basePrice || 0,
        notes: bookingData.specialInstructions || bookingData.notes,
      });
      
      // ✅ SQL: Create notification for vendor
      await getNotificationsRepository().create({
        recipient_type: 'vendor',
        recipient_id: bookingData.vendorId,
        notification_type: 'booking_created',
        title: 'New Booking Request',
        message: `You have a new booking request for ${bookingData.serviceName}`,
        channels: { email: true, sms: false, inApp: true, push: false },
        data: { bookingId: booking.id },
      });

      // ✅ CRITICAL FIX: AMBULANCE SOS BROADCAST
      if (bookingData.status === 'emergency' || bookingData.serviceType === 'ambulance') {
        console.log(`🚨 EMERGENCY SOS TRIGGERED: Booking ${booking.id}`);
        await getNotificationsRepository().create({
          recipient_type: 'vendor',
          recipient_id: bookingData.vendorId,
          notification_type: 'emergency_alert',
          title: '🚨 AMBULANCE SOS REQUEST',
          message: `URGENT: Emergency request at ${bookingData.address || 'Customer Location'}`,
          channels: { email: true, sms: true, inApp: true, push: true },
          data: { bookingId: booking.id, isEmergency: true },
        });
      }
      
      return sendSuccess(c, { booking });
    } catch (error) {
      console.log('Create booking error:', error);
      return sendError(c, error, 500);
    }
  });

  // Update booking status
  app.put("/make-server-3dd53475/booking/:bookingId/status", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { status, trackingData, sessionSummary } = await c.req.json();
      
      // ✅ SQL: Get booking
      const booking = await getBookingsRepository().findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      // ✅ SQL: Update booking status
      let updatedBooking;
      if (status === 'confirmed') {
        updatedBooking = await getBookingsRepository().confirm(bookingId);
      } else if (status === 'completed') {
        updatedBooking = await getBookingsRepository().complete(bookingId);
      } else if (status === 'cancelled') {
        updatedBooking = await getBookingsRepository().cancel(bookingId, 'Status updated');
      } else {
        updatedBooking = await getBookingsRepository().update(bookingId, {
          status,
          notes: sessionSummary || booking.notes,
        });
      }
      
      // ✅ SQL: Create notification
      const notificationMessages: Record<string, string> = {
        confirmed: 'Your booking has been confirmed',
        in_progress: 'Your service has started',
        completed: 'Your service has been completed. Please rate your experience'
      };
      
      if (notificationMessages[status]) {
        await getNotificationsRepository().create({
          recipient_type: 'customer',
          recipient_id: booking.customer_id,
          notification_type: status === 'confirmed' ? 'booking_confirmed' : 
                            status === 'in_progress' ? 'service_started' : 'service_completed',
          title: 'Booking Update',
          message: notificationMessages[status],
          channels: { email: true, sms: true, inApp: true, push: false },
          data: { bookingId },
        });
      }
      
      return sendSuccess(c, { booking: updatedBooking });
    } catch (error) {
      console.log('Update booking status error:', error);
      return sendError(c, error, 500);
    }
  });

  // Cancel booking
  app.post("/make-server-3dd53475/booking/:bookingId/cancel", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { reason, cancelledBy } = await c.req.json();
      
      // ✅ SQL: Get booking
      const booking = await getBookingsRepository().findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      // ✅ SQL: Cancel booking
      const cancelledBooking = await getBookingsRepository().cancel(bookingId, reason || 'Cancelled by user');
      
      // ✅ SQL: Create notification
      const targetUserId = cancelledBy === 'customer' ? booking.vendor_id : booking.customer_id;
      const targetType = cancelledBy === 'customer' ? 'vendor' : 'customer';
      
      if (targetUserId) {
        await getNotificationsRepository().create({
          recipient_type: targetType,
          recipient_id: targetUserId,
          notification_type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: `Booking has been cancelled`,
          channels: { email: true, sms: false, inApp: true, push: false },
          data: { bookingId, reason },
        });
      }
      
      return sendSuccess(c, { booking: cancelledBooking });
    } catch (error) {
      console.log('Cancel booking error:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // RATING & REVIEW
  // ============================================

  // Submit review
  app.post("/make-server-3dd53475/booking/:bookingId/review", async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { rating, review, aspects, photos } = await c.req.json();
      
      // ✅ SQL: Get booking
      const booking = await getBookingsRepository().findById(bookingId);
      
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }
      
      if (booking.status !== 'completed') {
        return sendError(c, 'Can only review completed bookings', 400);
      }
      
      // ✅ SQL: Create review using repository
      const reviewObj = await getReviewsRepository().create({
        booking_id: bookingId,
        customer_id: booking.customer_id,
        vendor_id: booking.vendor_id || undefined,
        service_id: booking.service_id,
        rating,
        comment: review,
      });
      
      // ✅ SQL: Create notification for vendor
      if (booking.vendor_id) {
        await getNotificationsRepository().create({
          recipient_type: 'vendor',
          recipient_id: booking.vendor_id,
          notification_type: 'rating_received',
          title: 'New Review Received',
          message: `You received a ${rating}-star review`,
          channels: { email: true, sms: false, inApp: true, push: false },
          data: { bookingId, reviewId: reviewObj.id },
        });
      }
      
      return sendSuccess(c, { review: reviewObj });
    } catch (error) {
      console.log('Submit review error:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // NOTIFICATIONS
  // ============================================

  const handleGetNotifications = async (c: any) => {
    try {
      const { userId } = c.req.param();
      const { limit = 20, unreadOnly } = c.req.query();
      
      console.log(`📬 [NOTIFICATIONS] Fetching for userId: ${userId}, limit: ${limit}, unreadOnly: ${unreadOnly}`);
      
      // ✅ SQL: Resolve userId (phone or UUID) to customer ID
      let customerId = userId;
      if (/^\d{10,15}$/.test(userId)) {
        // It's a phone number, resolve to customer ID
        const customer = await getCustomersRepository().findByPhone(userId);
        if (customer) {
          customerId = customer.id;
          console.log(`📬 [NOTIFICATIONS] Resolved phone ${userId} to customer ID: ${customerId}`);
        } else {
          console.warn(`📬 [NOTIFICATIONS] Customer not found for phone: ${userId}`);
          return sendSuccess(c, { notifications: [], unreadCount: 0 });
        }
      }
      
      // ✅ SQL: Get notifications for customer
      const notifications = await getNotificationsRepository().findByRecipient(
        'customer',
        customerId,
        {
          limit: parseInt(limit as string),
          unreadOnly: unreadOnly === 'true',
        }
      );
      
      console.log(`✅ [NOTIFICATIONS] Found ${notifications.length} notifications`);
      
      return sendSuccess(c, { 
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.notification_type,
          title: n.title,
          message: n.message,
          isRead: n.is_read,
          createdAt: n.created_at
        })),
        unreadCount: notifications.filter(n => !n.is_read).length
      });
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Error:', error);
      return sendError(c, `Failed to get notifications: ${String(error)}`, 500);
    }
  };

  app.get("/make-server-3dd53475/notifications/:userId", handleGetNotifications);
  app.get("/make-server-3dd53475/customer/notifications/:userId", handleGetNotifications);
  app.get("/make-server-3dd53475/vendor/notifications/:userId", handleGetNotifications);

  const handleReadNotification = async (c: any) => {
    try {
      const { notificationId } = c.req.param();
      
      // ✅ SQL: Mark notification as read
      await getNotificationsRepository().markAsRead(notificationId);
      
      return sendSuccess(c, {});
    } catch (error) {
      console.log('Mark notification read error:', error);
      return sendError(c, error, 500);
    }
  };

  app.put("/make-server-3dd53475/notification/:notificationId/read", handleReadNotification);
  app.put("/make-server-3dd53475/customer/notification/:notificationId/read", handleReadNotification);
  app.put("/make-server-3dd53475/vendor/notification/:notificationId/read", handleReadNotification);

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  // ============================================
  // SEARCH HISTORY & SUGGESTIONS
  // ============================================

  // Get search history for customer
  app.get("/make-server-3dd53475/customer/:customerId/search-history", async (c) => {
    try {
      const { customerId: rawId } = c.req.param();
      const { limit = 20 } = c.req.query();
      
      // Resolve customer ID from phone or UUID
      const customerId = await resolveCustomerId(rawId);
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Get search history
      const history = await getSearchHistoryRepository().findByCustomer(customerId, {
        limit: parseInt(limit as string),
      });
      
      return sendSuccess(c, { 
        history: history.map(h => ({
          id: h.id,
          query: h.search_query,
          resultsCount: h.results_count,
          clickedResultId: h.clicked_result_id,
          createdAt: h.created_at
        }))
      });
    } catch (error) {
      console.error('Get search history error:', error);
      return sendError(c, `Failed to get search history: ${String(error)}`, 500);
    }
  });

  // Save search history
  app.post("/make-server-3dd53475/customer/search-history", async (c) => {
    try {
      const body = await c.req.json();
      const { customerId: rawId, query, resultsCount, clickedResultId } = body;
      
      if (!rawId || !query) {
        return sendError(c, 'Customer ID and query are required', 400);
      }
      
      // Resolve customer ID from phone or UUID
      const customerId = await resolveCustomerId(rawId);
      if (!customerId) {
        return sendError(c, 'Customer not found', 404);
      }
      
      // ✅ SQL: Save search history
      const history = await getSearchHistoryRepository().create({
        customer_id: customerId,
        search_query: query,
        results_count: resultsCount || 0,
        clicked_result_id: clickedResultId || null,
      });
      
      return sendSuccess(c, { history });
    } catch (error) {
      console.error('Save search history error:', error);
      return sendError(c, `Failed to save search history: ${String(error)}`, 500);
    }
  });

  // Get search suggestions (SQL version)
  app.get("/make-server-3dd53475/customer/search-suggestions", async (c) => {
    try {
      const customerId = c.req.query('customerId');
      const roleId = c.req.query('roleId');
      const query = c.req.query('query') || '';
      const limit = parseInt(c.req.query('limit') || '10');

      console.log(`🔍 [SEARCH-SUGGESTIONS] Customer: ${customerId}, Role: ${roleId}, Query: "${query}"`);

      const suggestions: any[] = [];

      // 1. Get recent searches from SQL (if customer provided)
      if (customerId) {
        try {
          const resolvedCustomerId = await resolveCustomerId(customerId);
          if (resolvedCustomerId) {
            const recentSearches = await getSearchHistoryRepository().findByCustomer(resolvedCustomerId, { limit: 3 });
            
            for (const search of recentSearches) {
              suggestions.push({
                type: 'recent',
                id: search.id,
                title: search.search_query,
                subtitle: 'Recent search',
                relevanceScore: 100
              });
            }
          }
        } catch (error) {
          console.warn('⚠️ Could not load recent searches:', error);
        }
      }

      // 2. Get problems from catalog
      try {
        const { getAllProblemGrids, getProblemGridByRole } = await import('../server/problem-grid-catalog.tsx');
        
        let problemsToSearch: any[] = [];
        
        if (roleId) {
          problemsToSearch = getProblemGridByRole(roleId);
        } else {
          const allGrids = getAllProblemGrids();
          problemsToSearch = Object.values(allGrids).flat();
        }

        // 3. Filter problems by query (if provided)
        const filteredProblems = query
          ? problemsToSearch.filter(p => 
              p.displayName?.toLowerCase().includes(query.toLowerCase()) ||
              p.description?.toLowerCase().includes(query.toLowerCase())
            )
          : problemsToSearch;

        // 4. Add problems to suggestions
        for (const problem of filteredProblems.slice(0, limit - suggestions.length)) {
          suggestions.push({
            type: 'problem',
            id: problem.id,
            title: problem.displayName,
            subtitle: problem.description,
            icon: problem.icon,
            category: problem.category,
            relevanceScore: problem.order || 0
          });
        }
      } catch (error) {
        console.warn('⚠️ Could not load problem grid:', error);
      }

      // 5. Sort by relevance score
      suggestions.sort((a, b) => b.relevanceScore - a.relevanceScore);

      // 6. Limit results
      const limitedSuggestions = suggestions.slice(0, limit);

      console.log(`✅ Generated ${limitedSuggestions.length} search suggestions`);

      return sendSuccess(c, {
        suggestions: limitedSuggestions,
        total: limitedSuggestions.length,
        query: query || null
      });

    } catch (error) {
      console.error('❌ Error generating search suggestions:', error);
      return sendError(c, `Failed to get search suggestions: ${String(error)}`, 500);
    }
  });

  // ============================================
  // NOTIFICATIONS (Fixed)
  // ============================================

  const handleGetNotifications = async (c: any) => {
    try {
      const { userId } = c.req.param();
      const { limit = 20, unreadOnly } = c.req.query();
      
      console.log(`📬 [NOTIFICATIONS] Fetching for userId: ${userId}, limit: ${limit}, unreadOnly: ${unreadOnly}`);
      
      // ✅ SQL: Resolve userId (phone or UUID) to customer ID
      let customerId = userId;
      if (/^\d{10,15}$/.test(userId)) {
        // It's a phone number, resolve to customer ID
        const customer = await getCustomersRepository().findByPhone(userId);
        if (customer) {
          customerId = customer.id;
          console.log(`📬 [NOTIFICATIONS] Resolved phone ${userId} to customer ID: ${customerId}`);
        } else {
          console.warn(`📬 [NOTIFICATIONS] Customer not found for phone: ${userId}`);
          return sendSuccess(c, { notifications: [], unreadCount: 0 });
        }
      }
      
      // ✅ SQL: Get notifications for customer
      const notifications = await getNotificationsRepository().findByRecipient(
        'customer',
        customerId,
        {
          limit: parseInt(limit as string),
          unreadOnly: unreadOnly === 'true',
        }
      );
      
      console.log(`✅ [NOTIFICATIONS] Found ${notifications.length} notifications`);
      
      return sendSuccess(c, { 
        notifications: notifications.map(n => ({
          id: n.id,
          type: n.notification_type,
          title: n.title,
          message: n.message,
          isRead: n.is_read,
          createdAt: n.created_at
        })),
        unreadCount: notifications.filter(n => !n.is_read).length
      });
    } catch (error) {
      console.error('❌ [NOTIFICATIONS] Error:', error);
      return sendError(c, `Failed to get notifications: ${String(error)}`, 500);
    }
  };

  app.get("/make-server-3dd53475/customer/notifications/:userId", handleGetNotifications);

  // Calculate distance between two coordinates (Haversine formula)
  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  console.log('✅ Customer routes registered (SQL-only)');
}

