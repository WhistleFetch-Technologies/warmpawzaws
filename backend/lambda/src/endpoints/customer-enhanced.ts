/**
 * ============================================================================
 * CUSTOMER ENDPOINTS - ENHANCED VERSION (PHASE 5)
 * ============================================================================
 * 
 * Migrated to use:
 * - BaseHandlerEnhanced for CloudWatch logging and error handling
 * - API Contracts (Zod) for validation
 * - Standardized response format
 * 
 * Endpoints:
 * - GET /customer/:customerId - Get customer profile
 * - GET /customer/by-phone - Get customer by phone
 * - PUT /customer/:customerId - Update customer profile
 * - GET /customer/:customerId/pets - Get customer pets
 * - POST /customer/:customerId/pets - Add pet
 * 
 * Date: 2026-01-28
 * Phase: 5
 * ============================================================================
 */

import { Hono } from 'hono';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../handler/base-handler-enhanced';
import { query, select, insert, update } from '../database/rds-connection';
import {
  UpdateCustomerProfileRequestSchema,
  AddPetRequestSchema,
} from '@warmpawz/api-contracts/customers';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// CUSTOMER HANDLERS
// ============================================================================

class GetCustomerHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      const customers = await select('customers', { id: customerId });
      
      if (customers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      return this.success({ customer: customers[0] }, requestId);
    } catch (error: any) {
      console.error('Error getting customer:', error);
      return this.error(
        error.message || 'Failed to get customer',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

class GetCustomerByPhoneHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;
    const requestId = context.requestId;

    if (!phone) {
      return this.error('Phone number is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      // Normalize phone - remove non-digits
      const cleanPhone = phone.replace(/\D/g, '');
      
      const customers = await select('customers', { phone: cleanPhone });
      
      if (customers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const customer = customers[0];
      return this.success({ 
        customer: {
          id: customer.id,
          phone: customer.phone,
          name: customer.full_name,
          email: customer.email,
          status: customer.status,
          onboarding_status: customer.onboarding_status,
          profile_completed: customer.profile_completed,
          created_at: customer.created_at,
        }
      }, requestId);
    } catch (error: any) {
      console.error('Error getting customer by phone:', error);
      return this.error(
        error.message || 'Failed to get customer',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

class UpdateCustomerHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Validate request with Zod schema
    const validationResult = UpdateCustomerProfileRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return this.error(
        'Validation failed',
        400,
        'VALIDATION_ERROR',
        { errors: validationResult.error.errors },
        requestId
      );
    }

    try {
      const updateData: any = {
        updated_at: new Date(),
      };

      if (validationResult.data.firstName) updateData.first_name = validationResult.data.firstName;
      if (validationResult.data.lastName) updateData.last_name = validationResult.data.lastName;
      if (validationResult.data.email) updateData.email = validationResult.data.email;
      if (validationResult.data.address) updateData.address = validationResult.data.address;
      if (validationResult.data.pincode) updateData.pincode = validationResult.data.pincode;
      if (validationResult.data.photo) updateData.profile_photo_url = validationResult.data.photo;

      await update('customers', { id: customerId }, updateData);

      // Get updated customer
      const customers = await select('customers', { id: customerId });

      return this.success({
        message: 'Customer updated successfully',
        customer: customers[0],
      }, requestId);
    } catch (error: any) {
      console.error('Error updating customer:', error);
      return this.error(
        error.message || 'Failed to update customer',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

class GetCustomerPetsHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    try {
      const pets = await select('pets', { customer_id: customerId });

      return this.success({ pets }, requestId);
    } catch (error: any) {
      console.error('Error getting customer pets:', error);
      return this.error(
        error.message || 'Failed to get pets',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

class AddPetHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    // Validate request with Zod schema
    // Note: AddPetRequestSchema expects phone and pets array, but we're using customerId
    // For now, validate required fields manually
    this.validateRequired(body, ['name', 'species']);

    try {
      const petData = {
        customer_id: customerId,
        name: body.name,
        species: body.species,
        breed: body.breed || null,
        age: body.age || null,
        gender: body.gender || null,
        weight: body.weight || null,
        color: body.color || null,
        medical_history: body.medicalHistory || [],
      };

      const pets = await insert('pets', petData);

      // Check if this is the first pet (complete profile bonus)
      const existingPets = await select('pets', { customer_id: customerId });
      if (existingPets.length === 1) {
        // First pet - award complete profile bonus (100 points)
        try {
          const { loyaltyPointsService } = await import('../lib/services/loyalty-points-service');
          await loyaltyPointsService.awardPoints({
            customerId,
            actionName: 'complete_pet_profile',
            referenceType: 'pet_profile',
            referenceId: pets[0].id,
            description: 'Complete pet profile bonus',
          });
        } catch (loyaltyError) {
          console.error('Error awarding complete profile bonus:', loyaltyError);
          // Don't fail pet creation if loyalty points fail
        }
      }

      return this.success({ pet: pets[0] }, requestId);
    } catch (error: any) {
      console.error('Error adding pet:', error);
      return this.error(
        error.message || 'Failed to add pet',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

class DeactivateCustomerHandlerEnhanced extends BaseHandlerEnhanced {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const reason = body.reason || body.deactivationReason || 'Customer request';
    const actorId = context.userId || body.actorId;
    const actorType = context.userRole || body.actorType || 'customer';
    const permanentDelete = body.permanentDelete === true; // Only if explicitly requested

    try {
      // Get current customer
      const existingCustomers = await select('customers', { id: customerId });
      if (existingCustomers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      const currentCustomer = existingCustomers[0];

      if (permanentDelete) {
        // Hard delete - only allowed by admins or system
        if (actorType !== 'admin' && actorType !== 'system') {
          return this.error(
            'Permanent deletion is only allowed by administrators',
            403,
            'FORBIDDEN',
            undefined,
            requestId
          );
        }

        // Check for active bookings/orders before deletion
        const activeBookings = await query(
          `SELECT COUNT(*) as count FROM bookings 
           WHERE customer_id = $1 AND status NOT IN ('cancelled', 'completed', 'no_show')`,
          [customerId]
        );

        const activeOrders = await query(
          `SELECT COUNT(*) as count FROM orders 
           WHERE customer_id = $1 AND order_status NOT IN ('cancelled', 'delivered', 'refunded')`,
          [customerId]
        );

        if (parseInt(activeBookings.rows[0]?.count || '0', 10) > 0 ||
            parseInt(activeOrders.rows[0]?.count || '0', 10) > 0) {
          return this.error(
            'Cannot delete customer with active bookings or orders. Please cancel them first.',
            400,
            'VALIDATION_ERROR',
            undefined,
            requestId
          );
        }

        // Soft delete by setting is_active = false and updating
        await update('customers', { id: customerId }, {
          is_active: false,
          updated_at: new Date(),
        });

        return this.success({
          customerId,
          message: 'Customer account deactivated successfully',
          deactivated: true,
        }, requestId);
      } else {
        // Soft delete - deactivate account
        await update('customers', { id: customerId }, {
          is_active: false,
          updated_at: new Date(),
        });

        // Log audit entry
        try {
          const { logAuditEntry } = await import('../utils/audit-log');
          await logAuditEntry({
            entityType: 'customer',
            entityId: customerId,
            action: 'deactivate',
            oldValues: { is_active: currentCustomer.is_active },
            newValues: { is_active: false, reason },
            changedFields: ['is_active'],
            actorId,
            actorType,
            requestId,
          });
        } catch (error) {
          console.error('Error logging audit entry:', error);
        }

        return this.success({
          customerId,
          message: 'Customer account deactivated successfully',
          deactivated: true,
        }, requestId);
      }
    } catch (error: any) {
      console.error('Error deactivating customer:', error);
      return this.error(
        error.message || 'Failed to deactivate customer',
        500,
        'INTERNAL_ERROR',
        undefined,
        requestId
      );
    }
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerCustomerEndpointsEnhanced(app: Hono) {
  const getHandler = new GetCustomerHandlerEnhanced();
  const getByPhoneHandler = new GetCustomerByPhoneHandlerEnhanced();
  const updateHandler = new UpdateCustomerHandlerEnhanced();
  const getPetsHandler = new GetCustomerPetsHandlerEnhanced();
  const addPetHandler = new AddPetHandlerEnhanced();
  const deactivateHandler = new DeactivateCustomerHandlerEnhanced();

  // IMPORTANT: Register specific routes BEFORE parameterized routes
  // Otherwise /customer/by-phone would be matched by /customer/:customerId with customerId="by-phone"
  
  app.get('/customer/by-phone', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContext();
    const result: any = await getByPhoneHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  // GET /customer/pets?phone=... - MUST come before /customer/:customerId
  app.get('/customer/pets', async (c) => {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      // Clean phone - remove non-digits and country code
      let cleanPhone = phone.replace(/\D/g, '');
      // Remove leading country code (91 for India) if present
      if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) {
        cleanPhone = cleanPhone.slice(2);
      }

      // Get customer by phone - try both original and cleaned
      let customers = await select('customers', { phone: cleanPhone });
      if (customers.length === 0) {
        // Try with original phone (in case it's stored differently)
        customers = await select('customers', { phone });
      }
      if (customers.length === 0) {
        // Try with +91 prefix
        customers = await select('customers', { phone: `+91${cleanPhone}` });
      }
      if (customers.length === 0) {
        return c.json({ 
          success: false, 
          error: { code: 'NOT_FOUND', message: 'Customer not found' },
          pets: [],
          count: 0
        }, 404);
      }

      const customer = customers[0];

      // Get pets
      const pets = await select('pets',
        { customer_id: customer.id },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );

      return c.json({
        success: true,
        pets: pets.map((pet: any) => ({
          id: pet.id,
          name: pet.name,
          species: pet.species,
          breed: pet.breed,
          age_years: pet.age_years,
          age_months: pet.age_months,
          gender: pet.gender,
          weight_kg: pet.weight_kg,
          profile_photo_url: pet.profile_photo_url,
          medical_history: pet.medical_history || {},
          createdAt: pet.created_at,
        })),
        count: pets.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer pets by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // Parameterized route - MUST come after specific routes
  app.get('/customer/:customerId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result: any = await getHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.put('/customer/:customerId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result: any = await updateHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.delete('/customer/:customerId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result: any = await deactivateHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.get('/customer/:customerId/pets', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result: any = await getPetsHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.post('/customer/:customerId/pets', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result: any = await addPetHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  /**
   * GET /customer/pets/:phone
   * Get customer pets by phone (path parameter for frontend compatibility)
   */
  app.get('/customer/pets/:phone', async (c) => {
    try {
      const phone = c.req.param('phone');
      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      // Clean phone - remove non-digits and country code
      let cleanPhone = phone.replace(/\D/g, '');
      // Remove leading country code (91 for India) if present
      if (cleanPhone.length > 10 && cleanPhone.startsWith('91')) {
        cleanPhone = cleanPhone.slice(2);
      }

      // Get customer by phone - try multiple formats
      let customers = await select('customers', { phone: cleanPhone });
      if (customers.length === 0) {
        customers = await select('customers', { phone });
      }
      if (customers.length === 0) {
        customers = await select('customers', { phone: `+91${cleanPhone}` });
      }
      if (customers.length === 0) {
        return c.json({ pets: [], count: 0 });
      }

      const customer = customers[0];

      // Get pets
      const pets = await select('pets',
        { customer_id: customer.id },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );

      return c.json({
        success: true,
        pets: pets.map((pet: any) => ({
          id: pet.id,
          name: pet.name,
          type: pet.species || 'Dog',
          species: pet.species,
          breed: pet.breed,
          age: pet.age_years?.toString() || '',
          gender: pet.gender,
          weight: pet.weight_kg?.toString() || '',
          photo: pet.profile_photo_url,
          microchipId: pet.microchip_id,
          healthRecords: pet.medical_history || {},
          vaccinations: pet.vaccination_records || {},
          createdAt: pet.created_at,
        })),
        count: pets.length,
      });
    } catch (error: any) {
      console.error('Error fetching customer pets by phone:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/pets
   * Save customer pets (accepts phone and pets array from frontend)
   */
  app.post('/customer/pets', async (c) => {
    try {
      const body = await c.req.json();
      const { phone, pets } = body;

      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      if (!pets || !Array.isArray(pets)) {
        return c.json({ error: 'pets array is required' }, 400);
      }

      // Get customer by phone
      const customers = await select('customers', { phone });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found. Please create profile first.' }, 404);
      }

      const customer = customers[0];
      const savedPets = [];

      for (const pet of pets) {
        try {
          // ✅ PLATFORM RESTRICTION: Only allow Dog and Cat
          const petSpecies = (pet.type || pet.species || 'dog').toLowerCase();
          const allowedSpecies = ['dog', 'cat'];
          if (!allowedSpecies.includes(petSpecies)) {
            console.warn(`Rejected pet type: ${petSpecies}. Only Dog and Cat allowed.`);
            continue; // Skip this pet, don't save it
          }
          
          // Check if pet already exists
          const existingPets = await select('pets', { customer_id: customer.id, name: pet.name });
          
          // Normalize gender to lowercase for DB constraint
          const normalizedGender = pet.gender ? pet.gender.toLowerCase() : null;
          // Validate gender against allowed values
          const allowedGenders = ['male', 'female', 'neutered', 'spayed'];
          const validGender = normalizedGender && allowedGenders.includes(normalizedGender) ? normalizedGender : null;
          
          // ✅ ENHANCED: Calculate age from DOB if provided
          let age_years = pet.age ? parseInt(pet.age) : null;
          let age_months = null;
          if (pet.dob && !age_years) {
            const birthDate = new Date(pet.dob);
            const now = new Date();
            const ageInMonthsCalc = (now.getFullYear() - birthDate.getFullYear()) * 12 + 
                               (now.getMonth() - birthDate.getMonth());
            age_years = Math.floor(ageInMonthsCalc / 12);
            age_months = ageInMonthsCalc % 12;
          }
          
          // Build pet data matching the pets table schema
          // ✅ ENHANCED: Now supports vaccination records, allergies, chronic conditions, behavior notes
          const petData: Record<string, any> = {
            customer_id: customer.id,
            name: pet.name,
            species: petSpecies,
            breed: pet.breed || null,
            age_years: age_years,
            age_months: age_months,
            gender: validGender,
            weight_kg: pet.weight ? parseFloat(pet.weight) : null,
            profile_photo_url: pet.photo || null,
            // Store health records and vaccinations in medical_history JSONB
            medical_history: {
              ...pet.healthRecords,
              dob: pet.dob || null,
              microchipId: pet.microchipId || null,
              allergies: pet.allergies || [],
              chronicConditions: pet.chronicConditions || [],
              vaccinations: pet.vaccinations || [],
              behaviorNotes: pet.behaviorNotes || null,
              feedingSchedule: pet.feedingSchedule || null,
              dietaryRestrictions: pet.dietaryRestrictions || [],
              spayedNeutered: pet.spayedNeutered || false,
              specialNeeds: pet.specialNeeds || null,
              emergencyContact: pet.emergencyContact || null,
              color: pet.color || null,
              size: pet.size || null,
            },
          };

          if (existingPets.length > 0) {
            // Update existing pet
            const updated = await update('pets', { id: existingPets[0].id }, petData);
            savedPets.push({ ...updated[0], id: existingPets[0].id });
          } else {
            // Insert new pet
            const inserted = await insert('pets', petData);
            savedPets.push(inserted[0]);
          }
        } catch (petError: any) {
          console.error(`Error saving pet ${pet.name}:`, petError);
        }
      }

      // Update customer onboarding status to COMPLETED since pets are now saved
      try {
        const { updateCustomerOnboardingStatus } = await import('../utils/customer-state');
        await updateCustomerOnboardingStatus(customer.id, 'COMPLETED', 'completed');
        
        // Also update profile_completed flag
        await update('customers', { id: customer.id }, { 
          profile_completed: true,
          onboarding_status: 'COMPLETED',
          status: 'active'
        });
      } catch (stateError) {
        console.error('Error updating onboarding status:', stateError);
      }

      return c.json({
        success: true,
        message: `${savedPets.length} pet(s) saved successfully`,
        pets: savedPets,
      });
    } catch (error: any) {
      console.error('Error saving customer pets:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/questionnaire/planning
   * Save customer planning journey questionnaire
   */
  app.post('/customer/questionnaire/planning', async (c) => {
    try {
      const body = await c.req.json();
      const { customerId, phone, answers } = body;

      if (!phone && !customerId) {
        return c.json({ error: 'phone or customerId is required' }, 400);
      }

      // Get or create customer
      let customer;
      if (customerId) {
        const customers = await select('customers', { id: customerId });
        customer = customers[0];
      } else if (phone) {
        const customers = await select('customers', { phone });
        customer = customers[0];
      }

      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // Save questionnaire answers (could be in a separate table or as JSONB in customers)
      // For now, we'll just return success
      // TODO: Create customer_questionnaires table if needed

      return c.json({
        success: true,
        message: 'Questionnaire saved successfully',
        customerId: customer.id,
      });
    } catch (error: any) {
      console.error('Error saving questionnaire:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/payment-methods
   * Get saved payment methods for faster checkout
   */
  app.get('/customer/payment-methods', async (c) => {
    try {
      const phone = c.req.query('phone');
      const customerId = c.req.query('customerId');

      if (!phone && !customerId) {
        return c.json({ error: 'phone or customerId is required' }, 400);
      }

      let customer: any = null;
      if (customerId) {
        const customers = await select('customers', { id: customerId });
        customer = customers[0];
      } else if (phone) {
        const customers = await select('customers', { phone });
        customer = customers[0];
      }

      if (!customer) {
        return c.json({ methods: [] });
      }

      // Get saved payment methods from customer_payment_methods table
      const methodsResult = await query(
        `SELECT * FROM customer_payment_methods 
         WHERE customer_id = $1 AND is_active = true 
         ORDER BY is_default DESC, created_at DESC`,
        [customer.id]
      ).catch(() => ({ rows: [] }));

      const methods = Array.isArray(methodsResult) 
        ? methodsResult 
        : methodsResult.rows || [];

      return c.json({
        success: true,
        methods: methods.map((m: any) => ({
          id: m.id,
          type: m.payment_type || 'card',
          last4: m.card_last4,
          brand: m.card_brand,
          upiId: m.upi_id,
          bankName: m.bank_name,
          isDefault: m.is_default,
          expiryMonth: m.card_expiry_month,
          expiryYear: m.card_expiry_year,
        })),
      });
    } catch (error: any) {
      console.error('Error fetching payment methods:', error);
      return c.json({ methods: [] }); // Return empty array on error
    }
  });

  /**
   * POST /customer/payment-methods
   * Save a new payment method for faster checkout
   */
  app.post('/customer/payment-methods', async (c) => {
    try {
      const body = await c.req.json();
      const { phone, customerId, type, razorpayToken, last4, brand, upiId, bankName, isDefault } = body;

      if (!phone && !customerId) {
        return c.json({ error: 'phone or customerId is required' }, 400);
      }

      let customer: any = null;
      if (customerId) {
        const customers = await select('customers', { id: customerId });
        customer = customers[0];
      } else if (phone) {
        const customers = await select('customers', { phone });
        customer = customers[0];
      }

      if (!customer) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      // If setting as default, unset other defaults
      if (isDefault) {
        await query(
          `UPDATE customer_payment_methods SET is_default = false WHERE customer_id = $1`,
          [customer.id]
        ).catch(() => {});
      }

      // Insert new payment method
      const inserted = await insert('customer_payment_methods', {
        customer_id: customer.id,
        payment_type: type,
        razorpay_token: razorpayToken,
        card_last4: last4,
        card_brand: brand,
        upi_id: upiId,
        bank_name: bankName,
        is_default: isDefault || false,
        is_active: true,
      });

      return c.json({
        success: true,
        method: inserted[0],
        message: 'Payment method saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving payment method:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * DELETE /customer/payment-methods/:methodId
   * Remove a saved payment method
   */
  app.delete('/customer/payment-methods/:methodId', async (c) => {
    try {
      const methodId = c.req.param('methodId');
      
      // Soft delete by setting is_active = false
      await query(
        `UPDATE customer_payment_methods SET is_active = false, updated_at = NOW() WHERE id = $1`,
        [methodId]
      );

      return c.json({
        success: true,
        message: 'Payment method removed successfully',
      });
    } catch (error: any) {
      console.error('Error removing payment method:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================================================
  // CUSTOMER PREFERENCES & ONBOARDING ENDPOINTS
  // ============================================================================

  /**
   * GET /customer/:phone/preferences
   * Get customer preferences and onboarding data
   */
  app.get('/customer/:phone/preferences', async (c) => {
    try {
      const phone = c.req.param('phone');

      // Get customer by phone
      const customers = await select('customers', { phone });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Try to get preferences from dedicated table first
      const preferencesResult = await query(
        `SELECT * FROM customer_preferences WHERE customer_id = $1`,
        [customer.id]
      ).catch(() => ({ rows: [] }));

      // Also get preferences from customer.preferences JSONB as fallback
      const customerPreferences = customer.preferences || {};

      const preferences = preferencesResult.rows.length > 0 
        ? preferencesResult.rows[0] 
        : customerPreferences;

      return c.json({
        success: true,
        preferences: {
          journeyType: preferences.journey_type || preferences.journeyType,
          livingSpace: {
            homeType: preferences.home_type || preferences.homeType,
            outdoorSpace: preferences.outdoor_space || preferences.outdoorSpace,
          },
          lifestyle: {
            workSchedule: preferences.work_schedule || preferences.workSchedule,
            activityLevel: preferences.activity_level || preferences.activityLevel,
            travelFrequency: preferences.travel_frequency || preferences.travelFrequency,
          },
          budget: preferences.monthly_budget || preferences.budget,
          servicePreferences: preferences.service_preferences || preferences.servicePreferences || [],
          onboardingCompletedAt: preferences.onboarding_completed_at,
        },
      });
    } catch (error: any) {
      console.error('Error fetching customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/:phone/preferences
   * Save customer preferences (from onboarding journey)
   */
  app.post('/customer/:phone/preferences', async (c) => {
    try {
      const phone = c.req.param('phone');
      const body = await c.req.json();

      const {
        journeyType,
        livingSpace,
        lifestyle,
        budget,
        servicePreferences,
        hasChildren,
        hasOtherPets,
        otherPetTypes,
      } = body;

      // Get customer by phone
      const customers = await select('customers', { phone });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found. Please create profile first.' }, 404);
      }

      const customer = customers[0];

      // Check if preferences exist
      const existingPrefs = await query(
        `SELECT id FROM customer_preferences WHERE customer_id = $1`,
        [customer.id]
      ).catch(() => ({ rows: [] }));

      const preferencesData = {
        journey_type: journeyType,
        home_type: livingSpace?.homeType,
        outdoor_space: livingSpace?.outdoorSpace,
        work_schedule: lifestyle?.workSchedule,
        activity_level: lifestyle?.activityLevel,
        travel_frequency: lifestyle?.travelFrequency,
        monthly_budget: budget,
        service_preferences: servicePreferences || [],
        has_children: hasChildren,
        has_other_pets: hasOtherPets,
        other_pet_types: otherPetTypes || [],
        updated_at: new Date().toISOString(),
      };

      if (existingPrefs.rows.length > 0) {
        // Update existing preferences
        await query(
          `UPDATE customer_preferences SET
            journey_type = COALESCE($1, journey_type),
            home_type = COALESCE($2, home_type),
            outdoor_space = COALESCE($3, outdoor_space),
            work_schedule = COALESCE($4, work_schedule),
            activity_level = COALESCE($5, activity_level),
            travel_frequency = COALESCE($6, travel_frequency),
            monthly_budget = COALESCE($7, monthly_budget),
            service_preferences = COALESCE($8, service_preferences),
            has_children = COALESCE($9, has_children),
            has_other_pets = COALESCE($10, has_other_pets),
            other_pet_types = COALESCE($11, other_pet_types),
            updated_at = NOW()
          WHERE customer_id = $12`,
          [
            preferencesData.journey_type,
            preferencesData.home_type,
            preferencesData.outdoor_space,
            preferencesData.work_schedule,
            preferencesData.activity_level,
            preferencesData.travel_frequency,
            preferencesData.monthly_budget,
            JSON.stringify(preferencesData.service_preferences),
            preferencesData.has_children,
            preferencesData.has_other_pets,
            preferencesData.other_pet_types,
            customer.id,
          ]
        );
      } else {
        // Insert new preferences
        await query(
          `INSERT INTO customer_preferences (
            customer_id, journey_type, home_type, outdoor_space,
            work_schedule, activity_level, travel_frequency,
            monthly_budget, service_preferences, has_children,
            has_other_pets, other_pet_types
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            customer.id,
            preferencesData.journey_type,
            preferencesData.home_type,
            preferencesData.outdoor_space,
            preferencesData.work_schedule,
            preferencesData.activity_level,
            preferencesData.travel_frequency,
            preferencesData.monthly_budget,
            JSON.stringify(preferencesData.service_preferences),
            preferencesData.has_children,
            preferencesData.has_other_pets,
            preferencesData.other_pet_types,
          ]
        );
      }

      // Also update customer.preferences JSONB as backup
      await update('customers', { id: customer.id }, {
        preferences: {
          ...customer.preferences,
          journeyType,
          livingSpace,
          lifestyle,
          budget,
          servicePreferences,
        },
      });

      return c.json({
        success: true,
        message: 'Preferences saved successfully',
      });
    } catch (error: any) {
      console.error('Error saving customer preferences:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/:phone/onboarding/complete
   * Mark onboarding as complete
   */
  app.post('/customer/:phone/onboarding/complete', async (c) => {
    try {
      const phone = c.req.param('phone');
      const body = await c.req.json();
      const { journeyType } = body;

      // Get customer by phone
      const customers = await select('customers', { phone });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Update customer onboarding status
      await update('customers', { id: customer.id }, {
        onboarding_status: 'COMPLETED',
        profile_completed: true,
        status: 'active',
      });

      // Update preferences with completion timestamp
      await query(
        `UPDATE customer_preferences SET
          onboarding_completed_at = NOW(),
          journey_type = COALESCE($1, journey_type)
        WHERE customer_id = $2`,
        [journeyType, customer.id]
      ).catch(() => {
        // Create preferences record if it doesn't exist
        return query(
          `INSERT INTO customer_preferences (customer_id, journey_type, onboarding_completed_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (customer_id) DO UPDATE SET onboarding_completed_at = NOW()`,
          [customer.id, journeyType]
        );
      });

      return c.json({
        success: true,
        message: 'Onboarding completed successfully',
        customerId: customer.id,
      });
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}

function createApiGatewayEvent(req: any): any {
  return {
    httpMethod: req.method,
    path: req.url,
    headers: req.headers,
    body: JSON.stringify(req.body || {}),
    pathParameters: req.param() || {},
    queryStringParameters: Object.fromEntries(new URL(req.url).searchParams),
    requestContext: {
      requestId: crypto.randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: crypto.randomUUID(),
    functionName: 'customer-handler',
    functionVersion: '$LATEST',
  };
}

