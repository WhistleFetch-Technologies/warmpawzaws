import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { addPetHandler } from './handler-instances.service';

export async function executecustomerCustomeridPetsPost(c: Context) {
    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await addPetHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
}
