import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { trySet, safeGet } from "./kv-safe.tsx";
import type { Customer, Pet, Booking, ChatMessage, Review, Notification } from "./database-schema.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";
import { normalizePhone, isValidIndianMobile } from "./phone-utils.tsx";

export function registerCustomerRoutes(app: Hono) {
  console.log('✅ Registering Customer Routes...');

// ============================================
// SEED TEST CUSTOMERS (DISABLED - Use API endpoint instead)
// ============================================

// ✅ DISABLED: Seeding on startup causes database timeouts during high load
// Seed customers manually via the /make-server-3dd53475/seed-customers endpoint if needed
console.log('ℹ️  Customer seeding disabled on startup to prevent timeout errors.');

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
    
    // ✅ CRITICAL FIX: Normalize phone number to ensure consistency
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
    
    // Store OTP with 5-minute expiry
    const otpData = {
      code: finalOTP,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      attempts: 0
    };
    
    console.log(`💾 [OTP-GENERATE] Storing OTP data for: ${phone}`);
    await kv.set(`otp:${phone}`, otpData);
    
    console.log(`✅ [OTP-GENERATE] OTP generated successfully for ${phone}: ${finalOTP} ${UAT_MODE ? '(UAT MODE - Fixed OTP)' : ''}`);
    
    // TODO: Send SMS via provider (Twilio, MSG91, etc.)
    
    return sendSuccess(c, {
      // In UAT mode, return OTP in response for testing
      ...(UAT_MODE ? { otp: finalOTP, uatMode: true } : {})
    }, 'OTP sent successfully');
  } catch (error) {
    console.error('❌ [OTP-GENERATE] Error:', error);
    console.error('❌ [OTP-GENERATE] Error stack:', error.stack);
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
    
    // ✅ CRITICAL FIX: Normalize phone number to match storage key
    phone = normalizePhone(phone);
    console.log(`🔐 [OTP-VERIFY] Normalized phone: ${phone}`);
    
    console.log(`🔍 [OTP-VERIFY] Looking up OTP for: ${phone}`);
    const otpData = await kv.get(`otp:${phone}`);
    
    if (!otpData) {
      console.error('❌ [OTP-VERIFY] OTP not found for phone:', phone);
      return sendError(c, 'OTP expired or not found', 400);
    }
    
    console.log(`✅ [OTP-VERIFY] OTP data found:`, otpData);
    
    // Check expiry
    if (new Date(otpData.expiresAt) < new Date()) {
      console.error('❌ [OTP-VERIFY] OTP expired');
      await kv.del(`otp:${phone}`);
      return sendError(c, 'OTP expired', 400);
    }
    
    // Check attempts
    if (otpData.attempts >= 3) {
      console.error('❌ [OTP-VERIFY] Too many attempts');
      await kv.del(`otp:${phone}`);
      return sendError(c, 'Too many attempts. Please request a new OTP', 400);
    }
    
    // Verify OTP
    console.log(`🔍 [OTP-VERIFY] Comparing OTP: ${otp} === ${otpData.code}`);
    if (otpData.code !== otp) {
      console.error('❌ [OTP-VERIFY] Invalid OTP');
      otpData.attempts += 1;
      await kv.set(`otp:${phone}`, otpData);
      return sendError(c, 'Invalid OTP', 400);
    }
    
    console.log(`✅ [OTP-VERIFY] OTP verified successfully`);
    
    // OTP verified - delete it
    await kv.del(`otp:${phone}`);
    
    // Check if customer exists
    const customerId = await kv.get(`customer:phone:${phone}`);
    
    let customer: Customer;
    let isNewUser = false;
    
    if (customerId) {
      // Existing customer
      customer = await kv.get(`customer:${customerId}`);
      
      // ✅ FIX: Handle case where customer ID exists but record doesn't
      if (!customer) {
        console.warn(`⚠️ [OTP-VERIFY] Customer ID found but record missing: ${customerId}`);
        // Treat as new user
        isNewUser = true;
        const newCustomerId = `customer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        
        customer = {
          id: newCustomerId,
          phone,
          onboardingComplete: false,
          onboardingStep: 'name',
          notificationsEnabled: true,
          totalBookings: 0,
          activeBookings: 0,
          completedBookings: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        
        await kv.set(`customer:${newCustomerId}`, customer);
        await kv.set(`customer:phone:${phone}`, newCustomerId);
      } else {
        // Update existing customer
        customer.lastLoginAt = new Date().toISOString();
        await kv.set(`customer:${customerId}`, customer);
        
        // Get pet IDs to check if user has pets
        const petIds = await kv.get(`customer:${customerId}:pets`) || [];
        customer.petIds = petIds;
      }
    } else {
      // New customer
      isNewUser = true;
      const newCustomerId = `customer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      customer = {
        id: newCustomerId,
        phone,
        onboardingComplete: false,
        onboardingStep: 'name',
        notificationsEnabled: true,
        totalBookings: 0,
        activeBookings: 0,
        completedBookings: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      
      await kv.set(`customer:${newCustomerId}`, customer);
      await kv.set(`customer:phone:${phone}`, newCustomerId);
    }
    
    // Generate session token
    const sessionToken = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await kv.set(`session:customer:${customer.id}`, {
      token: sessionToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    });
    
    console.log(`✅ [OTP-VERIFY] Login successful for ${phone}, isNewUser: ${isNewUser}`);
    
    return sendSuccess(c, {
      isNewUser,
      customer,
      sessionToken
    });
  } catch (error) {
    console.error('❌ [OTP-VERIFY] Error:', error);
    console.error('❌ [OTP-VERIFY] Error stack:', error.stack);
    return sendError(c, `OTP verification failed: ${String(error)}`, 500);
  }
});

