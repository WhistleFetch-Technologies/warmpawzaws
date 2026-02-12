/**
 * ============================================================================
 * CUSTOMER ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 * 
 * 
 * Endpoints:
 * - GET /customer/:customerId - Get customer profile
 * - PUT /customer/:customerId - Update customer profile
 * - GET /customer/:customerId/pets - Get customer pets
 * - POST /customer/:customerId/pets - Add pet
 * 
 * Date: 2025-01-28
 * Migration: Supabase to AWS Lambda
 * ============================================================================
 */

import { Hono } from 'hono';
import { randomUUID } from 'crypto';
import { BaseHandler, HandlerContext, HandlerResponse } from '../handler/base-handler';
import { query, select, insert, update } from '../database/rds-connection';
import { normalizeDbRow, normalizeDbRows, extractEntityIds } from '../utils/entity-extractor';
import { isValidUUID } from '../types/entities';

// ============================================================================
// CUSTOMER HANDLERS
// ============================================================================

class GetCustomerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    // ✅ SQL: Get customer
    const customers = await select('customers', { id: customerId });
    
    if (customers.length === 0) {
      return this.error('Customer not found', 404);
    }

    return this.success(customers[0]);
  }
}

class GetCustomerByPhoneHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const phone = context.event.queryStringParameters?.phone;

    if (!phone) {
      return this.error('Phone number is required', 400);
    }

    // ✅ SQL: Get customer by phone
    const customers = await select('customers', { phone });
    
    if (customers.length === 0) {
      return this.error('Customer not found', 404);
    }

    return this.success({ customer: customers[0] });
  }
}

class UpdateCustomerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    // ✅ SQL: Update customer
    const updateData: any = {};
    if (body.fullName) updateData.full_name = body.fullName;
    if (body.email) updateData.email = body.email;
    if (body.dateOfBirth) updateData.date_of_birth = body.dateOfBirth;
    if (body.address) updateData.address = body.address;
    if (body.city) updateData.city = body.city;
    if (body.state) updateData.state = body.state;
    if (body.pincode) updateData.pincode = body.pincode;

    updateData.updated_at = new Date();

    await update('customers', { id: customerId }, updateData);

    return this.success({ message: 'Customer updated successfully' });
  }
}

class GetCustomerPetsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;

    if (!customerId) {
      return this.error('Customer ID is required', 400);
    }

    // ✅ SQL: Get customer pets
    const pets = await select('pets', { customer_id: customerId });

    return this.success({ pets });
  }
}

class CreateCustomerHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const body = this.parseBody(context.event);

    // Validate required fields
    if (!body.phone && !body.email) {
      return this.error('Phone or email is required', 400);
    }

    try {
      // Check if customer already exists
      if (body.phone) {
        const existing = await select('customers', { phone: body.phone });
        if (existing.length > 0) {
          return this.success({ 
            customer: existing[0], 
            message: 'Customer already exists' 
          });
        }
      }

      // ✅ SQL: Create customer
      const customerData: any = {
        phone: body.phone,
        email: body.email,
        full_name: body.name || body.fullName,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Add optional fields
      if (body.address) customerData.address = body.address;
      if (body.city) customerData.city = body.city;
      if (body.state) customerData.state = body.state;
      if (body.pincode) customerData.pincode = body.pincode;

      const customers = await insert('customers', customerData);

      return this.success({ customer: customers[0] }, 201);
    } catch (error: any) {
      console.error('Error creating customer:', error);
      // Handle duplicate phone error
      if (error.message?.includes('duplicate') || error.code === '23505') {
        const existing = await select('customers', { phone: body.phone });
        if (existing.length > 0) {
          return this.success({ 
            customer: existing[0], 
            message: 'Customer already exists' 
          });
        }
      }
      return this.error(error.message || 'Failed to create customer', 500);
    }
  }
}

class AddPetHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    const customerId = context.event.pathParameters?.customerId;
    const body = this.parseBody(context.event);

    this.validateRequired(body, ['name', 'species', 'breed']);

    // ✅ SQL: Create pet
    const petData = {
      customer_id: customerId,
      name: body.name,
      species: body.species,
      breed: body.breed,
      age: body.age,
      gender: body.gender,
      weight: body.weight,
      color: body.color,
      medical_history: body.medicalHistory || [],
    };

    const pets = await insert('pets', petData);

    return this.success({ pet: pets[0] });
  }
}

// ============================================================================
// HONO ROUTER SETUP
// ============================================================================

export function registerCustomerEndpoints(app: Hono) {
  const getHandler = new GetCustomerHandler();
  const getByPhoneHandler = new GetCustomerByPhoneHandler();
  const createHandler = new CreateCustomerHandler();
  const updateHandler = new UpdateCustomerHandler();
  const getPetsHandler = new GetCustomerPetsHandler();
  const addPetHandler = new AddPetHandler();

  // POST /customers - Create new customer
  app.post('/customers', async (c) => {
    try {
      const body = await c.req.json();
      const event = createApiGatewayEvent(c.req);
      event.body = JSON.stringify(body);
      const context = createLambdaContext();
      const result = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('Error in POST /customers:', error);
      return c.json({ error: error.message || 'Failed to create customer' }, 500);
    }
  });

  app.get('/customer/:customerId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await getHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/by-phone', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContext();
    const result = await getByPhoneHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/customer/:customerId', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await updateHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/:customerId/pets', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await getPetsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/customer/:customerId/pets', async (c) => {
    const event = createApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContext();
    const result = await addPetHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
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

