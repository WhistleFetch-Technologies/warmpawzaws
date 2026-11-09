import type { Context } from 'hono';
import { HandlerContext } from '../../../../handler/base-handler';
import { createOrderHandler } from './handler-instances.service';
import { requireAuthenticatedCustomer } from '../../../../utils/security-ownership';

export async function executecustomerOrdersPost(c: Context) {
  try {
    const authz = await requireAuthenticatedCustomer(c);
    if (!authz.ok) {
      return c.json({ success: false, error: authz.error }, authz.status);
    }
    const body = await c.req.json();
    const response = await createOrderHandler.handle({
      event: {
        body: JSON.stringify(body),
        // Strip spoofable customerId from query
        queryStringParameters: {},
        requestContext: { authorizer: { claims: { sub: authz.customerId } } },
      } as any,
      userId: authz.customerId,
    } as HandlerContext);
    return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 500);
  } catch (error: any) {
    console.error('Error creating order:', error);
    return c.json({ error: error.message || 'Failed to create order' }, 500);
  }
}