// ============================================
// CUSTOMER PROFILE MANAGEMENT
// ============================================

// Get customer by phone number
app.get("/make-server-3dd53475/customer-by-phone/:phone", async (c) => {
  try {
    const { phone } = c.req.param();
    
    const customerId = await kv.get(`customer:phone:${phone}`);
    
    if (!customerId) {
      return sendError(c, 'Customer not found', 404);
    }
    
    const customer = await kv.get(`customer:${customerId}`);
    
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }

    // ✅ ENRICHMENT: Always attach petIds to the customer object
    const petIds = await kv.get(`customer:${customerId}:pets`) || [];
    customer.petIds = petIds;
    
    return sendSuccess(c, { customerId, customer });
  } catch (error) {
    console.log('Get customer by phone error:', error);
    return sendError(c, error, 500);
  }
});

// Helper to resolve customer ID from phone or ID
async function resolveCustomerId(identifier: string): Promise<string> {
  // Allow 10-15 digits, optionally starting with +
  if (/^\+?\d{10,15}$/.test(identifier)) {
    const resolvedId = await kv.get(`customer:phone:${identifier}`);
    if (resolvedId) return resolvedId;
  }
  return identifier;
}

// Get customer profile
app.get("/make-server-3dd53475/customer/:customerId", async (c) => {
  try {
    const rawId = c.req.param('customerId');
    const customerId = await resolveCustomerId(rawId);
    
    const customer = await kv.get(`customer:${customerId}`);
    
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }

    // ✅ ENRICHMENT: Always attach petIds to the customer object
    const petIds = await kv.get(`customer:${customerId}:pets`) || [];
    customer.petIds = petIds;
    
    return sendSuccess(c, { customer });
  } catch (error) {
    console.log('Get customer error:', error);
    return sendError(c, error, 500);
  }
});

// Update customer profile
app.put("/make-server-3dd53475/customer/:customerId", async (c) => {
  try {
    const rawId = c.req.param('customerId');
    const customerId = await resolveCustomerId(rawId);
    const updates = await c.req.json();
    
    const customer = await kv.get(`customer:${customerId}`);
    
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }
    
    // Update allowed fields
    const updatedCustomer = {
      ...customer,
      ...updates,
      id: customer.id, // Don't allow ID change
      phone: customer.phone, // Don't allow phone change
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`customer:${customerId}`, updatedCustomer);
    
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
    
    const customer = await kv.get(`customer:${customerId}`);
    
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }
    
    customer.name = name;
    customer.address = address;
    customer.coordinates = coordinates;
    customer.onboardingComplete = true;
    customer.onboardingStep = 'complete';
    customer.updatedAt = new Date().toISOString();
    
    await kv.set(`customer:${customerId}`, customer);
    
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
    const customer = await kv.get(`customer:${customerId}`);
    
    if (!customer) return sendError(c, 'Customer not found', 404);
    
    // Map backend fields to UI fields
    const nameParts = (customer.name || '').split(' ');
    const firstName = customer.firstName || nameParts[0] || '';
    const lastName = customer.lastName || nameParts.slice(1).join(' ') || '';
    
    const profile = {
      firstName,
      lastName,
      email: customer.email || '',
      phone: customer.phone || phone,
      address: customer.address || '',
      pincode: customer.pincode || '',
      photo: customer.photo || ''
    };
    
    return sendSuccess(c, { profile });
  } catch (error) {
    console.log('Get profile query error:', error);
    return sendError(c, error, 500);
  }
});

// Get customer profile details (UI Support Endpoint)
app.get("/make-server-3dd53475/customer/profile/:identifier", async (c) => {
  try {
    const { identifier } = c.req.param();
    const customerId = await resolveCustomerId(identifier);
    
    const customer = await kv.get(`customer:${customerId}`);
    
    if (!customer) {
      return sendError(c, 'Profile not found', 404);
    }
    
    // Map backend fields to UI fields
    const nameParts = (customer.name || '').split(' ');
    const firstName = customer.firstName || nameParts[0] || '';
    const lastName = customer.lastName || nameParts.slice(1).join(' ') || '';
    
    const profile = {
      firstName,
      lastName,
      email: customer.email || '',
      phone: customer.phone || identifier,
      address: customer.address || '',
      pincode: customer.pincode || '',
      photo: customer.photo || ''
    };
    
    return sendSuccess(c, { profile });
  } catch (error) {
    console.log('Get profile error:', error);
    return sendError(c, error, 500);
  }
});

