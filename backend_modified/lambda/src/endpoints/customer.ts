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
import {
  GetCustomerHandler,
  GetCustomerByPhoneHandler,
  CreateCustomerHandler,
  UpdateCustomerHandler,
  GetCustomerPetsHandler,
  AddPetHandler,
  createApiGatewayEventForCustomerTs,
  createLambdaContextForCustomerTs,
} from '../controllers/customer.controller';

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
      const event = createApiGatewayEventForCustomerTs(c.req);
      event.body = JSON.stringify(body);
      const context = createLambdaContextForCustomerTs();
      const result = await createHandler.execute(event, context);
      return c.json(JSON.parse(result.body), result.statusCode);
    } catch (error: any) {
      console.error('Error in POST /customers:', error);
      return c.json({ error: error.message || 'Failed to create customer' }, 500);
    }
  });

  app.get('/customer/:customerId', async (c) => {
    const event = createApiGatewayEventForCustomerTs(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContextForCustomerTs();
    const result = await getHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/by-phone', async (c) => {
    const event = createApiGatewayEventForCustomerTs(c.req);
    event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
    const context = createLambdaContextForCustomerTs();
    const result = await getByPhoneHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.put('/customer/:customerId', async (c) => {
    const event = createApiGatewayEventForCustomerTs(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContextForCustomerTs();
    const result = await updateHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.get('/customer/:customerId/pets', async (c) => {
    const event = createApiGatewayEventForCustomerTs(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContextForCustomerTs();
    const result = await getPetsHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });

  app.post('/customer/:customerId/pets', async (c) => {
    const event = createApiGatewayEventForCustomerTs(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createLambdaContextForCustomerTs();
    const result = await addPetHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}

