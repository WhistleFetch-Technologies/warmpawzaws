import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { getInvoiceHandler } from './handler-instances.service';

export async function executecustomerOrdersIdInvoiceGet(c: Context) {
  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await getInvoiceHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);
}