// Update customer profile details
app.post("/make-server-3dd53475/customer/profile", async (c) => {
  try {
    const body = await c.req.json();
    
    // Support both flat structure and nested "profile" object (as sent by frontend)
    let { firstName, lastName, email, phone, address, pincode, photo } = body;
    
    if (body.profile) {
      firstName = body.profile.firstName;
      lastName = body.profile.lastName;
      email = body.profile.email;
      address = body.profile.address;
      pincode = body.profile.pincode;
      photo = body.profile.photo;
      
      // Phone is usually sent at root, but check profile too
      phone = body.phone || body.profile.phone;
    }
    
    if (!phone) {
      return sendError(c, 'Phone number is required', 400);
    }
    
    const customerId = await resolveCustomerId(phone);
    
    if (!customerId) {
      return sendError(c, 'Customer not found', 404);
    }
    
    const customer = await kv.get(`customer:${customerId}`);
    
    if (!customer) {
      return sendError(c, 'Customer record missing', 404);
    }
    
    // Update fields
    customer.name = `${firstName} ${lastName}`.trim();
    customer.firstName = firstName;
    customer.lastName = lastName;
    customer.email = email;
    customer.address = address;
    customer.pincode = pincode;
    if (photo) customer.photo = photo;
    customer.updatedAt = new Date().toISOString();
    
    await kv.set(`customer:${customerId}`, customer);
    
    return sendSuccess(c, { profile: {
      firstName, lastName, email, phone, address, pincode, photo: customer.photo
    }});
  } catch (error) {
    console.log('Update profile error:', error);
    return sendError(c, error, 500);
  }
});

// ============================================
// PET MANAGEMENT
// ============================================

// Get pets by phone or customer ID (Alternative endpoint)
app.get("/make-server-3dd53475/customer/pets/:identifier", async (c) => {
  try {
    const { identifier } = c.req.param();
    let customerId = identifier;

    // Check if identifier is a phone number (10 digits)
    if (/^\d{10}$/.test(identifier)) {
      const resolvedId = await kv.get(`customer:phone:${identifier}`);
      if (resolvedId) {
        customerId = resolvedId;
      } else {
        // If phone not found, return empty list
        return sendSuccess(c, { pets: [] }); 
      }
    }

    const petIds = await kv.get(`customer:${customerId}:pets`) || [];
    const pets = await Promise.all(
      petIds.map((id: string) => kv.get(`pet:${id}`))
    );
    
    return sendSuccess(c, { pets: pets.filter(Boolean) });
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
    
    const petIds = await kv.get(`customer:${customerId}:pets`) || [];
    const pets = await Promise.all(
      petIds.map((id: string) => kv.get(`pet:${id}`))
    );
    
    return sendSuccess(c, { pets: pets.filter(Boolean) });
  } catch (error) {
    console.log('Get pets error:', error);
    return sendError(c, error, 500);
  }
});

// Add a pet (Standard Endpoint)
app.post("/make-server-3dd53475/customer/:customerId/pets", async (c) => {
  try {
    const rawId = c.req.param('customerId');
    const customerId = await resolveCustomerId(rawId);
    const petData = await c.req.json();
    
    const petId = `pet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const pet: Pet = {
      id: petId,
      customerId, // Store the resolved real customer ID
      ...petData,
      photos: petData.photos || [],
      vaccinated: petData.vaccinated || false,
      medicalConditions: petData.medicalConditions || [],
      allergies: petData.allergies || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`pet:${petId}`, pet);
    
    // Add to customer's pets list
    const petIds = await kv.get(`customer:${customerId}:pets`) || [];
    petIds.push(petId);
    await kv.set(`customer:${customerId}:pets`, petIds);
    
    return sendSuccess(c, { pet });
  } catch (error) {
    console.log('Add pet error:', error);
    return sendError(c, error, 500);
  }
});

// Bulk Update / Add Pets (Legacy/Frontend Support Endpoint)
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
    const currentPetIds = [];

    // Process each pet in the list
    for (const p of pets) {
      // If pet has ID, keep it, otherwise generate new
      const petId = p.id || `pet_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const pet: Pet = {
        ...p,
        id: petId,
        customerId,
        updatedAt: new Date().toISOString(),
        createdAt: p.createdAt || new Date().toISOString()
      };

      await kv.set(`pet:${petId}`, pet);
      currentPetIds.push(petId);
      savedPets.push(pet);
    }

    // Update customer's pet list with the new full list
    await kv.set(`customer:${customerId}:pets`, currentPetIds);

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
    
    const pet = await kv.get(`pet:${petId}`);
    
    if (!pet) {
      return sendError(c, 'Pet not found', 404);
    }
    
    const updatedPet = {
      ...pet,
      ...updates,
      id: pet.id,
      customerId: pet.customerId,
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`pet:${petId}`, updatedPet);
    
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
    
    const pet = await kv.get(`pet:${petId}`);
    
    if (!pet) {
      return sendError(c, 'Pet not found', 404);
    }
    
    // Remove from customer's pets list
    const petIds = await kv.get(`customer:${pet.customerId}:pets`) || [];
    const updatedPetIds = petIds.filter((id: string) => id !== petId);
    await kv.set(`customer:${pet.customerId}:pets`, updatedPetIds);
    
    // Delete pet
    await kv.del(`pet:${petId}`);
    
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
    
    const pet = await kv.get(`pet:${petId}`);
    
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
    const serviceIds = await kv.get('services:all') || [
      'grooming', 'boarding', 'walking', 'training', 'cafes', 
      'adoption', 'sunset', 'events', 'insurance', 'mating'
    ];
    
    // If services don't exist, create them
    if (!await kv.get('service:grooming')) {
      await initializeServices();
    }
    
    const services = await Promise.all(
      serviceIds.map((id: string) => kv.get(`service:${id}`))
    );
    
    return sendSuccess(c, { services: services.filter(Boolean) });
  } catch (error) {
    console.log('Get services error:', error);
    return sendError(c, error, 500);
  }
});

