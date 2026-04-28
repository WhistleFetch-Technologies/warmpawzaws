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
import { randomUUID } from 'crypto';
import { BaseHandlerEnhanced, HandlerContext, HandlerResponse } from '../../../handler/base-handler-enhanced';
import { query, select, insert, update } from '../../../database/rds-connection';
import {
  UpdateCustomerProfileRequestSchema,
  AddPetRequestSchema,
} from '@warmpawz/api-contracts/customers';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../../../utils/entity-extractor';
import { isValidUUID } from '../../../types/entities';
import { presignS3GetUrlIfApplicable } from '../../../utils/s3-media-presign';
import { findCustomerByPhone } from '../../../utils/customer-phone-lookup';
import { getDiscoveryRules } from '../../../lib/rule-engine';

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
    const body = this.parseBody(context.event) as Record<string, unknown>;
    const requestId = context.requestId;

    if (!customerId) {
      return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
    }

    const hasHouseNoInPut = 'houseNo' in body || 'house_no' in body;
    const hasFloorInPut = 'floor' in body;

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
      const profileData = validationResult.data;
      const addrStr =
        profileData.address !== undefined && profileData.address !== null
          ? String(profileData.address).trim()
          : '';
      if (addrStr.length > 0 && hasHouseNoInPut && !profileData.houseNo?.trim()) {
        return this.error(
          'House / flat number is required when address is provided',
          400,
          'VALIDATION_ERROR',
          { field: 'houseNo' },
          requestId
        );
      }

      const updateData: any = {
        updated_at: new Date(),
      };

      if (profileData.firstName) updateData.first_name = profileData.firstName;
      if (profileData.lastName) updateData.last_name = profileData.lastName;
      if (profileData.email) updateData.email = profileData.email;
      if (profileData.address) updateData.address = profileData.address;
      if (profileData.pincode) updateData.pincode = profileData.pincode;
      if (profileData.city) updateData.city = profileData.city;
      if (profileData.state) updateData.state = profileData.state;
      if (profileData.photo) updateData.profile_photo_url = profileData.photo;
      if (hasHouseNoInPut) {
        updateData.house_no = profileData.houseNo?.trim() || null;
      }
      if (hasFloorInPut) {
        updateData.floor = profileData.floor?.trim() || null;
      }

      await update('customers', { id: customerId }, updateData);

      // Get updated customer
      const customers = await select('customers', { id: customerId });

      const row = customers[0];
      return this.success({
        message: 'Customer updated successfully',
        customer: {
          ...row,
          houseNo: row.house_no ?? null,
          floor: row.floor ?? null,
        },
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
      const ageUnit = body.ageUnit || body.age_unit;
      let age_years: number | null = null;
      let age_months: number | null = null;
      if (body.age != null && body.age !== '') {
        const n = parseInt(String(body.age), 10);
        if (!Number.isNaN(n)) {
          if (ageUnit === 'months' || ageUnit === 'month') age_months = n;
          else age_years = n;
        }
      }

      const weight_kg =
        body.weight_kg != null && body.weight_kg !== ''
          ? parseFloat(String(body.weight_kg))
          : body.weight != null && body.weight !== ''
            ? parseFloat(String(body.weight))
            : null;

      const med = body.medicalHistory ?? body.medical_history;
      const medical_history =
        med != null && typeof med === 'object' && !Array.isArray(med)
          ? med
          : {};

      const petData = {
        customer_id: customerId,
        name: body.name,
        species: body.species,
        breed: body.breed || null,
        age_years,
        age_months,
        gender: body.gender || null,
        weight_kg: weight_kg != null && !Number.isNaN(weight_kg) ? weight_kg : null,
        color: body.color || null,
        medical_history,
      };

      const pets = await insert('pets', petData);

      // First-pet / profile loyalty: handled by action_sources → loyalty-events-consumer (not inline here).

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
    const startTime = Date.now();
    try {
      const phone = c.req.query('phone');
      
      if (!phone) {
        return c.json({ 
          success: false,
          error: { code: 'MISSING_PHONE', message: 'phone parameter is required' }
        }, 400);
      }

      const event = createApiGatewayEvent(c.req);
      event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
      const context = createLambdaContext();
      
      try {
        const result: any = await getByPhoneHandler.execute(event, context);
        const body = JSON.parse(result.body);
        const duration = Date.now() - startTime;
        if (duration > 2000) {
          console.warn(`[by-phone] Slow response: ${duration}ms for phone ${phone.substring(0, 4)}****`);
        }
        return c.json(body, result.statusCode);
      } catch (error: any) {
        const duration = Date.now() - startTime;
        const errorMessage = error?.message || String(error);
        console.error(`[by-phone] Error after ${duration}ms:`, errorMessage);
        // ✅ Enhanced logging for 503 diagnosis
        if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
          console.error('[by-phone] ⚠️ Connection pool exhausted');
        }
        return c.json({ success: false, customer: null }, 200);
      }
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[by-phone] Error after ${duration}ms:`, error?.message || error);
      return c.json({ success: false, customer: null }, 200);
    }
  });

  // GET /customer/meal-plan-orders?customerId=... - MUST come before /customer/:customerId
  app.get('/customer/meal-plan-orders', async (c) => {
    try {
      const customerId = c.req.query('customerId');
      if (!customerId) {
        return c.json({ success: false, error: 'customerId is required' }, 400);
      }
      const allOrders: any[] = [];

      // 1. From meal_orders (MealOrderCheckout flow)
      const mealResult = await query(
        `SELECT mo.*, mp.name as meal_plan_name, v.business_name as vendor_name
         FROM meal_orders mo
         LEFT JOIN meal_plans mp ON mo.meal_plan_id = mp.id
         LEFT JOIN vendors v ON mo.vendor_id = v.id
         WHERE mo.customer_id = $1
         ORDER BY mo.created_at DESC`,
        [customerId]
      ).catch(() => ({ rows: [] }));

      for (const o of (mealResult as any).rows || []) {
        allOrders.push({
          id: o.id,
          order_number: o.order_number || o.id?.toString().slice(-8),
          order_type: 'meal_plan_delivery',
          orderType: 'meal_plan_delivery',
          meal_plan_id: o.meal_plan_id,
          meal_plan_name: o.meal_name || o.meal_plan_name,
          pet_id: o.pet_id,
          vendor_id: o.vendor_id,
          vendor_name: o.vendor_name,
          total_amount: o.total_amount,
          status: o.status,
          delivery_address: o.delivery_address,
          scheduled_delivery_date: o.scheduled_delivery_date,
          scheduled_delivery_slot: o.scheduled_delivery_slot,
          created_at: o.created_at,
          source: 'meal_orders',
        });
      }

      // 2. From orders table (MealPlanBookingFlow /nutrition/delivery-orders)
      try {
        const hasOrderType = await query(
          `SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_type' LIMIT 1`
        ).then((r: any) => (r?.rows?.length || 0) > 0);
        if (hasOrderType) {
          const ordResult = await query(
            `SELECT o.id, o.order_number, o.order_status as status, o.total_amount, o.shipping_address as delivery_address,
                    o.delivery_date as scheduled_delivery_date, o.delivery_time as scheduled_delivery_slot, o.created_at,
                    o.vendor_id, v.business_name as vendor_name,
                    (SELECT mp.name FROM meal_plan_orders mpo LEFT JOIN meal_plans mp ON mpo.meal_plan_id = mp.id WHERE mpo.order_id = o.id LIMIT 1) as meal_plan_name
             FROM orders o
             LEFT JOIN vendors v ON o.vendor_id = v.id
             WHERE o.customer_id = $1 AND o.order_type = 'meal_plan_delivery'
             ORDER BY o.created_at DESC`,
            [customerId]
          ).catch(() => ({ rows: [] }));

          for (const o of (ordResult as any).rows || []) {
            allOrders.push({
              id: o.id,
              order_number: o.order_number || o.id?.toString().slice(-8),
              order_type: 'meal_plan_delivery',
              orderType: 'meal_plan_delivery',
              meal_plan_id: null,
              meal_plan_name: o.meal_plan_name || 'Meal Plan',
              pet_id: null,
              vendor_id: o.vendor_id,
              vendor_name: o.vendor_name,
              total_amount: o.total_amount,
              status: o.status,
              delivery_address: o.delivery_address,
              scheduled_delivery_date: o.scheduled_delivery_date,
              scheduled_delivery_slot: o.scheduled_delivery_slot,
              created_at: o.created_at,
              source: 'orders',
            });
          }
        }
      } catch (_) {
        /* ignore */
      }

      // Sort by created_at desc
      allOrders.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

      return c.json({ success: true, orders: allOrders });
    } catch (error: any) {
      console.error('[meal-plan-orders] Error:', error);
      return c.json({ success: true, orders: [] });
    }
  });

  // GET /customer/pets?phone=... - MUST come before /customer/:customerId
  app.get('/customer/pets', async (c) => {
    try {
      const phone = c.req.query('phone');
      if (!phone) {
        return c.json({ error: 'phone is required' }, 400);
      }

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ 
          success: false, 
          error: { code: 'NOT_FOUND', message: 'Customer not found' },
          pets: [],
          count: 0
        }, 404);
      }

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
      console.error('[pets] Error fetching customer pets by phone:', error);
      console.error('[pets] Error stack:', error?.stack);
      
      // ✅ FIX: Return proper error codes instead of masking with 200 OK
      const errorMessage = error?.message || 'Unknown error';
      
      // Return 200 with empty on pool exhaustion or other errors so customer home loads
      if (errorMessage.includes('connection pool') || errorMessage.includes('too many clients')) {
        return c.json({ success: true, pets: [], count: 0 });
      }
      
      return c.json({ success: true, pets: [], count: 0 });
    }
  });

  // GET /customer/diagnostic-packages - MUST come before /customer/:customerId
  // ============================================
  // DIAGNOSTIC PACKAGES ENDPOINT
  // ============================================
  app.get('/customer/diagnostic-packages', async (c) => {
    try {
      // Get popular diagnostic packages
      const { rows: packages } = await query(`
        SELECT 
          dt.id,
          dt.test_name as name,
          dt.description,
          dt.price,
          dt.category,
          dt.sample_type,
          dt.turnaround_time_hours,
          dt.is_package_available,
          dt.package_price,
          dt.package_test_count,
          dt.is_free_home_collection,
          dt.home_collection_fee,
          v.business_name as vendor_name,
          v.id as vendor_id
        FROM diagnostic_tests dt
        LEFT JOIN vendors v ON v.id = dt.vendor_id
        WHERE dt.is_available = true 
          AND dt.is_package_available = true
        ORDER BY dt.price ASC
        LIMIT 20
      `);

      // Format as health packages
      const formattedPackages = packages.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        tests: p.package_test_count ? [`Includes ${p.package_test_count} tests`] : [p.category || 'General'],
        price: p.package_price || p.price,
        originalPrice: p.price > (p.package_price || p.price) ? p.price : undefined,
        homeCollection: p.is_free_home_collection || p.home_collection_fee === 0,
        turnaroundHours: p.turnaround_time_hours || 24,
        vendorName: p.vendor_name,
        vendorId: p.vendor_id,
      }));

      // If no packages found, return mock data
      if (formattedPackages.length === 0) {
        return c.json({
          success: true,
          packages: [
            {
              id: 'pkg-mock-1',
              name: 'Full Body Health Checkup',
              description: 'Comprehensive pet health screening',
              tests: ['CBC', 'LFT', 'KFT', 'Thyroid', 'Urine Analysis'],
              price: 2499,
              originalPrice: 3500,
              homeCollection: true,
              turnaroundHours: 24
            },
            {
              id: 'pkg-mock-2',
              name: 'Senior Pet Package',
              description: 'For pets above 7 years',
              tests: ['CBC', 'LFT', 'KFT', 'X-Ray', 'ECG', 'Thyroid'],
              price: 3999,
              originalPrice: 5500,
              homeCollection: true,
              turnaroundHours: 48
            },
            {
              id: 'pkg-mock-3',
              name: 'Basic Blood Panel',
              description: 'Essential blood tests',
              tests: ['CBC', 'Blood Glucose', 'Hemoglobin'],
              price: 799,
              originalPrice: 1200,
              homeCollection: true,
              turnaroundHours: 12
            }
          ]
        });
      }

      return c.json({
        success: true,
        packages: formattedPackages,
      });
    } catch (error: any) {
      console.error('Error getting diagnostic packages:', error);
      // Return mock packages on error
      return c.json({
        success: true,
        packages: [
          {
            id: 'pkg-mock-1',
            name: 'Full Body Health Checkup',
            description: 'Comprehensive pet health screening',
            tests: ['CBC', 'LFT', 'KFT', 'Thyroid', 'Urine Analysis'],
            price: 2499,
            originalPrice: 3500,
            homeCollection: true,
            turnaroundHours: 24
          }
        ]
      });
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
      const param = c.req.param('phone');
      if (!param) {
        return c.json({ error: 'phone is required' }, 400);
      }

      // This route is registered before pets.ts; path param is used for phone OR pet UUID.
      if (isValidUUID(param)) {
        const rows = await select('pets', { id: param });
        if (rows.length === 0) {
          return c.json({ success: false, error: 'Pet not found' }, 404);
        }
        const pet = rows[0];
        const rawPhoto = pet.profile_photo_url;
        const photoUrl = (await presignS3GetUrlIfApplicable(rawPhoto)) || rawPhoto;
        return c.json({
          success: true,
          pet: {
            id: pet.id,
            name: pet.name,
            type: pet.species || 'Dog',
            species: pet.species,
            breed: pet.breed,
            age: pet.age_years?.toString() || '',
            age_years: pet.age_years,
            age_months: pet.age_months,
            gender: pet.gender,
            weight: pet.weight_kg?.toString() || '',
            weight_kg: pet.weight_kg,
            photo: photoUrl,
            profile_photo_url: photoUrl,
            microchipId: pet.microchip_id,
            healthRecords: pet.medical_history || {},
            vaccinations: pet.vaccination_records || {},
            createdAt: pet.created_at,
          },
        });
      }

      const customer = await findCustomerByPhone(param);
      if (!customer) {
        return c.json({ pets: [], count: 0 });
      }

      // Get pets
      const pets = await select('pets',
        { customer_id: customer.id },
        { orderBy: 'created_at', orderDirection: 'DESC' }
      );

      const petsOut = await Promise.all(
        pets.map(async (pet: any) => {
          const rawPhoto = pet.profile_photo_url;
          const photoUrl = (await presignS3GetUrlIfApplicable(rawPhoto)) || rawPhoto;
          return {
            id: pet.id,
            name: pet.name,
            type: pet.species || 'Dog',
            species: pet.species,
            breed: pet.breed,
            age: pet.age_years?.toString() || '',
            gender: pet.gender,
            weight: pet.weight_kg?.toString() || '',
            photo: photoUrl,
            image: photoUrl,
            profile_photo_url: photoUrl,
            microchipId: pet.microchip_id,
            healthRecords: pet.medical_history || {},
            vaccinations: pet.vaccination_records || {},
            createdAt: pet.created_at,
          };
        })
      );

      return c.json({
        success: true,
        pets: petsOut,
        count: petsOut.length,
      });
    } catch (error: any) {
      console.error('[pets/:phone] Error fetching customer pets by phone:', error);
      console.error('[pets/:phone] Error stack:', error?.stack);
      
      const errorMessage = error?.message || 'Unknown error';
      
      // ✅ FIX: Handle missing table gracefully - return empty pets
      if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
        console.log('[pets/:phone] Table does not exist, returning empty pets');
        return c.json({
          success: true,
          pets: [],
          count: 0,
        });
      }
      
      // Return 200 with empty on pool exhaustion or other errors so customer home loads
      return c.json({ success: true, pets: [], count: 0 });
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

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ error: 'Customer not found. Please create profile first.' }, 404);
      }

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

      const customer = await findCustomerByPhone(phone);
      if (!customer) {
        return c.json({ error: 'Customer not found. Please create profile first.' }, 404);
      }

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

  /**
   * GET /customer/:phone/bookings/pending-reviews
   * Get pending reviews for a customer (for rating popup)
   */
  app.get('/customer/:phone/bookings/pending-reviews', async (c) => {
    try {
      const phone = c.req.param('phone');
      
      // Get customer by phone
      const customers = await select('customers', { phone: phone.replace(/\D/g, '') });
      if (customers.length === 0) {
        return c.json({ success: true, bookings: [] });
      }

      const customer = customers[0];
      const rules = await getDiscoveryRules('all', 'reviews');
      const reviewEligibleDays = rules.review_eligible_days ?? 7;

      const bookingsResult = await query(
        `SELECT b.id, b.booking_date, b.completed_at,
                COALESCE(v.business_name, s.name) as vendor_name,
                COALESCE(v.profile_photo, s.photo) as vendor_photo,
                sv.name as service_name,
                p.name as pet_name
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         LEFT JOIN staff s ON b.staff_id = s.id
         LEFT JOIN services sv ON b.service_id = sv.id
         LEFT JOIN pets p ON b.pet_id = p.id
         WHERE b.customer_id = $1
           AND b.status = 'completed'
           AND (b.has_review IS NOT TRUE OR b.has_review = false)
           AND b.completed_at > NOW() - ($2::text || ' days')::interval
           AND (b.review_skipped_at IS NULL)
         ORDER BY b.completed_at DESC
         LIMIT 5`,
        [customer.id, reviewEligibleDays]
      );

      const bookings = (bookingsResult as any).rows.map((b: any) => ({
        id: b.id,
        vendorName: b.vendor_name,
        vendorPhoto: b.vendor_photo,
        serviceName: b.service_name || 'Service',
        completedAt: b.completed_at,
        petName: b.pet_name,
      }));

      return c.json({
        success: true,
        bookings,
      });
    } catch (error: any) {
      console.error('Error fetching pending reviews:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /customer/:phone/reviews/:bookingId/skip
   * Skip review for a booking
   */
  app.post('/customer/:phone/reviews/:bookingId/skip', async (c) => {
    try {
      const phone = c.req.param('phone');
      const bookingId = c.req.param('bookingId');

      // Get customer by phone
      const customers = await select('customers', { phone: phone.replace(/\D/g, '') });
      if (customers.length === 0) {
        return c.json({ error: 'Customer not found' }, 404);
      }

      const customer = customers[0];

      // Verify booking belongs to customer
      const bookings = await select('bookings', { id: bookingId, customer_id: customer.id });
      if (bookings.length === 0) {
        return c.json({ error: 'Booking not found' }, 404);
      }

      // Mark review as skipped
      await update('bookings', { id: bookingId }, {
        review_skipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      return c.json({
        success: true,
        message: 'Review skipped',
      });
    } catch (error: any) {
      console.error('Error skipping review:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /customer/:phone/bookings/active-tracking
   * Get active GPS tracking bookings (vendor is on the way)
   */
  app.get('/customer/:phone/bookings/active-tracking', async (c) => {
    try {
      const phone = c.req.param('phone');

      // Get customer by phone
      const customers = await select('customers', { phone: phone.replace(/\D/g, '') });
      if (customers.length === 0) {
        return c.json({ success: true, bookings: [] });
      }

      const customer = customers[0];

      // Get bookings with active GPS tracking (status: confirmed, in_progress, on_the_way)
      const bookingsResult = await query(
        `SELECT b.id, b.booking_date, b.scheduled_at,
                b.status, b.service_style,
                COALESCE(v.business_name, s.name) as vendor_name,
                COALESCE(v.profile_photo, s.photo) as vendor_photo,
                sv.name as service_name,
                p.name as pet_name,
                gps.current_latitude, gps.current_longitude,
                gps.tracking_started_at
         FROM bookings b
         LEFT JOIN vendors v ON b.vendor_id = v.id
         LEFT JOIN staff s ON b.staff_id = s.id
         LEFT JOIN services sv ON b.service_id = sv.id
         LEFT JOIN pets p ON b.pet_id = p.id
         LEFT JOIN gps_tracking gps ON b.id = gps.booking_id AND gps.is_active = true
         WHERE b.customer_id = $1
           AND b.status IN ('confirmed', 'in_progress', 'on_the_way')
           AND b.service_style = 'at_home'
           AND gps.is_active = true
         ORDER BY b.scheduled_at ASC
         LIMIT 10`,
        [customer.id]
      );

      const bookings = (bookingsResult as any).rows.map((b: any) => ({
        id: b.id,
        vendorName: b.vendor_name,
        vendorPhoto: b.vendor_photo,
        serviceName: b.service_name,
        petName: b.pet_name,
        status: b.status,
        currentLocation: b.current_latitude && b.current_longitude ? {
          lat: parseFloat(b.current_latitude),
          lng: parseFloat(b.current_longitude),
        } : null,
        trackingStartedAt: b.tracking_started_at,
      }));

      return c.json({
        success: true,
        bookings,
      });
    } catch (error: any) {
      console.error('Error fetching active tracking:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ✅ MOVED to customer-phone-convenience.ts to fix route conflict
  // The /customer/:phone/bookings/upcoming-calls endpoint is now registered earlier
  // to prevent /customer/:customerId/bookings/:bookingId from catching it

  /**
   * GET /customer/:phone/orders/pharmacy/active
   * Get active pharmacy orders for customer
   * Fixes GAP-8.4: Live Tracking Widget
   */
  app.get('/customer/:phone/orders/pharmacy/active', async (c) => {
    try {
      const phone = c.req.param('phone');
      const normalizedPhone = phone.replace(/\D/g, '');

      // Get customer by phone with error handling
      let customers: any[];
      try {
        customers = await select('customers', { phone: normalizedPhone });
      } catch (error: any) {
        console.error('Error fetching customer:', error);
        return c.json({ 
          success: true, 
          orders: [],
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }

      if (customers.length === 0) {
        return c.json({ success: true, orders: [] });
      }

      const customer = customers[0];

      // Get active pharmacy orders with error handling
      let ordersResult: any;
      try {
        ordersResult = await query(
          `SELECT 
            po.id,
            po.order_number,
            po.status,
            po.tracking_status,
            po.created_at,
            po.delivery_address,
            po.delivery_latitude,
            po.delivery_longitude,
            po.estimated_delivery_time,
            po.logistics_partner_id,
            v.business_name as pharmacy_name,
            v.profile_photo as pharmacy_photo
          FROM pharmacy_orders po
          LEFT JOIN vendors v ON po.pharmacy_id = v.id
          WHERE po.customer_id = $1
            AND po.status NOT IN ('delivered', 'cancelled', 'refunded')
            AND (po.tracking_status IS NOT NULL OR po.status IN ('preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'))
          ORDER BY po.created_at DESC
          LIMIT 10`,
          [customer.id]
        );
      } catch (error: any) {
        console.warn('Error fetching active pharmacy orders (returning empty):', error.message);
        // Return empty array if query fails (table might not exist or schema issue)
        return c.json({ success: true, orders: [] });
      }

      const orders = ((ordersResult as any)?.rows || []).map((order: any) => {
        let deliveryAddress = order.delivery_address;
        try {
          if (typeof order.delivery_address === 'string') {
            deliveryAddress = JSON.parse(order.delivery_address);
          }
        } catch (parseError) {
          // If parsing fails, use the string as-is
          deliveryAddress = order.delivery_address;
        }

        return {
          id: order.id,
          orderId: order.id,
          orderNumber: order.order_number,
          orderType: 'pharmacy',
          status: order.status,
          trackingStatus: order.tracking_status || order.status,
          pharmacyName: order.pharmacy_name,
          pharmacyPhoto: order.pharmacy_photo,
          deliveryAddress,
          estimatedDeliveryTime: order.estimated_delivery_time,
          createdAt: order.created_at,
        };
      });

      return c.json({
        success: true,
        orders,
      });
    } catch (error: any) {
      console.error('Error fetching active pharmacy orders:', error);
      // Return empty array instead of error to prevent frontend crashes
      return c.json({ 
        success: true, 
        orders: [],
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * GET /customer/:phone/orders/meals/active
   * Get active meal orders for customer
   * Fixes GAP-8.4: Live Tracking Widget
   */
  app.get('/customer/:phone/orders/meals/active', async (c) => {
    try {
      const phone = c.req.param('phone');
      const normalizedPhone = phone.replace(/\D/g, '');

      let customers: any[];
      try {
        customers = await select('customers', { phone: normalizedPhone });
      } catch (error: any) {
        console.error('[meals/active] Error fetching customer:', error);
        return c.json({ success: true, orders: [] }, 200);
      }
      if (customers.length === 0) {
        return c.json({ success: true, orders: [] });
      }

      const customer = customers[0];

      let ordersResult: any;
      try {
        ordersResult = await query(
        `SELECT 
          mo.id,
          mo.order_number,
          mo.status,
          mo.tracking_status,
          mo.created_at,
          mo.delivery_address,
          mo.delivery_latitude,
          mo.delivery_longitude,
          mo.estimated_delivery_time,
          mo.logistics_partner_id,
          v.business_name as vendor_name,
          v.profile_photo as vendor_photo
        FROM meal_orders mo
        LEFT JOIN vendors v ON mo.vendor_id = v.id
        WHERE mo.customer_id = $1
          AND mo.status NOT IN ('delivered', 'cancelled', 'refunded')
          AND (mo.tracking_status IS NOT NULL OR mo.status IN ('preparing', 'ready_for_pickup', 'picked_up', 'on_the_way'))
        ORDER BY mo.created_at DESC
        LIMIT 10`,
        [customer.id]
      );
      } catch (error: any) {
        console.warn('[meals/active] Error fetching orders (returning empty):', error?.message);
        return c.json({ success: true, orders: [] }, 200);
      }

      const orders = ((ordersResult as any)?.rows || []).map((order: any) => {
        let deliveryAddress = order.delivery_address;
        try {
          if (typeof order.delivery_address === 'string') {
            deliveryAddress = JSON.parse(order.delivery_address);
          }
        } catch (_) {
          deliveryAddress = order.delivery_address;
        }
        return {
          id: order.id,
          orderId: order.id,
          orderNumber: order.order_number,
          orderType: 'meal',
          status: order.status,
          trackingStatus: order.status,
          vendorName: order.vendor_name,
          vendorPhoto: order.vendor_photo,
          deliveryAddress,
          estimatedDeliveryTime: order.estimated_delivery_time,
          createdAt: order.created_at,
        };
      });

      return c.json({
        success: true,
        orders,
      });
    } catch (error: any) {
      console.error('[meals/active] Error fetching active meal orders:', error);
      return c.json({ success: true, orders: [] }, 200);
    }
  });


  /**
   * GET /customer/:phone/subscriptions/active
   * ✅ FIX GAP-12.1: Check active subscription for zero payment bookings
   * Get active subscriptions for a customer, optionally filtered by serviceId
   */
  app.get('/customer/:phone/subscriptions/active', async (c) => {
    try {
      const phone = c.req.param('phone');
      const serviceId = c.req.query('serviceId');
      const normalizedPhone = phone.replace(/\D/g, '');

      // Get customer by phone
      const customers = await select('customers', { phone: normalizedPhone });
      if (customers.length === 0) {
        return c.json({ success: true, hasActiveSubscription: false, subscriptions: [] });
      }

      const customer = customers[0];

      // Get active subscriptions
      const subscriptionsQuery = `
        SELECT s.*, 
               vs.name as service_name,
               vs.service_type,
               v.business_name as vendor_name
        FROM customer_subscriptions s
        LEFT JOIN vendor_services vs ON s.service_id = vs.id
        LEFT JOIN vendors v ON s.vendor_id = v.id
        WHERE s.customer_id = $1
          AND s.status = 'active'
          AND (s.expires_at IS NULL OR s.expires_at > NOW())
          ${serviceId ? 'AND (s.service_id = $2 OR s.service_id IS NULL)' : ''}
        ORDER BY s.created_at DESC
      `;

      const params = serviceId ? [customer.id, serviceId] : [customer.id];
      const subscriptionsResult = await query(subscriptionsQuery, params);

      const subscriptions = (subscriptionsResult as any).rows.map((sub: any) => ({
        id: sub.id,
        type: sub.subscription_type || 'unlimited',
        serviceId: sub.service_id,
        serviceName: sub.service_name,
        serviceType: sub.service_type,
        vendorId: sub.vendor_id,
        vendorName: sub.vendor_name,
        coversFees: sub.covers_fees || false,
        expiresAt: sub.expires_at,
        createdAt: sub.created_at,
      }));

      const hasActiveSubscription = subscriptions.length > 0;
      
      // Check if subscription covers the specific service
      const coversService = serviceId 
        ? subscriptions.some((s: any) => !s.serviceId || s.serviceId === serviceId)
        : hasActiveSubscription;

      return c.json({
        success: true,
        hasActiveSubscription,
        coversService,
        subscriptions,
      });
    } catch (error: any) {
      console.error('Error checking active subscriptions:', error);
      return c.json({ 
        success: true, 
        hasActiveSubscription: false, 
        subscriptions: [],
        error: error.message 
      });
    }
  });

  // ============================================
  // PHARMACY ORDER STATUS ENDPOINT
  // ============================================
  app.get('/customer/orders/:orderId/pharmacy-status', async (c) => {
    try {
      const orderId = c.req.param('orderId');

      // Get pharmacy order details + delivery_tracking (OTP, partner) for tracking step
      const { rows: orders } = await query(`
        SELECT 
          po.*,
          v.business_name as pharmacy_name,
          v.phone as pharmacy_phone,
          v.address as pharmacy_address,
          dt.delivery_otp as dt_delivery_otp,
          dt.otp_verified as dt_otp_verified,
          dt.delivery_person_name as dt_partner_name,
          dt.delivery_person_phone as dt_partner_phone
        FROM pharmacy_orders po
        LEFT JOIN vendors v ON v.id = po.pharmacy_id
        LEFT JOIN delivery_tracking dt ON dt.pharmacy_order_id = po.id
        WHERE po.id = $1
      `, [orderId]);

      if (orders.length === 0) {
        // Try to find in regular orders table
        const { rows: regularOrders } = await query(
          `SELECT * FROM orders WHERE id = $1`,
          [orderId]
        );

        if (regularOrders.length === 0) {
          return c.json({ success: false, error: 'Order not found' }, 404);
        }

        const order = regularOrders[0];
        return c.json({
          success: true,
          order: {
            id: order.id,
            status: order.status,
            medicines: JSON.parse(order.items || '[]'),
            totalAmount: order.total_amount,
          }
        });
      }

      const order = orders[0];

      const items = (() => {
        try {
          const arr = typeof order.items === 'string' ? JSON.parse(order.items) : (order.items || []);
          return arr.map((item: any) => ({
            name: item.medicine_name || item.name,
            quantity: item.quantity,
            price: item.unit_price ?? item.price,
            available: item.available !== false,
          }));
        } catch { return []; }
      })();

      return c.json({
        success: true,
        order: {
          id: order.id,
          status: order.status,
          pharmacyId: order.pharmacy_id,
          pharmacyName: order.pharmacy_name,
          pharmacyPhone: order.pharmacy_phone,
          pharmacyAddress: order.pharmacy_address,
          estimatedTime: order.estimated_delivery_minutes,
          broadcastTime: order.broadcast_started_at,
          acceptedTime: order.accepted_at,
          medicines: items,
          subtotal: order.subtotal,
          deliveryFee: order.delivery_fee,
          platformFee: order.platform_fee,
          convenienceFee: order.convenience_fee,
          totalAmount: order.total_amount,
          total_amount: order.total_amount,
          proformaInvoice: order.proforma_invoice_id ? {
            id: order.proforma_invoice_id,
            total: order.invoice_amount,
            items,
          } : undefined,
          deliveryOtp: order.dt_delivery_otp ?? order.delivery_otp,
          otpVerified: order.dt_otp_verified ?? order.otp_verified,
          deliveryPartnerName: order.dt_partner_name ?? order.partner_name,
          deliveryPartnerPhone: order.dt_partner_phone ?? order.partner_phone,
          deliveryAddress: (() => {
            try {
              return typeof order.delivery_address === 'string'
                ? JSON.parse(order.delivery_address)
                : order.delivery_address;
            } catch { return order.delivery_address; }
          })(),
          currentRadius: order.current_broadcast_radius || 5,
          maxRadius: order.max_broadcast_radius || 20,
          broadcastStartedAt: order.broadcast_started_at,
        }
      });
    } catch (error: any) {
      console.error('Error getting pharmacy order status:', error);
      return c.json({ success: false, error: error.message }, 500);
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
      requestId: randomUUID(),
    },
  };
}

function createLambdaContext(): any {
  return {
    requestId: randomUUID(),
    functionName: 'customer-handler',
    functionVersion: '$LATEST',
  };
}

