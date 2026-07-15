import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getOrdersHandler } from './handler-instances.service';

export async function executecustomerOrdersGet(c: Context) {
  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await getOrdersHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);
}
