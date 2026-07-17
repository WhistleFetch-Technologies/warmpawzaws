import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { updateHandler } from './handler-instances.service';

export async function executecustomerCustomeridPut(c: Context) {
    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: c.req.param('customerId') };
    const context = createEnhancedLambdaContext();
    const result: any = await updateHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
}
