import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getPetsHandler } from './handler-instances.service';

export async function executecustomerCustomeridPetsGet(c: Context) {
    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await getPetsHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
}
