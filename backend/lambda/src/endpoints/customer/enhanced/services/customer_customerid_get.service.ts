import type { Context } from 'hono';
import { createEnhancedApiGatewayEvent, createEnhancedLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getHandler } from './handler-instances.service';
import { requireCustomerIdentifierMatch } from '../../../../utils/security-ownership';

export async function executecustomerCustomeridGet(c: Context) {
    const pathId = c.req.param('customerId');
    const authz = await requireCustomerIdentifierMatch(c, pathId);
    if (!authz.ok) {
      return c.json({ success: false, error: authz.error }, authz.status);
    }
    const event = createEnhancedApiGatewayEvent(c.req);
    event.pathParameters = { customerId: authz.customerId };
    const context = createEnhancedLambdaContext();
    // Propagate JWT customer into BaseHandlerEnhanced userId
    (context as any).userId = authz.customerId;
    (event as any).requestContext = {
      ...((event as any).requestContext || {}),
      authorizer: { claims: { sub: authz.customerId } },
    };
    const result: any = await getHandler.execute(event, context);
    const body = JSON.parse(result.body);
    return c.json(body, result.statusCode);
}