// Get service details
app.get("/make-server-3dd53475/service/:serviceId", async (c) => {
  try {
    const { serviceId } = c.req.param();
    
    const service = await kv.get(`service:${serviceId}`);
    
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
    
    // Get all vendors offering this service
    const vendorIds = await kv.get(`vendor:service:${serviceId}`) || [];
    
    if (vendorIds.length === 0) {
      return sendSuccess(c, { vendors: [] });
    }
    
    const vendors = await Promise.all(
      vendorIds.map((id: string) => kv.get(`vendor:${id}`))
    );
    
    // Filter approved and active vendors
    let filteredVendors = vendors.filter((v: any) => 
      v && v.status === 'approved' && v.isAvailable
    );
    
    // Filter by service type (clinic/home)
    if (serviceType) {
      filteredVendors = filteredVendors.filter((v: any) => {
        if (serviceType === 'clinic') return v.serviceStyles.includes('clinic');
        if (serviceType === 'home') return v.serviceStyles.includes('home');
        return true;
      });
    }
    
    // Filter by location if coordinates provided
    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const radiusKm = parseFloat(radius as string);
      
      filteredVendors = filteredVendors.filter((v: any) => {
        if (!v.coordinates) return false;
        const distance = calculateDistance(
          userLat, userLng,
          v.coordinates.lat, v.coordinates.lng
        );
        return distance <= radiusKm;
      }).map((v: any) => ({
        ...v,
        distance: calculateDistance(
          userLat, userLng,
          v.coordinates.lat, v.coordinates.lng
        )
      }));
      
      // Sort by distance
      filteredVendors.sort((a: any, b: any) => a.distance - b.distance);
    }
    
    return sendSuccess(c, { vendors: filteredVendors });
  } catch (error) {
    console.log('Get vendors error:', error);
    return sendError(c, error, 500);
  }
});

// Get vendor details
app.get("/make-server-3dd53475/vendor/:vendorId", async (c) => {
  try {
    const { vendorId } = c.req.param();
    
    const vendor = await kv.get(`vendor:${vendorId}`);
    
    if (!vendor) {
      return sendError(c, 'Vendor not found', 404);
    }
    
    // Get vendor reviews
    const reviewIds = await kv.get(`review:vendor:${vendorId}`) || [];
    const reviews = await Promise.all(
      reviewIds.slice(0, 10).map((id: string) => kv.get(`review:${id}`))
    );
    
    return sendSuccess(c, { 
      vendor,
      reviews: reviews.filter(Boolean)
    });
  } catch (error) {
    console.log('Get vendor error:', error);
    return sendError(c, error, 500);
  }
});

// ============================================
// BOOKING MANAGEMENT
// ============================================

// Get bookings by phone or customer ID (Legacy/Frontend Support)
app.get("/make-server-3dd53475/bookings/:identifier", async (c) => {
  try {
    const { identifier } = c.req.param();
    // Resolve identifier to customer ID
    const customerId = await resolveCustomerId(identifier);
    
    console.log(`🔍 [GET-BOOKINGS] Resolving bookings for: ${identifier} -> ${customerId}`);

    const bookingIds = await kv.get(`booking:customer:${customerId}`) || [];
    
    let bookings = await Promise.all(
      bookingIds.map((id: string) => kv.get(`booking:${id}`))
    );
    
    bookings = bookings.filter(Boolean);
    
    // Sort by date desc
    bookings.sort((a: any, b: any) => 
      new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    );
    
    return sendSuccess(c, { bookings });
  } catch (error) {
    console.log('Get bookings by identifier error:', error);
    return sendError(c, error, 500);
  }
});

// Get booking history (Legacy Alias)
app.get("/make-server-3dd53475/customer/bookings/history/:identifier", async (c) => {
  try {
    const { identifier } = c.req.param();
    const customerId = await resolveCustomerId(identifier);
    
    const bookingIds = await kv.get(`booking:customer:${customerId}`) || [];
    
    let bookings = await Promise.all(
      bookingIds.map((id: string) => kv.get(`booking:${id}`))
    );
    
    bookings = bookings.filter(Boolean);
    
    return sendSuccess(c, { bookings });
  } catch (error) {
    console.log('Get booking history error:', error);
    return sendError(c, error, 500);
  }
});

// Get customer bookings (Query param style)
app.get("/make-server-3dd53475/customer/bookings", async (c) => {
  try {
    const phone = c.req.query('phone');
    const customerId = c.req.query('customerId');
    const { status, limit = 20 } = c.req.query();
    
    const identifier = customerId || phone;
    if (!identifier) {
      return sendError(c, 'Customer identifier (phone or customerId) required', 400);
    }

    const resolvedId = await resolveCustomerId(identifier);
    
    const bookingIds = await kv.get(`booking:customer:${resolvedId}`) || [];
    
    let bookings = await Promise.all(
      bookingIds.slice(0, parseInt(limit as string)).map((id: string) => kv.get(`booking:${id}`))
    );
    
    bookings = bookings.filter(Boolean);
    
    if (status) {
      bookings = bookings.filter((b: any) => b.status === status);
    }
    
    // Sort by date desc
    bookings.sort((a: any, b: any) => 
      new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime()
    );
    
    return sendSuccess(c, { bookings });
  } catch (error) {
    console.log('Get customer bookings query error:', error);
    return sendError(c, error, 500);
  }
});

