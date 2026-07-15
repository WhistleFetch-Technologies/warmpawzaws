import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { shopPaymentResumeHandler } from './handler-instances.service';

export async function executecustomerOrdersIdPaymentresumeGet(c: Context) {
  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await shopPaymentResumeHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);
}
