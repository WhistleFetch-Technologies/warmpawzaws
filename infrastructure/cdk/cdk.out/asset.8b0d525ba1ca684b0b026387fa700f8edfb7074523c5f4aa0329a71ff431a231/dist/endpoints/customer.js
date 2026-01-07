"use strict";
/**
 * ============================================================================
 * CUSTOMER ENDPOINTS - LAMBDA VERSION
 * ============================================================================
 *
 * Migrated from: supabase/functions/make-server-customer/customer-routes.tsx
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomerEndpoints = registerCustomerEndpoints;
const base_handler_1 = require("../handler/base-handler");
const rds_connection_1 = require("../database/rds-connection");
// ============================================================================
// CUSTOMER HANDLERS
// ============================================================================
class GetCustomerHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const customerId = context.event.pathParameters?.customerId;
        if (!customerId) {
            return this.error('Customer ID is required', 400);
        }
        // ✅ SQL: Get customer
        const customers = await (0, rds_connection_1.select)('customers', { id: customerId });
        if (customers.length === 0) {
            return this.error('Customer not found', 404);
        }
        return this.success(customers[0]);
    }
}
class UpdateCustomerHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const customerId = context.event.pathParameters?.customerId;
        const body = this.parseBody(context.event);
        if (!customerId) {
            return this.error('Customer ID is required', 400);
        }
        // ✅ SQL: Update customer
        const updateData = {};
        if (body.fullName)
            updateData.full_name = body.fullName;
        if (body.email)
            updateData.email = body.email;
        if (body.dateOfBirth)
            updateData.date_of_birth = body.dateOfBirth;
        if (body.address)
            updateData.address = body.address;
        if (body.city)
            updateData.city = body.city;
        if (body.state)
            updateData.state = body.state;
        if (body.pincode)
            updateData.pincode = body.pincode;
        updateData.updated_at = new Date();
        await (0, rds_connection_1.update)('customers', { id: customerId }, updateData);
        return this.success({ message: 'Customer updated successfully' });
    }
}
class GetCustomerPetsHandler extends base_handler_1.BaseHandler {
    async handle(context) {
        const customerId = context.event.pathParameters?.customerId;
        if (!customerId) {
            return this.error('Customer ID is required', 400);
        }
        // ✅ SQL: Get customer pets
        const pets = await (0, rds_connection_1.select)('pets', { customer_id: customerId });
        return this.success({ pets });
    }
}
class AddPetHandler extends base_handler_1.BaseHandler {
    async handle(context) {
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
        const pets = await (0, rds_connection_1.insert)('pets', petData);
        return this.success({ pet: pets[0] });
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerCustomerEndpoints(app) {
    const getHandler = new GetCustomerHandler();
    const updateHandler = new UpdateCustomerHandler();
    const getPetsHandler = new GetCustomerPetsHandler();
    const addPetHandler = new AddPetHandler();
    app.get('/customer/:customerId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { customerId: c.req.param('customerId') };
        const context = createLambdaContext();
        const result = await getHandler.execute(event, context);
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
function createApiGatewayEvent(req) {
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
function createLambdaContext() {
    return {
        requestId: crypto.randomUUID(),
        functionName: 'customer-handler',
        functionVersion: '$LATEST',
    };
}
//# sourceMappingURL=customer.js.map