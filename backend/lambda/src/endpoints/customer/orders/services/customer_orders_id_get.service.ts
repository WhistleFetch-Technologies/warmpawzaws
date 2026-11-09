import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getDetailsHandler } from './handler-instances.service';
import { requireAuthenticatedCustomer } from '../../../../utils/security-ownership';

export async function executecustomerOrdersIdGet(c: Context) {
  const authz = await requireAuthenticatedCustomer(c);
  if (!authz.ok) {
    return c.json({ success: false, error: authz.error }, authz.status);
  }
  const event = createOrdersApiGatewayEvent(c.req, { customerId: authz.customerId });
  const context = createEmptyLambdaContext();
  const result = await getDetailsHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);
}
