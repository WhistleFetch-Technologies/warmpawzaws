import type { Context } from 'hono';
import { createOrdersApiGatewayEvent, createEmptyLambdaContext } from '../../shared/hono-lambda-bridge.utils';
import { shopPaymentReconcileHandler } from './handler-instances.service';

export async function executecustomerOrdersIdReconcilepaymentPost(c: Context) {
  const event = createOrdersApiGatewayEvent(c.req);
  const context = createEmptyLambdaContext();
  const result = await shopPaymentReconcileHandler.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);
}