// Get customer bookings
app.get("/make-server-3dd53475/customer/:customerId/bookings", async (c) => {
  try {
    const rawId = c.req.param('customerId');
    const customerId = await resolveCustomerId(rawId);
    const { status, limit = 20 } = c.req.query();
    
    const bookingIds = await kv.get(`booking:customer:${customerId}`) || [];
    
    let bookings = await Promise.all(
      bookingIds.slice(0, parseInt(limit as string)).map((id: string) => kv.get(`booking:${id}`))
    );
    
    bookings = bookings.filter(Boolean);
    
    // Filter by status if provided
    if (status) {
      bookings = bookings.filter((b: any) => b.status === status);
    }
    
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
    
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const booking: Booking = {
      id: bookingId,
      customerId, // Store the resolved real customer ID
      vendorId: bookingData.vendorId,
      staffId: bookingData.staffId || null,
      petId: bookingData.petId,
      serviceId: bookingData.serviceId,
      serviceName: bookingData.serviceName,
      serviceType: bookingData.serviceType,
      
      bookingDate: bookingData.bookingDate,
      startTime: bookingData.startTime,
      duration: bookingData.duration,
      frequency: bookingData.frequency || 'once',
      
      serviceLocation: bookingData.serviceLocation,
      address: bookingData.address,
      coordinates: bookingData.coordinates,
      
      basePrice: bookingData.basePrice || 0,
      taxes: bookingData.taxes || 0,
      discount: bookingData.discount || 0,
      totalAmount: bookingData.totalAmount || 0,
      currency: 'INR',
      
      status: 'pending',
      paymentStatus: 'pending',
      
      // ✅ CRITICAL FIX: Capture specialized fields
      specialInstructions: bookingData.specialInstructions || bookingData.notes,
      metadata: {
        petDetails: bookingData.petDetails,
        guestCount: bookingData.guestCount || bookingData.pax,
        symptoms: bookingData.symptoms,
        checkinDate: bookingData.checkinDate,
        checkoutDate: bookingData.checkoutDate
      },
      // ✅ CRITICAL FIX: Generate Meeting Link for Tele-consult
      meetingLink: (bookingData.serviceType === 'tele' || bookingData.serviceType === 'teleconsultation') 
        ? `https://meet.jit.si/warmpawz-${bookingId}` 
        : undefined,
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`booking:${bookingId}`, booking);
    
    // Add to customer's bookings
    const customerBookings = await kv.get(`booking:customer:${customerId}`) || [];
    customerBookings.unshift(bookingId);
    await kv.set(`booking:customer:${customerId}`, customerBookings);
    
    // Add to vendor's bookings
    const vendorBookings = await kv.get(`vendor:bookings:${booking.vendorId}`) || [];
    vendorBookings.unshift(bookingId);
    await kv.set(`vendor:bookings:${booking.vendorId}`, vendorBookings);
    
    // ✅ Add to staff's bookings (CRITICAL for availability/schedule management)
    if (booking.staffId) {
      const staffBookings = await kv.get(`staff:${booking.staffId}:bookings`) || [];
      staffBookings.unshift(bookingId);
      await kv.set(`staff:${booking.staffId}:bookings`, staffBookings);
      console.log(`✅ Added booking ${bookingId} to staff ${booking.staffId} schedule`);
    }
    
    // Add to pending bookings
    const pendingBookings = await kv.get('booking:pending') || [];
    pendingBookings.unshift(bookingId);
    await kv.set('booking:pending', pendingBookings);
    
    // Update customer stats
    const customer = await kv.get(`customer:${customerId}`);
    if (customer) {
      customer.totalBookings += 1;
      customer.activeBookings += 1;
      await kv.set(`customer:${customerId}`, customer);
    }
    
    // Create notification for vendor
    await createNotification({
      userId: booking.vendorId,
      userType: 'vendor',
      type: 'booking_confirmed',
      title: 'New Booking Request',
      message: `You have a new booking request for ${booking.serviceName}`,
      actionType: 'view_booking',
      actionData: { bookingId }
    });

    // ✅ CRITICAL FIX: AMBULANCE SOS BROADCAST
    if (booking.status === 'emergency' || booking.serviceType === 'ambulance') {
       console.log(`🚨 EMERGENCY SOS TRIGGERED: Booking ${bookingId}`);
       await createNotification({
          userId: booking.vendorId,
          userType: 'vendor',
          type: 'emergency_alert' as any,
          title: '🚨 AMBULANCE SOS REQUEST',
          message: `URGENT: Emergency request at ${booking.address || 'Customer Location'}`,
          actionType: 'view_booking',
          actionData: { bookingId, isEmergency: true }
       });
    }
    
    return sendSuccess(c, { booking });
  } catch (error) {
    console.log('Create booking error:', error);
    return sendError(c, error, 500);
  }
});

