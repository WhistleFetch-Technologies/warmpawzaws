"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomerEndpointsEnhanced = registerCustomerEndpointsEnhanced;
const base_handler_enhanced_1 = require("../handler/base-handler-enhanced");
const rds_connection_1 = require("../database/rds-connection");
const customers_1 = require("@warmpawz/api-contracts/customers");
// ============================================================================
// CUSTOMER HANDLERS
// ============================================================================
class GetCustomerHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const customerId = context.event.pathParameters?.customerId;
        const requestId = context.requestId;
        if (!customerId) {
            return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        try {
            const customers = await (0, rds_connection_1.select)('customers', { id: customerId });
            if (customers.length === 0) {
                return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
            }
            return this.success({ customer: customers[0] }, requestId);
        }
        catch (error) {
            console.error('Error getting customer:', error);
            return this.error(error.message || 'Failed to get customer', 500, 'INTERNAL_ERROR', undefined, requestId);
        }
    }
}
class GetCustomerByPhoneHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const phone = context.event.queryStringParameters?.phone;
        const requestId = context.requestId;
        if (!phone) {
            return this.error('Phone number is required', 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        try {
            const customers = await (0, rds_connection_1.select)('customers', { phone });
            if (customers.length === 0) {
                return this.error('Customer not found', 404, 'NOT_FOUND', undefined, requestId);
            }
            return this.success({ customer: customers[0] }, requestId);
        }
        catch (error) {
            console.error('Error getting customer by phone:', error);
            return this.error(error.message || 'Failed to get customer', 500, 'INTERNAL_ERROR', undefined, requestId);
        }
    }
}
class UpdateCustomerHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const customerId = context.event.pathParameters?.customerId;
        const body = this.parseBody(context.event);
        const requestId = context.requestId;
        if (!customerId) {
            return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        // Validate request with Zod schema
        const validationResult = customers_1.UpdateCustomerProfileRequestSchema.safeParse(body);
        if (!validationResult.success) {
            return this.error('Validation failed', 400, 'VALIDATION_ERROR', { errors: validationResult.error.errors }, requestId);
        }
        try {
            const updateData = {
                updated_at: new Date(),
            };
            if (validationResult.data.firstName)
                updateData.first_name = validationResult.data.firstName;
            if (validationResult.data.lastName)
                updateData.last_name = validationResult.data.lastName;
            if (validationResult.data.email)
                updateData.email = validationResult.data.email;
            if (validationResult.data.address)
                updateData.address = validationResult.data.address;
            if (validationResult.data.pincode)
                updateData.pincode = validationResult.data.pincode;
            if (validationResult.data.photo)
                updateData.profile_photo_url = validationResult.data.photo;
            await (0, rds_connection_1.update)('customers', { id: customerId }, updateData);
            // Get updated customer
            const customers = await (0, rds_connection_1.select)('customers', { id: customerId });
            return this.success({
                message: 'Customer updated successfully',
                customer: customers[0],
            }, requestId);
        }
        catch (error) {
            console.error('Error updating customer:', error);
            return this.error(error.message || 'Failed to update customer', 500, 'INTERNAL_ERROR', undefined, requestId);
        }
    }
}
class GetCustomerPetsHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
        const customerId = context.event.pathParameters?.customerId;
        const requestId = context.requestId;
        if (!customerId) {
            return this.error('Customer ID is required', 400, 'VALIDATION_ERROR', undefined, requestId);
        }
        try {
            const pets = await (0, rds_connection_1.select)('pets', { customer_id: customerId });
            return this.success({ pets }, requestId);
        }
        catch (error) {
            console.error('Error getting customer pets:', error);
            return this.error(error.message || 'Failed to get pets', 500, 'INTERNAL_ERROR', undefined, requestId);
        }
    }
}
class AddPetHandlerEnhanced extends base_handler_enhanced_1.BaseHandlerEnhanced {
    async handle(context) {
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
            const pets = await (0, rds_connection_1.insert)('pets', petData);
            return this.success({ pet: pets[0] }, requestId);
        }
        catch (error) {
            console.error('Error adding pet:', error);
            return this.error(error.message || 'Failed to add pet', 500, 'INTERNAL_ERROR', undefined, requestId);
        }
    }
}
// ============================================================================
// HONO ROUTER SETUP
// ============================================================================
function registerCustomerEndpointsEnhanced(app) {
    const getHandler = new GetCustomerHandlerEnhanced();
    const getByPhoneHandler = new GetCustomerByPhoneHandlerEnhanced();
    const updateHandler = new UpdateCustomerHandlerEnhanced();
    const getPetsHandler = new GetCustomerPetsHandlerEnhanced();
    const addPetHandler = new AddPetHandlerEnhanced();
    app.get('/customer/:customerId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { customerId: c.req.param('customerId') };
        const context = createLambdaContext();
        const result = await getHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
    });
    app.get('/customer/by-phone', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.queryStringParameters = Object.fromEntries(new URL(c.req.url, 'http://localhost').searchParams);
        const context = createLambdaContext();
        const result = await getByPhoneHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
    });
    app.put('/customer/:customerId', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { customerId: c.req.param('customerId') };
        const context = createLambdaContext();
        const result = await updateHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
    });
    app.get('/customer/:customerId/pets', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { customerId: c.req.param('customerId') };
        const context = createLambdaContext();
        const result = await getPetsHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
    });
    app.post('/customer/:customerId/pets', async (c) => {
        const event = createApiGatewayEvent(c.req);
        event.pathParameters = { customerId: c.req.param('customerId') };
        const context = createLambdaContext();
        const result = await addPetHandler.execute(event, context);
        const body = JSON.parse(result.body);
        return c.json(body, result.statusCode);
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
//# sourceMappingURL=customer-enhanced.js.map