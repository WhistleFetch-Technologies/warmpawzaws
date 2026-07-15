import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { deactivateHandler } from './handler-instances.service';

export async function executecustomerCustomeridDelete(c: Context) {
    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await deactivateHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
}