// Alias for booking creation (Satisfies test requirement)
app.post("/make-server-3dd53475/customer/bookings/create", async (c) => {
  try {
    const bookingData = await c.req.json();
    
    // ✅ Resolve customer ID from potential phone number
    const customerId = await resolveCustomerId(bookingData.customerId);
    
    const bookingId = `booking_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const booking: Booking = {
      id: bookingId,
      customerId, // Store the resolved real customer ID
      vendorId: bookingData.vendorId,
      staffId: bookingData.staffId || null,
      petId: bookingData.petId,
      serviceId: bookingData.serviceId,
      serviceName: bookingData.serviceName,
      serviceType: bookingData.serviceType,
      
      bookingDate: bookingData.bookingDate,
      startTime: bookingData.startTime,
      duration: bookingData.duration,
      frequency: bookingData.frequency || 'once',
      
      serviceLocation: bookingData.serviceLocation,
      address: bookingData.address,
      coordinates: bookingData.coordinates,
      
      basePrice: bookingData.basePrice || 0,
      taxes: bookingData.taxes || 0,
      discount: bookingData.discount || 0,
      totalAmount: bookingData.totalAmount || 0,
      currency: 'INR',
      
      status: 'pending',
      paymentStatus: 'pending',
      
      // ✅ CRITICAL FIX: Capture specialized fields
      specialInstructions: bookingData.specialInstructions || bookingData.notes,
      metadata: {
        petDetails: bookingData.petDetails,
        guestCount: bookingData.guestCount || bookingData.pax,
        symptoms: bookingData.symptoms,
        checkinDate: bookingData.checkinDate,
        checkoutDate: bookingData.checkoutDate
      },
      // ✅ CRITICAL FIX: Generate Meeting Link for Tele-consult
      meetingLink: (bookingData.serviceType === 'tele' || bookingData.serviceType === 'teleconsultation') 
        ? `https://meet.jit.si/warmpawz-${bookingId}` 
        : undefined,
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`booking:${bookingId}`, booking);
    
    // Add to customer's bookings
    const customerBookings = await kv.get(`booking:customer:${customerId}`) || [];
    customerBookings.unshift(bookingId);
    await kv.set(`booking:customer:${customerId}`, customerBookings);
    
    // Add to vendor's bookings
    const vendorBookings = await kv.get(`vendor:bookings:${booking.vendorId}`) || [];
    vendorBookings.unshift(bookingId);
    await kv.set(`vendor:bookings:${booking.vendorId}`, vendorBookings);
    
    // ✅ Add to staff's bookings
    if (booking.staffId) {
      const staffBookings = await kv.get(`staff:${booking.staffId}:bookings`) || [];
      staffBookings.unshift(bookingId);
      await kv.set(`staff:${booking.staffId}:bookings`, staffBookings);
    }
    
    // Add to pending bookings
    const pendingBookings = await kv.get('booking:pending') || [];
    pendingBookings.unshift(bookingId);
    await kv.set('booking:pending', pendingBookings);
    
    // Update customer stats
    const customer = await kv.get(`customer:${customerId}`);
    if (customer) {
      customer.totalBookings += 1;
      customer.activeBookings += 1;
      await kv.set(`customer:${customerId}`, customer);
    }
    
    // Create notification for vendor
    await createNotification({
      userId: booking.vendorId,
      userType: 'vendor',
      type: 'booking_confirmed',
      title: 'New Booking Request',
      message: `You have a new booking request for ${booking.serviceName}`,
      actionType: 'view_booking',
      actionData: { bookingId }
    });

    return sendSuccess(c, { booking });
  } catch (error) {
    console.log('Create booking alias error:', error);
    return sendError(c, error, 500);
  }
});

