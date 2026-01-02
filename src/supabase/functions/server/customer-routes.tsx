// ✅ AWS LAMBDA COMPATIBLE: Using Node.js compatible imports
// Note: For Supabase Edge Functions (Deno), keep npm: imports
// For Lambda conversion, replace with: import { Hono } from 'hono';
import { Hono } from "hono";

// ✅ SQL MIGRATION: Replace KV with SQL repositories
// ✅ AWS RDS COMPATIBLE: Using SQL repositories (works with both Supabase and Lambda)
// For Lambda: import from '../../../backend/lambda/src/repositories/index'
// For Supabase: import from '../../../supabase/lib/repositories/index'
import { 
  getCustomersRepository,
  getOtpRepository,
  getSessionsRepository,
  getPetsRepository,
  getServicesRepository,
  getBookingsRepository,
  getReviewsRepository,
  getNotificationsRepository,
  getVendorsRepository
} from "../../../supabase/lib/repositories/index";

import type { Customer, Pet, Booking, ChatMessage, Review, Notification } from "./database-schema";
import { sendSuccess, sendError } from "./response-utils";
import { normalizePhone, isValidIndianMobile } from "./phone-utils";
import { verifyCognitoOTP } from "./cognito-auth-helper";

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
    
    // ✅ SQL: Store OTP using repository
    const otpRepo = getOtpRepository();
    await otpRepo.create({
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
    
    let { phone, otp, session, role = 'customer' } = body;
    
    if (!phone || !otp) {
      console.error('❌ [OTP-VERIFY] Missing phone or OTP');
      return sendError(c, 'Phone and OTP are required', 400);
    }
    
    // ✅ CRITICAL FIX: Normalize phone number to match storage key
    phone = normalizePhone(phone);
    console.log(`🔐 [OTP-VERIFY] Normalized phone: ${phone}`);
    
    let otpVerified = false;
    let cognitoTokens = null;
    
    // ✅ COGNITO: Try Cognito verification first if session is provided
    if (session && role && ['customer', 'vendor'].includes(role)) {
      try {
        console.log('🔐 [OTP-VERIFY] Attempting Cognito verification...');
        const cognitoResult = await verifyCognitoOTP(phone, otp, session, role as 'customer' | 'vendor');
        
        if (cognitoResult.success) {
          otpVerified = true;
          cognitoTokens = {
            accessToken: cognitoResult.accessToken,
            idToken: cognitoResult.idToken,
            refreshToken: cognitoResult.refreshToken,
            expiresIn: cognitoResult.expiresIn,
          };
          console.log('✅ [OTP-VERIFY] Cognito OTP verified successfully');
        } else {
          console.log('⚠️ [OTP-VERIFY] Cognito verification failed, trying traditional OTP...');
        }
      } catch (cognitoError) {
        console.error('❌ [OTP-VERIFY] Cognito verification error:', cognitoError);
        // Fall through to traditional OTP verification
      }
    }
    
    // ✅ SQL: Fallback to traditional OTP verification if Cognito failed or not used
    if (!otpVerified) {
      const otpRepo = getOtpRepository();
      otpVerified = await otpRepo.verify(phone, otp, true);
      
      if (!otpVerified) {
        console.error('❌ [OTP-VERIFY] OTP verification failed');
        return sendError(c, 'Invalid OTP or OTP expired', 400);
      }
      
      console.log(`✅ [OTP-VERIFY] Traditional OTP verified successfully`);
    }
    
    // ✅ SQL: Check if customer exists
    const customersRepo = getCustomersRepository();
    let customer = await customersRepo.findByPhone(phone);
    
    let isNewUser = false;
    
    if (!customer) {
      // ✅ SQL: New customer - create in database
      isNewUser = true;
      const generatedCustomerId = `customer_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      customer = await customersRepo.create({
        customer_id: generatedCustomerId,
        phone,
        full_name: '', // Will be set during onboarding
      });
    } else {
      // ✅ SQL: Update existing customer's last login
      await customersRepo.updateLastLogin(customer.id);
      
      // ✅ SQL: Get pets for customer
      const petsRepo = getPetsRepository();
      const pets = await petsRepo.findByCustomer(customer.id);
      customer.petIds = pets.map((p: any) => p.id); // Map to legacy format if needed
    }
    
    // ✅ SQL: Generate session token
    const sessionsRepo = getSessionsRepository();
    const sessionToken = `token_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    await sessionsRepo.create({
      user_id: customer.id,
      user_type: 'customer',
      token: sessionToken,
      expires_in_days: 30,
    });
    
    console.log(`✅ [OTP-VERIFY] Login successful for ${phone}, isNewUser: ${isNewUser}`);
    
    return sendSuccess(c, {
      isNewUser,
      customer,
      sessionToken,
      ...(cognitoTokens && { cognitoTokens }), // Include Cognito tokens if available
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
    const normalizedPhone = normalizePhone(phone);
    
    // ✅ SQL: Get customer by phone
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(normalizedPhone);
    
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }

    // ✅ SQL: Get pets for customer
    const petsRepo = getPetsRepository();
    const pets = await petsRepo.findByCustomer(customer.id);
    customer.petIds = pets.map((p: any) => p.id);
    
    return sendSuccess(c, { customerId: customer.id, customer });
  } catch (error) {
    console.log('Get customer by phone error:', error);
    return sendError(c, error, 500);
  }
});

// ✅ SQL: Helper to resolve customer ID from phone or ID
async function resolveCustomerId(identifier: string): Promise<string | null> {
  // Allow 10-15 digits, optionally starting with +
  if (/^\+?\d{10,15}$/.test(identifier)) {
    const normalizedPhone = normalizePhone(identifier);
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findByPhone(normalizedPhone);
    if (customer) return customer.id;
  }
  // Try as UUID or customer_id
  const customersRepo = getCustomersRepository();
  const customer = await customersRepo.findById(identifier);
  if (customer) return customer.id;
  return null;
}

// Get customer profile
app.get("/make-server-3dd53475/customer/:customerId", async (c) => {
  try {
    const rawId = c.req.param('customerId');
    const customerId = await resolveCustomerId(rawId);
    
    if (!customerId) {
      return sendError(c, 'Customer not found', 404);
    }
    
    // ✅ SQL: Get customer by ID
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }

    // ✅ SQL: Get pets for customer
    const petsRepo = getPetsRepository();
    const pets = await petsRepo.findByCustomer(customer.id);
    customer.petIds = pets.map((p: any) => p.id);
    
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
    
    if (!customerId) {
      return sendError(c, 'Customer not found', 404);
    }
    
    const updates = await c.req.json();
    
    // ✅ SQL: Get customer first
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }
    
    // ✅ SQL: Update customer (don't allow phone change)
    const updateData: any = {};
    if (updates.full_name !== undefined) updateData.full_name = updates.full_name;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.address !== undefined) updateData.address = updates.address;
    // Map other fields as needed
    
    const updatedCustomer = await customersRepo.update(customerId, updateData);
    
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
    
    if (!customerId) {
      return sendError(c, 'Customer not found', 404);
    }
    
    const { name, address, coordinates } = await c.req.json();
    
    // ✅ SQL: Update customer onboarding status
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    
    if (!customer) {
      return sendError(c, 'Customer not found', 404);
    }
    
    const updateData: any = {
      full_name: name,
      address: address ? { address, coordinates } : null,
      journey_stage: 'onboarding_complete',
    };
    
    const updatedCustomer = await customersRepo.update(customerId, updateData);
    
    return sendSuccess(c, { customer: updatedCustomer });
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
    if (!customerId) return sendError(c, 'Customer not found', 404);
    
    // ✅ SQL: Get customer
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    
    if (!customer) return sendError(c, 'Customer not found', 404);
    
    // Map backend fields to UI fields
    const nameParts = (customer.full_name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const addressObj = typeof customer.address === 'object' ? customer.address : {};
    const preferences = customer.preferences || {};
    
    const profile = {
      firstName,
      lastName,
      email: customer.email || '',
      phone: customer.phone || phone,
      address: typeof addressObj === 'object' ? (addressObj.address || '') : (customer.address || ''),
      pincode: typeof addressObj === 'object' ? (addressObj.pincode || '') : '',
      photo: preferences.profile_photo_url || ''
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
    
    if (!customerId) {
      return sendError(c, 'Profile not found', 404);
    }
    
    // ✅ SQL: Get customer
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    
    if (!customer) {
      return sendError(c, 'Profile not found', 404);
    }
    
    // Map backend fields to UI fields
    const nameParts = (customer.full_name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const addressObj = typeof customer.address === 'object' ? customer.address : {};
    const preferences = customer.preferences || {};
    
    const profile = {
      firstName,
      lastName,
      email: customer.email || '',
      phone: customer.phone || identifier,
      address: typeof addressObj === 'object' ? (addressObj.address || '') : (customer.address || ''),
      pincode: typeof addressObj === 'object' ? (addressObj.pincode || '') : '',
      photo: preferences.profile_photo_url || ''
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
    
    // ✅ SQL: Get customer first
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    
    if (!customer) {
      return sendError(c, 'Customer record missing', 404);
    }
    
    // ✅ SQL: Update customer fields
    const updateData: any = {
      full_name: `${firstName} ${lastName}`.trim(),
      email: email || customer.email,
      address: { address, pincode },
      preferences: {
        ...(customer.preferences || {}),
        profile_photo_url: photo || (customer.preferences?.profile_photo_url || null),
      },
    };
    
    const updatedCustomer = await customersRepo.update(customerId, updateData);
    
    return sendSuccess(c, { profile: {
      firstName, lastName, email: updatedCustomer.email, phone: updatedCustomer.phone, address, pincode, photo: updatedCustomer.preferences?.profile_photo_url || photo
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
    const customerId = await resolveCustomerId(identifier);

    if (!customerId) {
      return sendSuccess(c, { pets: [] });
    }

    // ✅ SQL: Get pets for customer
    const petsRepo = getPetsRepository();
    const pets = await petsRepo.findByCustomer(customerId);
    
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
    const petsRepo = getPetsRepository();
    const pets = await petsRepo.findByCustomer(customerId);
    
    return sendSuccess(c, { pets });
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
    
    if (!customerId) {
      return sendError(c, 'Customer not found', 404);
    }
    
    const petData = await c.req.json();
    
    // ✅ SQL: Create pet using repository
    const petsRepo = getPetsRepository();
    const pet = await petsRepo.create({
      customer_id: customerId,
      name: petData.name,
      type: petData.type || petData.species,
      breed: petData.breed,
      age: petData.age,
      gender: petData.gender,
      weight: petData.weight,
      color: petData.color,
      photo_url: Array.isArray(petData.photos) ? petData.photos[0] : petData.photos,
      medical_conditions: petData.medicalConditions || [],
      allergies: petData.allergies || [],
      vaccinations: petData.vaccinated ? { vaccinated: true } : null,
    });
    
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

    // ✅ SQL: Process each pet - create or update
    const petsRepo = getPetsRepository();
    const savedPets = [];

    for (const p of pets) {
      if (p.id) {
        // Update existing pet
        const existingPet = await petsRepo.findById(p.id);
        if (existingPet) {
          const updatedPet = await petsRepo.update(p.id, {
            name: p.name,
            type: p.type || p.species,
            breed: p.breed,
            age: p.age,
            gender: p.gender,
            weight: p.weight,
            color: p.color,
            photo_url: Array.isArray(p.photos) ? p.photos[0] : p.photos,
            medical_conditions: p.medicalConditions || [],
            allergies: p.allergies || [],
          });
          savedPets.push(updatedPet);
        }
      } else {
        // Create new pet
        const newPet = await petsRepo.create({
          customer_id: customerId,
          name: p.name,
          type: p.type || p.species,
          breed: p.breed,
          age: p.age,
          gender: p.gender,
          weight: p.weight,
          color: p.color,
          photo_url: Array.isArray(p.photos) ? p.photos[0] : p.photos,
          medical_conditions: p.medicalConditions || [],
          allergies: p.allergies || [],
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
    
    // ✅ SQL: Get pet first
    const petsRepo = getPetsRepository();
    const pet = await petsRepo.findById(petId);
    
    if (!pet) {
      return sendError(c, 'Pet not found', 404);
    }
    
    // ✅ SQL: Update pet
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.type !== undefined || updates.species !== undefined) updateData.type = updates.type || updates.species;
    if (updates.breed !== undefined) updateData.breed = updates.breed;
    if (updates.age !== undefined) updateData.age = updates.age;
    if (updates.gender !== undefined) updateData.gender = updates.gender;
    if (updates.weight !== undefined) updateData.weight = updates.weight;
    if (updates.color !== undefined) updateData.color = updates.color;
    if (updates.photos !== undefined) updateData.photo_url = Array.isArray(updates.photos) ? updates.photos[0] : updates.photos;
    if (updates.medicalConditions !== undefined) updateData.medical_conditions = updates.medicalConditions;
    if (updates.allergies !== undefined) updateData.allergies = updates.allergies;
    
    const updatedPet = await petsRepo.update(petId, updateData);
    
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
    
    // ✅ SQL: Get pet first to check existence
    const petsRepo = getPetsRepository();
    const pet = await petsRepo.findById(petId);
    
    if (!pet) {
      return sendError(c, 'Pet not found', 404);
    }
    
    // ✅ SQL: Soft delete pet (sets is_active = false)
    await petsRepo.delete(petId);
    
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
    
    // ✅ SQL: Get pet by ID
    const petsRepo = getPetsRepository();
    const pet = await petsRepo.findById(petId);
    
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
    // ✅ SQL: Get all active services from database
    const servicesRepo = getServicesRepository();
    const services = await servicesRepo.findAll({ is_active: true });
    
    // Transform to match expected format if needed
    const formattedServices = services.map((s: any) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      price: s.price,
      duration: s.duration_minutes,
      // Add other fields as needed
    }));
    
    return sendSuccess(c, { services: formattedServices });
  } catch (error) {
    console.log('Get services error:', error);
    return sendError(c, error, 500);
  }
});

// Get service details
app.get("/make-server-3dd53475/service/:serviceId", async (c) => {
  try {
    const { serviceId } = c.req.param();
    
    // ✅ SQL: Get service by ID
    const servicesRepo = getServicesRepository();
    const service = await servicesRepo.findById(serviceId);
    
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
    
    // ✅ SQL: Get service first to get category
    const servicesRepo = getServicesRepository();
    const service = await servicesRepo.findById(serviceId);
    
    if (!service) {
      return sendSuccess(c, { vendors: [] });
    }
    
    // ✅ SQL: Get vendors by category (or all vendors if service has vendor_id)
    const vendorsRepo = getVendorsRepository();
    let vendors: any[] = [];
    
    if (service.vendor_id) {
      // Service is vendor-specific
      const vendor = await vendorsRepo.findById(service.vendor_id);
      if (vendor && vendor.status === 'approved' && vendor.is_active) {
        vendors = [vendor];
      }
    } else {
      // Get vendors by category
      vendors = await vendorsRepo.findAll({ status: 'approved' });
    }
    
    // Filter active vendors
    let filteredVendors = vendors.filter((v: any) => v && v.is_active);
    
    // Filter by service type (clinic/home) - check vendor specialization
    if (serviceType) {
      filteredVendors = filteredVendors.filter((v: any) => {
        const specialization = v.specialization || '';
        if (serviceType === 'clinic') return specialization.includes('clinic');
        if (serviceType === 'home') return specialization.includes('home');
        return true;
      });
    }
    
    // Filter by location if coordinates provided
    if (lat && lng) {
      const userLat = parseFloat(lat as string);
      const userLng = parseFloat(lng as string);
      const radiusKm = parseFloat(radius as string);
      
      filteredVendors = filteredVendors.filter((v: any) => {
        if (!v.latitude || !v.longitude) return false;
        const distance = calculateDistance(
          userLat, userLng,
          v.latitude, v.longitude
        );
        return distance <= radiusKm;
      }).map((v: any) => ({
        ...v,
        distance: calculateDistance(
          userLat, userLng,
          v.latitude, v.longitude
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
    
    // ✅ SQL: Get vendor by ID - try multiple lookup methods
    const vendorsRepo = getVendorsRepository();
    let vendor = await vendorsRepo.findById(vendorId);
    
    // If not found by UUID, try by vendor_id (string identifier)
    if (!vendor && vendorsRepo.findByVendorId) {
      vendor = await vendorsRepo.findByVendorId(vendorId);
    }
    
    // If still not found, try resolve method
    if (!vendor && vendorsRepo.resolveVendorId) {
      const resolvedId = await vendorsRepo.resolveVendorId(vendorId);
      if (resolvedId) {
        vendor = await vendorsRepo.findById(resolvedId);
      }
    }
    
    if (!vendor) {
      return sendError(c, 'Vendor not found', 404);
    }
    
    // ✅ SQL: Get vendor reviews
    const reviewsRepo = getReviewsRepository();
    const reviews = await reviewsRepo.findByVendor(vendor.id, { limit: 10 });
    
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

// Get bookings by phone or customer ID (Legacy/Frontend Support)
app.get("/make-server-3dd53475/bookings/:identifier", async (c) => {
  try {
    const { identifier } = c.req.param();
    // ✅ SQL: Resolve identifier to customer ID
    const customerId = await resolveCustomerId(identifier);
    
    if (!customerId) {
      return sendSuccess(c, { bookings: [] });
    }
    
    console.log(`🔍 [GET-BOOKINGS] Resolving bookings for: ${identifier} -> ${customerId}`);

    // ✅ SQL: Get bookings for customer
    const bookingsRepo = getBookingsRepository();
    let bookings = await bookingsRepo.findByCustomer(customerId);
    
    // Sort by date desc
    bookings.sort((a: any, b: any) => 
      new Date(b.booking_date || b.created_at).getTime() - new Date(a.booking_date || a.created_at).getTime()
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
    
    if (!customerId) {
      return sendSuccess(c, { bookings: [] });
    }
    
    // ✅ SQL: Get bookings for customer
    const bookingsRepo = getBookingsRepository();
    const bookings = await bookingsRepo.findByCustomer(customerId);
    
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
    
    if (!resolvedId) {
      return sendSuccess(c, { bookings: [] });
    }
    
    // ✅ SQL: Get bookings for customer
    const bookingsRepo = getBookingsRepository();
    let bookings = await bookingsRepo.findByCustomer(resolvedId, { limit: parseInt(limit as string) });
    
    if (status) {
      bookings = bookings.filter((b: any) => b.status === status);
    }
    
    // Sort by date desc
    bookings.sort((a: any, b: any) => 
      new Date(b.booking_date || b.created_at).getTime() - new Date(a.booking_date || a.created_at).getTime()
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
    
    if (!customerId) {
      return sendError(c, 'Customer not found', 404);
    }
    
    const { status, limit = 20 } = c.req.query();
    
    // ✅ SQL: Get bookings for customer
    const bookingsRepo = getBookingsRepository();
    let bookings = await bookingsRepo.findByCustomer(customerId, { limit: parseInt(limit as string) });
    
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
    
    // ✅ SQL: Resolve customer ID from potential phone number
    const customerId = await resolveCustomerId(bookingData.customerId);
    
    if (!customerId) {
      return sendError(c, 'Customer not found', 404);
    }
    
    // Extract coordinates if provided
    const coordinates = bookingData.coordinates || {};
    const addressParts = (bookingData.address || '').split(',').map((s: string) => s.trim());
    
    // ✅ SQL: Create booking using repository
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.create({
      customer_id: customerId,
      vendor_id: bookingData.vendorId,
      staff_id: bookingData.staffId || null,
      service_id: bookingData.serviceId,
      booking_date: bookingData.bookingDate,
      booking_time: bookingData.startTime,
      service_type: bookingData.serviceType || 'standard',
      address: bookingData.address,
      city: addressParts[addressParts.length - 3] || null,
      state: addressParts[addressParts.length - 2] || null,
      pincode: addressParts[addressParts.length - 1] || null,
      latitude: coordinates.lat || null,
      longitude: coordinates.lng || null,
      base_price: bookingData.basePrice || 0,
      tax_amount: bookingData.taxes || 0,
      discount_amount: bookingData.discount || 0,
      total_amount: bookingData.totalAmount || 0,
      notes: JSON.stringify({
        serviceName: bookingData.serviceName,
        petDetails: bookingData.petDetails,
        guestCount: bookingData.guestCount || bookingData.pax,
        symptoms: bookingData.symptoms,
        checkinDate: bookingData.checkinDate,
        checkoutDate: bookingData.checkoutDate,
        specialInstructions: bookingData.specialInstructions || bookingData.notes,
        meetingLink: (bookingData.serviceType === 'tele' || bookingData.serviceType === 'teleconsultation') 
          ? `https://meet.jit.si/warmpawz-${Date.now()}` 
          : undefined,
      }),
    });
    
    // ✅ SQL: Update customer stats
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    if (customer) {
      await customersRepo.update(customerId, {
        total_bookings: (customer.total_bookings || 0) + 1,
      });
    }
    
    // ✅ SQL: Create notification for vendor
    await createNotification({
      userId: booking.vendor_id || '',
      userType: 'vendor',
      type: 'booking_confirmed',
      title: 'New Booking Request',
      message: `You have a new booking request for ${bookingData.serviceName || 'service'}`,
      actionType: 'view_booking',
      actionData: { bookingId: booking.id }
    });

    // ✅ CRITICAL FIX: AMBULANCE SOS BROADCAST
    if (booking.status === 'emergency' || booking.service_type === 'ambulance') {
       console.log(`🚨 EMERGENCY SOS TRIGGERED: Booking ${booking.id}`);
       await createNotification({
          userId: booking.vendor_id || '',
          userType: 'vendor',
          type: 'emergency_alert' as any,
          title: '🚨 AMBULANCE SOS REQUEST',
          message: `URGENT: Emergency request at ${booking.address || 'Customer Location'}`,
          actionType: 'view_booking',
          actionData: { bookingId: booking.id, isEmergency: true }
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
    
    // ✅ SQL: Resolve customer ID from potential phone number
    const customerId = await resolveCustomerId(bookingData.customerId);
    
    if (!customerId) {
      return sendError(c, 'Customer not found', 404);
    }
    
    // Extract coordinates if provided
    const coordinates = bookingData.coordinates || {};
    const addressParts = (bookingData.address || '').split(',').map((s: string) => s.trim());
    
    // ✅ SQL: Create booking using repository (same as above)
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.create({
      customer_id: customerId,
      vendor_id: bookingData.vendorId,
      staff_id: bookingData.staffId || null,
      service_id: bookingData.serviceId,
      booking_date: bookingData.bookingDate,
      booking_time: bookingData.startTime,
      service_type: bookingData.serviceType || 'standard',
      address: bookingData.address,
      city: addressParts[addressParts.length - 3] || null,
      state: addressParts[addressParts.length - 2] || null,
      pincode: addressParts[addressParts.length - 1] || null,
      latitude: coordinates.lat || null,
      longitude: coordinates.lng || null,
      base_price: bookingData.basePrice || 0,
      tax_amount: bookingData.taxes || 0,
      discount_amount: bookingData.discount || 0,
      total_amount: bookingData.totalAmount || 0,
      notes: JSON.stringify({
        serviceName: bookingData.serviceName,
        petDetails: bookingData.petDetails,
        guestCount: bookingData.guestCount || bookingData.pax,
        symptoms: bookingData.symptoms,
        checkinDate: bookingData.checkinDate,
        checkoutDate: bookingData.checkoutDate,
        specialInstructions: bookingData.specialInstructions || bookingData.notes,
        meetingLink: (bookingData.serviceType === 'tele' || bookingData.serviceType === 'teleconsultation') 
          ? `https://meet.jit.si/warmpawz-${Date.now()}` 
          : undefined,
      }),
    });
    
    // ✅ SQL: Update customer stats
    const customersRepo = getCustomersRepository();
    const customer = await customersRepo.findById(customerId);
    if (customer) {
      await customersRepo.update(customerId, {
        total_bookings: (customer.total_bookings || 0) + 1,
      });
    }
    
    // ✅ SQL: Create notification for vendor
    await createNotification({
      userId: booking.vendor_id || '',
      userType: 'vendor',
      type: 'booking_confirmed',
      title: 'New Booking Request',
      message: `You have a new booking request for ${bookingData.serviceName || 'service'}`,
      actionType: 'view_booking',
      actionData: { bookingId: booking.id }
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
    
    // ✅ SQL: Get booking first
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // ✅ SQL: Update booking status
    const updateData: any = {
      status,
    };
    
    if (trackingData || sessionSummary) {
      const notes = JSON.parse(booking.notes || '{}');
      if (trackingData) notes.trackingData = { ...notes.trackingData, ...trackingData };
      if (sessionSummary) notes.sessionSummary = sessionSummary;
      updateData.notes = JSON.stringify(notes);
    }
    
    // Update timestamps based on status
    if (status === 'confirmed') {
      // Add confirmed_at if needed
    }
    if (status === 'in_progress') {
      updateData.started_at = new Date().toISOString();
    }
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
    
    const updatedBooking = await bookingsRepo.update(bookingId, updateData);
    
    // ✅ SQL: Update customer stats if completed
    if (status === 'completed') {
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(booking.customer_id);
      if (customer) {
        await customersRepo.update(booking.customer_id, {
          // Note: completed_bookings and active_bookings may need to be calculated from bookings table
        });
      }
    }
    
    // ✅ SQL: Create notification
    const notificationMessages: Record<string, string> = {
      confirmed: 'Your booking has been confirmed',
      in_progress: 'Your service has started',
      completed: 'Your service has been completed. Please rate your experience'
    };
    
    if (notificationMessages[status]) {
      await createNotification({
        userId: booking.customer_id,
        userType: 'customer',
        type: status === 'confirmed' ? 'booking_confirmed' : 
              status === 'in_progress' ? 'service_started' : 'service_completed',
        title: 'Booking Update',
        message: notificationMessages[status],
        actionType: 'view_booking',
        actionData: { bookingId }
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
    
    // ✅ SQL: Get booking first
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    // ✅ SQL: Update booking status
    const newStatus = cancelledBy === 'customer' ? 'cancelled_by_customer' : 'cancelled_by_vendor';
    const updatedBooking = await bookingsRepo.update(bookingId, {
      status: newStatus,
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
    });
    
    // ✅ FIX: Process refund automatically (call refund endpoint)
    // Note: Refund processing should be handled by booking-lifecycle-management endpoints
    // For now, we'll update the booking and let the refund be processed separately
    
    // ✅ SQL: Create notification
    const targetUser = cancelledBy === 'customer' ? booking.vendor_id : booking.customer_id;
    const targetType = cancelledBy === 'customer' ? 'vendor' : 'customer';
    
    const notes = JSON.parse(booking.notes || '{}');
    await createNotification({
      userId: targetUser || '',
      userType: targetType,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `Booking for ${notes.serviceName || 'service'} has been cancelled`,
      actionType: 'view_booking',
      actionData: { bookingId }
    });
    
    return sendSuccess(c, { booking: updatedBooking });
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
    
    // ✅ SQL: Get booking first
    const bookingsRepo = getBookingsRepository();
    const booking = await bookingsRepo.findById(bookingId);
    
    if (!booking) {
      return sendError(c, 'Booking not found', 404);
    }
    
    if (booking.status !== 'completed') {
      return sendError(c, 'Can only review completed bookings', 400);
    }
    
    // ✅ SQL: Create review using repository
    const reviewsRepo = getReviewsRepository();
    const reviewObj = await reviewsRepo.create({
      booking_id: bookingId,
      customer_id: booking.customer_id,
      vendor_id: booking.vendor_id || null,
      service_id: booking.service_id,
      rating: parseInt(rating),
      comment: review || '',
      // Note: photos and aspects would need to be stored in a JSONB field if the schema supports it
      // For now, store in comment or create a separate reviews_metadata table
    });
    
    // ✅ SQL: Update booking with review info (store in notes or separate field if exists)
    // Note: Booking table may not have rating/review fields, so we store in notes
    const notes = JSON.parse(booking.notes || '{}');
    notes.rating = rating;
    notes.review = review;
    notes.reviewedAt = new Date().toISOString();
    await bookingsRepo.update(bookingId, { notes: JSON.stringify(notes) });
    
    // ✅ SQL: Update vendor rating (calculate from all reviews)
    if (booking.vendor_id) {
      const vendorReviews = await reviewsRepo.findByVendor(booking.vendor_id);
      if (vendorReviews.length > 0) {
        const avgRating = vendorReviews.reduce((sum, r) => sum + r.rating, 0) / vendorReviews.length;
        const vendorsRepo = getVendorsRepository();
        // Note: Vendor table may need rating field, or store in separate vendor_stats table
        // For now, we'll update if the field exists
        try {
          await vendorsRepo.update(booking.vendor_id, {
            // rating: avgRating, // Uncomment if vendor table has rating field
          });
        } catch (e) {
          console.warn('Could not update vendor rating:', e);
        }
      }
    }
    
    // ✅ SQL: Create notification for vendor
    if (booking.vendor_id) {
      await createNotification({
        userId: booking.vendor_id,
        userType: 'vendor',
        type: 'rating_received',
        title: 'New Review Received',
        message: `You received a ${rating}-star review`,
        actionType: 'view_booking',
        actionData: { bookingId }
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
    
    // ✅ SQL: Get notifications using repository
    const notificationsRepo = getNotificationsRepository();
    const notifications = await notificationsRepo.findByUser(userId, {
      limit: parseInt(limit as string),
      unreadOnly: unreadOnly === 'true',
    });
    
    return sendSuccess(c, { notifications });
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
    
    // ✅ SQL: Mark notification as read using repository
    const notificationsRepo = getNotificationsRepository();
    await notificationsRepo.markAsRead(notificationId);
    
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

// ✅ SQL: Create notification using repository
async function createNotification(data: {
  userId: string;
  userType: 'customer' | 'vendor';
  type: string;
  title: string;
  message: string;
  actionType?: string;
  actionData?: any;
}) {
  // ✅ SQL: Create notification using repository
  const notificationsRepo = getNotificationsRepository();
  await notificationsRepo.create({
    user_id: data.userId,
    notification_type: data.type,
    title: data.title,
    message: data.message,
    data: {
      actionType: data.actionType,
      actionData: data.actionData,
      userType: data.userType,
    },
  });
}

// ✅ SQL: Initialize default services (migrated to SQL)
async function initializeServices() {
  // ✅ SQL: Services should be created via admin catalog or migration scripts
  // This function is kept for reference but services should be in database
  const servicesRepo = getServicesRepository();
  
  // Check if services exist, if not create defaults
  const existingServices = await servicesRepo.findAll({ is_active: true });
  
  if (existingServices.length === 0) {
    // Create default services if none exist
    const defaultServices = [
      { name: 'Pet Grooming', category: 'wellness', price: 1000, is_active: true },
      { name: 'Pet Walking', category: 'essential', price: 300, is_active: true },
      { name: 'Boarding', category: 'essential', price: 1500, is_active: true },
      { name: 'Pet Training', category: 'wellness', price: 2500, is_active: true },
      { name: 'Pet Cafes', category: 'lifestyle', price: 500, is_active: true },
    ];
    
    for (const service of defaultServices) {
      try {
        await servicesRepo.create(service);
      } catch (e) {
        console.warn('Could not create default service:', e);
      }
    }
  }
}

}