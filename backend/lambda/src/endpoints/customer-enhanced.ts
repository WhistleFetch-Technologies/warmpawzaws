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
      const customers = await select('customers', { phone });
      
      if (customers.length === 0) {
        return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
      }

      return this.success({ customer: customers[0] }, requestId);
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

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerCustomerEndpointsEnhanced(app: Hono) {
  const getHandler = new GetCustomerHandlerEnhanced();
  const getByPhoneHandler = new GetCustomerByPhoneHandlerEnhanced();
  const updateHandler = new UpdateCustomerHandlerEnhanced();
  const getPetsHandler = new GetCustomerPetsHandlerEnhanced();
  const addPetHandler = new AddPetHandlerEnhanced();

  app.get('/customer/:customerId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result: any = await getHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
  });

  app.get('/customer/by-phone', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContext();
    const result: any = await getByPhoneHandler.execute(event, context);
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