// Update booking status
app.put("/make-server-3dd53475/booking/:bookingId/status", async (c) => {
  try {
    const { bookingId } = c.req.param();
    const { status, trackingData, sessionSummary } = await c.req.json();
    
    const booking = await kv.get(`booking:${bookingId}`);
    
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    booking.status = status;
    booking.updatedAt = new Date().toISOString();
    
    if (trackingData) {
      booking.trackingData = { ...booking.trackingData, ...trackingData };
    }
    
    if (sessionSummary) {
      booking.sessionSummary = sessionSummary;
    }
    
    // Update timestamps based on status
    if (status === 'confirmed') booking.confirmedAt = new Date().toISOString();
    if (status === 'in_progress') booking.startedAt = new Date().toISOString();
    if (status === 'completed') {
      booking.completedAt = new Date().toISOString();
      
      // Update customer stats
      const customer = await kv.get(`customer:${booking.customerId}`);
      if (customer) {
        customer.completedBookings += 1;
        customer.activeBookings -= 1;
        await kv.set(`customer:${booking.customerId}`, customer);
      }
      
      // Update vendor stats
      const vendor = await kv.get(`vendor:${booking.vendorId}`);
      if (vendor) {
        vendor.completedBookings += 1;
        await kv.set(`vendor:${booking.vendorId}`, vendor);
      }
    }
    
    await kv.set(`booking:${bookingId}`, booking);
    
    // Create notification
    const notificationMessages: Record<string, string> = {
      confirmed: 'Your booking has been confirmed',
      in_progress: 'Your service has started',
      completed: 'Your service has been completed. Please rate your experience'
    };
    
    if (notificationMessages[status]) {
      await createNotification({
        userId: booking.customerId,
        userType: 'customer',
        type: status === 'confirmed' ? 'booking_confirmed' : 
              status === 'in_progress' ? 'service_started' : 'service_completed',
        title: 'Booking Update',
        message: notificationMessages[status],
        actionType: 'view_booking',
        actionData: { bookingId }
      });
    }
    
    return sendSuccess(c, { booking });
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
    
    const booking = await kv.get(`booking:${bookingId}`);
    
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    booking.status = cancelledBy === 'customer' ? 'cancelled_by_customer' : 'cancelled_by_vendor';
    booking.cancellationReason = reason;
    booking.cancelledAt = new Date().toISOString();
    booking.cancelledBy = cancelledBy;
    booking.updatedAt = new Date().toISOString();
    
    await kv.set(`booking:${bookingId}`, booking);
    
    // Update customer stats
    const customer = await kv.get(`customer:${booking.customerId}`);
    if (customer && customer.activeBookings > 0) {
      customer.activeBookings -= 1;
      await kv.set(`customer:${booking.customerId}`, customer);
    }
    
    // Create notification
    const targetUser = cancelledBy === 'customer' ? booking.vendorId : booking.customerId;
    const targetType = cancelledBy === 'customer' ? 'vendor' : 'customer';
    
    await createNotification({
      userId: targetUser,
      userType: targetType,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `Booking for ${booking.serviceName} has been cancelled`,
      actionType: 'view_booking',
      actionData: { bookingId }
    });
    
    return sendSuccess(c, { booking });
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
    
    const booking = await kv.get(`booking:${bookingId}`);
    
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    if (booking.status !== 'completed') {
      return sendError(c, 'Can only review completed bookings', 400);
    }
    
    const reviewId = `review_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const reviewObj: Review = {
      id: reviewId,
      bookingId,
      customerId: booking.customerId,
      vendorId: booking.vendorId,
      serviceId: booking.serviceId,
      rating,
      review,
      aspects,
      photos: photos || [],
      flagged: false,
      verified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await kv.set(`review:${reviewId}`, reviewObj);
    await kv.set(`review:booking:${bookingId}`, reviewId);
    
    // Add to vendor's reviews
    const vendorReviews = await kv.get(`review:vendor:${booking.vendorId}`) || [];
    vendorReviews.unshift(reviewId);
    await kv.set(`review:vendor:${booking.vendorId}`, vendorReviews);
    
    // Update booking
    booking.rating = rating;
    booking.review = review;
    booking.reviewedAt = new Date().toISOString();
    await kv.set(`booking:${bookingId}`, booking);
    
    // Update vendor rating
    const vendor = await kv.get(`vendor:${booking.vendorId}`);
    if (vendor) {
      const totalRating = vendor.rating * vendor.totalReviews + rating;
      vendor.totalReviews += 1;
      vendor.rating = totalRating / vendor.totalReviews;
      await kv.set(`vendor:${booking.vendorId}`, vendor);
    }
    
    // Create notification for vendor
    await createNotification({
      userId: booking.vendorId,
      userType: 'vendor',
      type: 'rating_received',
      title: 'New Review Received',
      message: `You received a ${rating}-star review`,
      actionType: 'view_booking',
      actionData: { bookingId }
    });
    
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
    
    // ✅ FIX: Add timeout protection and graceful fallback for missing keys
    let notificationIds: string[] = [];
    
    try {
      if (unreadOnly === 'true') {
        const unreadIds = await kv.get(`notification:unread:${userId}`);
        notificationIds = unreadIds || [];
      } else {
        const userNotificationIds = await kv.get(`notification:user:${userId}`);
        notificationIds = userNotificationIds || [];
      }
    } catch (kvError) {
      // ✅ FIX: Log error but continue with empty array instead of failing
      console.error(`❌ [KV-GET] Error fetching notifications for user ${userId}:`, kvError);
      notificationIds = []; // Fallback to empty array
    }
    
    // ✅ FIX: If no notification IDs, return early with empty array
    if (!notificationIds || notificationIds.length === 0) {
      return sendSuccess(c, { notifications: [] });
    }
    
    // ✅ FIX: Fetch notifications with individual error handling
    const notificationPromises = notificationIds
      .slice(0, parseInt(limit as string))
      .map(async (id: string) => {
        try {
          return await kv.get(`notification:${id}`);
        } catch (error) {
          console.error(`❌ [KV-GET] Error fetching notification ${id}:`, error);
          return null; // Return null for failed fetches
        }
      });
    
    const notifications = await Promise.all(notificationPromises);
    
    return sendSuccess(c, { notifications: notifications.filter(Boolean) });
  } catch (error) {
    console.log('Get notifications error:', error);
    return sendError(c, error, 500);
  }
};

// Get user notifications (Generic)
app.get("/make-server-3dd53475/notifications/:userId", handleGetNotifications);
// Alias for Customer App
app.get("/make-server-3dd53475/customer/notifications/:userId", handleGetNotifications);
// Alias for Vendor App
app.get("/make-server-3dd53475/vendor/notifications/:userId", handleGetNotifications);

const handleReadNotification = async (c: any) => {
  try {
    const { notificationId } = c.req.param();
    
    const notification = await kv.get(`notification:${notificationId}`);
    
    if (!notification) {
      return sendError(c, 'Notification not found', 404);
    }
    
    notification.read = true;
    notification.readAt = new Date().toISOString();
    await kv.set(`notification:${notificationId}`, notification);
    
    // Remove from unread list
    const unreadIds = await kv.get(`notification:unread:${notification.userId}`) || [];
    const updatedUnreadIds = unreadIds.filter((id: string) => id !== notificationId);
    await kv.set(`notification:unread:${notification.userId}`, updatedUnreadIds);
    
    return sendSuccess(c, {});
  } catch (error) {
    console.log('Mark notification read error:', error);
    return sendError(c, error, 500);
  }
};

// Mark notification as read
app.put("/make-server-3dd53475/notification/:notificationId/read", handleReadNotification);
app.put("/make-server-3dd53475/customer/notification/:notificationId/read", handleReadNotification);
app.put("/make-server-3dd53475/vendor/notification/:notificationId/read", handleReadNotification);

// ============================================
// HELPER FUNCTIONS
// ============================================

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

// Create notification
async function createNotification(data: {
  userId: string;
  userType: 'customer' | 'vendor';
  type: string;
  title: string;
  message: string;
  actionType?: string;
  actionData?: any;
}) {
  const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const notification: Notification = {
    id: notificationId,
    userId: data.userId,
    userType: data.userType,
    type: data.type as any,
    title: data.title,
    message: data.message,
    actionType: data.actionType as any,
    actionData: data.actionData,
    read: false,
    createdAt: new Date().toISOString()
  };
  
  await kv.set(`notification:${notificationId}`, notification);
  
  // Add to user's notifications (Generic)
  const userNotifications = await kv.get(`notification:user:${data.userId}`) || [];
  userNotifications.unshift(notificationId);
  await kv.set(`notification:user:${data.userId}`, userNotifications);
  
  // ✅ Add to vendor specific list if user is a vendor (Required for Vendor App)
  if (data.userType === 'vendor') {
    // Matches useVendorNotificationService reading pattern: vendor:{id}:notifications
    const vendorNotifications = await kv.get(`vendor:${data.userId}:notifications`) || [];
    vendorNotifications.unshift(notificationId);
    await kv.set(`vendor:${data.userId}:notifications`, vendorNotifications);
    console.log(`🔔 Added notification ${notificationId} to vendor specific list for ${data.userId}`);
  }
  
  // Add to unread list
  const unreadNotifications = await kv.get(`notification:unread:${data.userId}`) || [];
  unreadNotifications.unshift(notificationId);
  await kv.set(`notification:unread:${data.userId}`, unreadNotifications);
}

// Initialize default services
async function initializeServices() {
  const services = [
    { id: 'grooming', name: 'Pet Grooming', icon: '✂️', category: 'wellness', supportsClinic: true, supportsHome: true, basePriceRange: { min: 500, max: 2000 }, pricingUnit: 'per_session', popular: true, active: true },
    { id: 'walking', name: 'Pet Walking', icon: '🐕', category: 'essential', supportsClinic: false, supportsHome: true, basePriceRange: { min: 200, max: 500 }, pricingUnit: 'per_session', popular: true, active: true },
    { id: 'boarding', name: 'Boarding', icon: '🏠', category: 'essential', supportsClinic: true, supportsHome: false, basePriceRange: { min: 800, max: 2500 }, pricingUnit: 'per_day', popular: true, active: true },
    { id: 'training', name: 'Pet Training', icon: '🎓', category: 'wellness', supportsClinic: true, supportsHome: true, basePriceRange: { min: 1000, max: 5000 }, pricingUnit: 'per_session', popular: false, active: true },
    { id: 'cafes', name: 'Pet Cafes', icon: '☕', category: 'lifestyle', supportsClinic: true, supportsHome: false, basePriceRange: { min: 300, max: 1000 }, pricingUnit: 'per_session', popular: false, active: true },
    { id: 'adoption', name: 'Adoption', icon: '🤝', category: 'lifestyle', supportsClinic: true, supportsHome: true, basePriceRange: { min: 0, max: 5000 }, pricingUnit: 'per_session', popular: false, active: true },
    { id: 'sunset', name: 'SunSet Services', icon: '🌅', category: 'essential', supportsClinic: false, supportsHome: true, basePriceRange: { min: 5000, max: 15000 }, pricingUnit: 'per_session', popular: false, active: true },
    { id: 'events', name: 'Events', icon: '🎪', category: 'lifestyle', supportsClinic: true, supportsHome: true, basePriceRange: { min: 2000, max: 10000 }, pricingUnit: 'per_session', popular: false, active: true },
    { id: 'insurance', name: 'Pet Insurance', icon: '🛡️', category: 'healthcare', supportsClinic: true, supportsHome: true, basePriceRange: { min: 500, max: 3000 }, pricingUnit: 'per_month', popular: false, active: true },
    { id: 'mating', name: 'Mating & Dating', icon: '💕', category: 'lifestyle', supportsClinic: true, supportsHome: false, basePriceRange: { min: 1000, max: 5000 }, pricingUnit: 'per_session', popular: false, active: true }
  ];
  
  for (const service of services) {
    await kv.set(`service:${service.id}`, service);
  }
  
  await kv.set('services:all', services.map(s => s.id));
}

}