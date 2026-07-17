import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { returnOrderHandler } from './handler-instances.service';

export async function executecustomerOrdersIdReturnPost(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const event = createOrdersApiGatewayEvent(c.req);
  event.body = JSON.stringify(body);
  const context = createEmptyLambdaContext();
  const result = await returnOrderHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);
}
