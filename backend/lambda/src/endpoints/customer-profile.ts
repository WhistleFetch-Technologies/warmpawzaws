/**
 * ============================================================================
 * CUSTOMER PROFILE MANAGEMENT ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * Handles customer profile management:
 * - Get customer profile (unified)
 * - Update customer profile
 * - Get customer preferences
 * - Update customer preferences
 * 
 * Migrated from: supabase/functions/make-server-3dd53475/customer-ecommerce-endpoints-sql.tsx
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { select, update, query, insert } from '../database/rds-connection';
import { UpdateCustomerProfileRequestSchema } from '@warmpawz/api-contracts';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

async function resolveCustomerId(identifier: string): Promise<string | null> {
  // Check if it's a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(identifier)) {
    const customers = await select('customers', { id: identifier });
    return customers.length > 0 ? customers[0].id : null;
  }

  // Check if it's a phone number
  const cleanPhone = normalizePhone(identifier);
  const customers = await select('customers', { phone: cleanPhone });
  return customers.length > 0 ? customers[0].id : null;
}

export function registerCustomerProfileEndpoints(app: Hono) {
  /**
   * GET /customer/profile/unified/:identifier
   * Get unified customer profile with wallet, addresses, bookings, orders
   */
  app.get("/customer/profile/unified/:identifier", async (c) => {
    try {
      const identifier = c.req.param('identifier');
      console.log('[profile/unified] Request received for identifier:', identifier);
      
      if (!identifier) {
        console.error('[profile/unified] No identifier provided');
        return c.json({ error: 'Identifier is required' }, 400);
      }

      // Resolve identifier (phone or customer ID)
      let customerId: string | null;
      try {
        console.log('[profile/unified] Resolving customer ID for:', identifier);
        customerId = await resolveCustomerId(identifier);
        console.log('[profile/unified] Resolved customer ID:', customerId);
      } catch (error: any) {
        console.error('[profile/unified] Error resolving customer ID:', error);
        console.error('[profile/unified] Error stack:', error?.stack);
        return c.json({ success: true, profile: null, _degraded: true, error: error?.message }, 200);
      }

      if (!customerId) {
        console.log('[profile/unified] Customer not found for identifier:', identifier);
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Get customer
      let customers: any[];
      try {
        customers = await select('customers', { id: customerId });
      } catch (error: any) {
        console.error('[profile/unified] Error fetching customer:', error);
        return c.json({ success: true, profile: null, _degraded: true }, 200);
      }

      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Fetch Wallet with better error handling
      let wallet: any = { balance: 0, currency: 'INR', status: 'active' };
      try {
        const wallets = await query(
          'SELECT * FROM customer_wallets WHERE customer_id = $1',
          [customerId]
        );
        if (wallets.rows && wallets.rows.length > 0) {
          wallet = wallets.rows[0];
        }
      } catch (error: any) {
        console.warn('Error fetching wallet (using defaults):', error.message);
        // Continue with default wallet
      }

      // Fetch Addresses with better error handling
      let addresses: any = { rows: [] };
      try {
        addresses = await query(
          'SELECT * FROM customer_addresses WHERE customer_id = $1 ORDER BY is_default DESC, created_at DESC',
          [customerId]
        );
      } catch (error: any) {
        console.warn('Error fetching addresses (using empty):', error.message);
        // Continue with empty addresses
      }

      // Fetch Bookings with better error handling
      let bookings: any = { rows: [] };
      try {
        bookings = await query(
          'SELECT * FROM bookings WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
          [customerId]
        );
      } catch (error: any) {
        console.warn('Error fetching bookings (using empty):', error.message);
        // Continue with empty bookings
      }

      // Fetch Orders with better error handling
      let orders: any = { rows: [] };
      try {
        orders = await query(
          'SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 50',
          [customerId]
        );
      } catch (error: any) {
        console.warn('Error fetching orders (using empty):', error.message);
        // Continue with empty orders
      }

      // Calculate stats safely
      const bookingsRows = bookings.rows || [];
      const ordersRows = orders.rows || [];
      const stats = {
        totalBookings: bookingsRows.length,
        activeBookings: bookingsRows.filter((b: any) => ['pending', 'confirmed', 'in_progress'].includes(b.status)).length,
        totalEcommerceOrders: ordersRows.length,
        walletBalance: parseFloat(wallet.balance || '0'),
      };

      // Get customer state (onboarding_status, profile_completed)
      const onboardingStatus = customer.onboarding_status || 'INIT';
      const profileCompleted = customer.profile_completed || false;
      const customerStatus = customer.status || 'new';

      console.log('[profile/unified] Successfully fetched profile for customer:', customerId);
      return c.json({
        success: true,
        profile: {
          id: customer.id,
          name: customer.full_name,
          email: customer.email,
          phone: customer.phone,
          status: customerStatus,
          onboarding_status: onboardingStatus,
          profile_completed: profileCompleted,
          onboardingComplete: onboardingStatus === 'COMPLETED',
          wallet: {
            balance: parseFloat(wallet.balance || '0'),
            currency: wallet.currency || 'INR',
            status: wallet.status || 'active',
          },
          addresses: (addresses.rows || []).map((addr: any) => ({
            id: addr.id,
            label: addr.address_type,
            name: addr.full_name,
            phone: addr.phone,
            addressLine1: addr.address_line1,
            addressLine2: addr.address_line2,
            city: addr.city,
            state: addr.state,
            pincode: addr.pincode,
            landmark: addr.landmark,
            isDefault: addr.is_default,
          })),
          orders: {
            all: ordersRows,
            total: ordersRows.length,
          },
          bookings: bookingsRows,
          stats,
        },
      });
    } catch (error: any) {
      console.error('[profile/unified] Error fetching unified customer profile:', error);
      console.error('[profile/unified] Error message:', error?.message);
      console.error('[profile/unified] Error stack:', error?.stack);
      console.error('[profile/unified] Error name:', error?.name);
      // Return 200 with degraded response instead of 500
      return c.json({ 
        success: true, 
        profile: null, 
        _degraded: true,
        error: error?.message || 'Unknown error'
      }, 200);
    }
  });

  /**
   * GET /customer/profile (query string phone)
   * IMPORTANT: Must be registered BEFORE /customer/profile/:identifier
   * Alias for getting profile with phone as query param
   */
  app.get("/customer/profile", async (c) => {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'Phone number is required as query param' }, 400);
      }

      const cleanPhone = normalizePhone(phone);
      let customers: any[];
      try {
        customers = await select('customers', { phone: cleanPhone });
      } catch (error: any) {
        console.error('[profile] Error fetching customer by phone:', error);
        return c.json({ success: true, profile: null, _degraded: true }, 200);
      }

      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];
      
      // Get pets for this customer with error handling
      let pets: any[] = [];
      try {
        pets = await select('pets', { customer_id: customer.id });
      } catch (error: any) {
        console.warn('Error fetching pets (using empty):', error.message);
        // Continue with empty pets array
      }
      
      return c.json({
        success: true,
        profile: {
          id: customer.id,
          phone: customer.phone,
          name: customer.full_name,
          email: customer.email,
          address: customer.address,
          pincode: customer.pincode,
          city: customer.city,
          state: customer.state,
          photo: customer.profile_photo_url,
          status: customer.status,
          onboarding_status: customer.onboarding_status,
          profile_completed: customer.profile_completed,
          createdAt: customer.created_at,
          pets: pets.map((p: any) => ({
            id: p.id,
            name: p.name,
            type: p.species,
            breed: p.breed,
            age: p.age_years,
            gender: p.gender,
          })),
        }
      });
    } catch (error: any) {
      console.error('[profile] Error fetching customer profile by query:', error);
      console.error('[profile] Error stack:', error?.stack);
      
      // ✅ FIX: Return proper error codes instead of masking with 200 OK
      const errorMessage = error?.message || 'Unknown error';
      
      if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
        return c.json({ 
          success: false, 
          error: 'Service temporarily busy. Please try again.',
          code: 'POOL_EXHAUSTED',
          profile: null,
          _degraded: true 
        }, 503);
      }
      
      return c.json({ 
        success: false, 
        error: 'Failed to fetch profile. Please try again.',
        code: 'INTERNAL_ERROR',
        profile: null,
        _degraded: true 
      }, 500);
    }
  });

  /**
   * GET /customer/profile/:identifier
   * Get customer profile (basic)
   */
  app.get("/customer/profile/:identifier", async (c) => {
    try {
      const { identifier } = c.req.param();

      const customerId = await resolveCustomerId(identifier);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Map backend fields to UI fields
      const nameParts = (customer.full_name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Use profile_photo_url directly (preferences column may not exist yet)
      const photoUrl = customer.profile_photo_url || null;

      // Extract address fields from JSONB (if address is stored as JSONB)
      // Otherwise use address as text
      let addressData: any = {};
      if (typeof customer.address === 'string') {
        // Address is stored as text, use it directly
        addressData = { street: customer.address };
      } else if (customer.address) {
        addressData = customer.address;
      }

      return c.json({
        success: true,
        profile: {
          firstName,
          lastName,
          email: customer.email || '',
          phone: customer.phone || identifier,
          address: addressData.street || '',
          pincode: addressData.pincode || '',
          photo: photoUrl || '',
        },
      });
    } catch (error: any) {
      console.error('Error fetching customer profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/profile
   * Create or update customer profile (for frontend compatibility)
   * This endpoint accepts phone in body and creates/updates profile
   */
  app.post("/customer/profile", async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      
      // Handle nested profile structure from frontend
      // Frontend sends: { phone, profile: { firstName, lastName, ... }, journeyType }
      // Backend expects: { firstName, lastName, ... }
      const rawProfilePayload = body.profile || body;
      
      // Clean the payload - remove empty strings for optional URL fields (photo)
      // and remove extra fields (phone) that aren't in the schema
      const profilePayload: Record<string, any> = {};
      if (rawProfilePayload.firstName) profilePayload.firstName = rawProfilePayload.firstName;
      if (rawProfilePayload.lastName) profilePayload.lastName = rawProfilePayload.lastName;
      if (rawProfilePayload.email) profilePayload.email = rawProfilePayload.email;
      if (rawProfilePayload.address) profilePayload.address = rawProfilePayload.address;
      if (rawProfilePayload.pincode) profilePayload.pincode = rawProfilePayload.pincode;
      if (rawProfilePayload.photo && rawProfilePayload.photo.startsWith('http')) {
        profilePayload.photo = rawProfilePayload.photo;
      }
      
      console.log('[PROFILE] Cleaned payload:', profilePayload);
      
      // Validate request with Zod schema
      const validationResult = UpdateCustomerProfileRequestSchema.safeParse(profilePayload);
      if (!validationResult.success) {
        console.error('[PROFILE] Validation failed:', validationResult.error.errors);
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              errors: validationResult.error.errors,
            },
          },
        }, 400);
      }
      
      const profileData = validationResult.data;
      
      // Get phone from body (required for POST endpoint)
      // Note: phone is not part of the validated schema, it comes from body directly
      const phone = body.phone || (body.profile as any)?.phone;
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      const cleanPhone = normalizePhone(phone);
      let customerId = await resolveCustomerId(cleanPhone);
      
      if (!customerId) {
        // Customer doesn't exist - create it (for UAT mode or when OTP verification didn't create customer)
        try {
          // Create customer identity first (same pattern as OTP verification)
          const { createOrUpdateCustomerIdentity } = await import('../utils/customer-state');
          const identityId = await createOrUpdateCustomerIdentity(cleanPhone, undefined);
          
          // Create customer record with all required fields (matching OTP verification pattern)
          const fullName = profileData.firstName && profileData.lastName 
            ? `${profileData.firstName} ${profileData.lastName}`.trim()
            : `Customer ${cleanPhone.slice(-4)}`;
          
          const newCustomer = await insert('customers', {
            phone: cleanPhone,
            full_name: fullName,
            email: profileData.email || null,
            is_active: true,
            status: 'new',
            onboarding_status: 'PHONE_VERIFIED',
            profile_completed: false,
            customer_identity_id: identityId,
            // Don't set created_at/updated_at - let database defaults handle it
          });
          
          customerId = newCustomer[0].id;
          
          console.log(`[PROFILE] Created new customer ${customerId} for phone ${cleanPhone}`);
        } catch (createError: any) {
          console.error('[PROFILE] Error creating customer:', createError);
          console.error('[PROFILE] Error details:', {
            message: createError.message,
            stack: createError.stack,
            phone: cleanPhone
          });
          return c.json({ 
            error: 'Failed to create customer. Please try again.',
            code: 'CUSTOMER_CREATION_FAILED',
            details: process.env.NODE_ENV === 'development' ? createError.message : undefined
          }, 500);
        }
      }

      // Use PUT logic to update profile
      const updateData: any = {};

      if (profileData.firstName || profileData.lastName) {
        updateData.full_name = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
      }

      if (profileData.email) {
        updateData.email = profileData.email;
      }

      if (profileData.photo) {
        // Use profile_photo_url column directly instead of storing in preferences
        updateData.profile_photo_url = profileData.photo;
      }

      const { updateProfileCompletion, updateCustomerOnboardingStatus } = await import('../utils/customer-state');
      
      const completionUpdates: any = {};
      if (profileData.firstName || profileData.lastName || profileData.email) {
        completionUpdates.basic_info = true;
      }
      if (profileData.address || profileData.pincode) {
        completionUpdates.address = true;
      }

      // Handle address - customers table has address (TEXT), pincode (TEXT), city (TEXT), state (TEXT) as separate fields
      if (profileData.address) {
        updateData.address = profileData.address;
      }
      if (profileData.pincode) {
        updateData.pincode = profileData.pincode;
      }
      if (profileData.city) {
        updateData.city = profileData.city;
      }
      if (profileData.state) {
        updateData.state = profileData.state;
      }
      if (profileData.landmark) {
        updateData.landmark = profileData.landmark;
      }

      // Ensure we're not trying to update preferences column (it may not exist yet)
      // Remove preferences from updateData if it somehow got added
      if ('preferences' in updateData) {
        delete updateData.preferences;
      }

      const updated = await update('customers', { id: customerId }, updateData);

      if (Object.keys(completionUpdates).length > 0 && customerId) {
        try {
          await updateProfileCompletion(customerId as string, completionUpdates);
          
          const customers = await select('customers', { id: customerId });
          const customer = customers[0];
          
          if (customer.onboarding_status === 'PHONE_VERIFIED' && completionUpdates.basic_info) {
            await updateCustomerOnboardingStatus(customerId as string, 'PROFILE_PENDING', 'profile');
          }
        } catch (stateError) {
          console.error('Error updating customer state:', stateError);
        }
      }

      return c.json({
        success: true,
        message: 'Profile updated successfully',
        profile: updated[0],
      });
    } catch (error: any) {
      console.error('Error updating customer profile:', error);
      
      // Check if error is about missing preferences column
      if (error.message && error.message.includes('column "preferences"')) {
        console.error('[PROFILE] Preferences column does not exist. Run migration 139_add_customers_preferences_column.sql');
        return c.json({ 
          error: 'Database schema mismatch. Please run migration 139_add_customers_preferences_column.sql',
          details: error.message 
        }, 500);
      }
      
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /customer/profile/:identifier
   * Update customer profile
   */
  app.put("/customer/profile/:identifier", async (c) => {
    try {
      const { identifier } = c.req.param();
      
      // Parse body from Hono request
      const body = await c.req.json().catch(() => ({}));
      
      // Validate request with Zod schema
      const validationResult = UpdateCustomerProfileRequestSchema.safeParse(body);
      if (!validationResult.success) {
        return c.json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              errors: validationResult.error.errors,
            },
          },
        }, 400);
      }
      
      const profileData = validationResult.data;

      const customerId = await resolveCustomerId(identifier);
      if (!customerId) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Prepare update data
      const updateData: any = {};

      if (profileData.firstName || profileData.lastName) {
        updateData.full_name = `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim();
      }

      if (profileData.email) {
        updateData.email = profileData.email;
      }

      if (profileData.photo) {
        // Use profile_photo_url column directly instead of storing in preferences
        updateData.profile_photo_url = profileData.photo;
      }

      // Update profile completion status
      const { updateProfileCompletion, updateCustomerOnboardingStatus } = await import('../utils/customer-state');
      
      const completionUpdates: any = {};
      if (profileData.firstName || profileData.lastName || profileData.email) {
        completionUpdates.basic_info = true;
      }
      if (profileData.address || profileData.pincode) {
        completionUpdates.address = true;
      }

      // Handle address - customers table has address (TEXT), pincode (TEXT), city (TEXT), state (TEXT) as separate fields
      if (profileData.address) {
        updateData.address = profileData.address;
      }
      if (profileData.pincode) {
        updateData.pincode = profileData.pincode;
      }
      if (profileData.city) {
        updateData.city = profileData.city;
      }
      if (profileData.state) {
        updateData.state = profileData.state;
      }
      if (profileData.landmark) {
        updateData.landmark = profileData.landmark;
      }

      // Ensure we're not trying to update preferences column (it may not exist yet)
      // Remove preferences from updateData if it somehow got added
      if ('preferences' in updateData) {
        delete updateData.preferences;
      }

      const updated = await update('customers', { id: customerId }, updateData);

      // Update profile completion and onboarding status
      if (Object.keys(completionUpdates).length > 0) {
        try {
          await updateProfileCompletion(customerId, completionUpdates);
          
          // Check if we should update onboarding status
          const customers = await select('customers', { id: customerId });
          const customer = customers[0];
          
          if (customer.onboarding_status === 'PHONE_VERIFIED' && completionUpdates.basic_info) {
            await updateCustomerOnboardingStatus(customerId, 'PROFILE_PENDING', 'profile');
          }
        } catch (stateError) {
          console.error('Error updating customer state:', stateError);
          // Don't fail profile update if state update fails
        }
      }

      return c.json({
        success: true,
        message: 'Profile updated successfully',
        profile: updated[0],
      });
    } catch (error: any) {
      console.error('Error updating customer profile:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/preferences
   * Get customer preferences
   */
  app.get("/customer/:customerId/preferences", async (c) => {
    try {
      const { customerId } = c.req.param();

      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const preferences = (customers[0].preferences as any) || {};

      return c.json({
        success: true,
        preferences,
      });
    } catch (error: any) {
      console.error('Error fetching customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * PUT /customer/:customerId/preferences
   * Update customer preferences
   */
  app.put("/customer/:customerId/preferences", async (c) => {
    try {
      const { customerId } = c.req.param();
      const newPreferences = await c.req.json();

      const customers = await select('customers', { id: customerId });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const existingPreferences = (customers[0].preferences as any) || {};

      const updated = await update('customers',
        { id: customerId },
        {
          preferences: {
            ...existingPreferences,
            ...newPreferences,
          },
        }
      );

      return c.json({
        success: true,
        message: 'Preferences updated successfully',
        preferences: updated[0].preferences,
      });
    } catch (error: any) {
      console.error('Error updating customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/by-phone
   * Get customer by phone number (query string format)
   */
  app.get("/customer/by-phone", async (c) => {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'Phone number is required' }, 400);
      }

      const cleanPhone = normalizePhone(phone);
      const customers = await select('customers', { phone: cleanPhone });
      
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found', customer: null }, 404);
      }

      const customer = customers[0];
      return c.json({
        success: true,
        customer: {
          id: customer.id,
          phone: customer.phone,
          name: customer.full_name,
          email: customer.email,
          status: customer.status,
          onboarding_status: customer.onboarding_status,
          profile_completed: customer.profile_completed,
          createdAt: customer.created_at,
        }
      });
    } catch (error: any) {
      console.error('Error fetching customer by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:customerId/search-history
   * Get customer's search history
   */
  app.get("/customer/:customerId/search-history", async (c) => {
    try {
      const customerId = c.req.param('customerId');
      
      // Check if customer exists
      const customer = await resolveCustomerId(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Try to get search history from preferences or a dedicated table
      const customers = await select('customers', { id: customer });
      const preferences = customers[0]?.preferences as any || {};
      const searchHistory = preferences.searchHistory || [];

      return c.json({
        success: true,
        history: searchHistory,
        count: searchHistory.length,
      });
    } catch (error: any) {
      console.error('[search-history] Error fetching search history:', error);
      return c.json({ success: true, history: [], count: 0 }, 200);
    }
  });

  /**
   * POST /customer/:customerId/search-history
   * Add to customer's search history
   */
  app.post("/customer/:customerId/search-history", async (c) => {
    try {
      const customerId = c.req.param('customerId');
      const body = await c.req.json();
      const { query: searchQuery } = body;

      if (!searchQuery) {
        return c.json({ error: 'Search query is required' }, 400);
      }

      const customer = await resolveCustomerId(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customers = await select('customers', { id: customer });
      const preferences = customers[0]?.preferences as any || {};
      let searchHistory = preferences.searchHistory || [];

      // Add to history (keep last 20)
      searchHistory = [
        { query: searchQuery, timestamp: new Date().toISOString() },
        ...searchHistory.filter((h: any) => h.query !== searchQuery)
      ].slice(0, 20);

      await update('customers', { id: customer }, {
        preferences: { ...preferences, searchHistory }
      });

      return c.json({ success: true, history: searchHistory });
    } catch (error: any) {
      console.error('Error saving search history:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/search-suggestions
   * Get search suggestions for customer
   */
  app.get("/customer/search-suggestions", async (c) => {
    try {
      const customerId = c.req.query('customerId');
      
      // Get popular services/products as suggestions
      const suggestions = [
        { type: 'service', text: 'Vet Consultation', icon: '🏥' },
        { type: 'service', text: 'Home Grooming', icon: '✂️' },
        { type: 'service', text: 'Dog Walker', icon: '🐕' },
        { type: 'service', text: 'Pet Training', icon: '🎓' },
        { type: 'product', text: 'Dog Food', icon: '🍖' },
        { type: 'product', text: 'Pet Toys', icon: '🧸' },
        { type: 'product', text: 'Grooming Kit', icon: '🛁' },
      ];

      return c.json({
        success: true,
        suggestions,
        count: suggestions.length,
      });
    } catch (error: any) {
      console.error('[search-suggestions] Error fetching suggestions:', error);
      return c.json({ success: true, suggestions: [], count: 0 }, 200);
    }
  });

  /**
   * DELETE /customer/:customerId/search-history
   * Clear customer's search history
   */
  app.delete("/customer/:customerId/search-history", async (c) => {
    try {
      const customerId = c.req.param('customerId');
      
      const customer = await resolveCustomerId(customerId);
      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customers = await select('customers', { id: customer });
      const preferences = customers[0]?.preferences as any || {};

      await update('customers', { id: customer }, {
        preferences: { ...preferences, searchHistory: [] }
      });

      return c.json({ success: true, message: 'Search history cleared' });
    } catch (error: any) {
      console.error('Error clearing search history:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

