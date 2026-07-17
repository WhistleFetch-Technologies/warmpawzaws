import type { Context } from 'hono';
import { HandlerContext } from '../../../../handler/base-handler';
import { createOrderHandler } from './handler-instances.service';

export async function executecustomerOrdersPost(c: Context) {
  try {
    const body = await c.req.json();
    const response = await createOrderHandler.handle({
      event: {
        body: JSON.stringify(body),
        queryStringParameters: c.req.query ? Object.fromEntries(Object.entries(c.req.query())) : {},
      } as any,
    } as HandlerContext);
    return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 500);
  } catch (error: any) {
    console.error('Error creating order:', error);
    return c.json({ error: error.message || 'Failed to create order' }, 500);
  }
}
