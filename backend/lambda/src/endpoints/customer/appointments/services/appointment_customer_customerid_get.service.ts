import type { Context } from 'hono';
import {
  createAppointmentsApiGatewayEvent,
  createEmptyLambdaContext,
  mergeAllQueryFromHono,
} from '../../shared/hono-lambda-bridge.utils';
import { runAppointmentHandler, NOT_FOUND_FALLBACK, LIST_FALLBACK } from '../repos/appointment-runtime.repo';
import {
  getAppointmentsHandler,
  getDetailsHandler,
  rescheduleHandler,
  cancelHandler,
} from './handler-instances.service';

export async function executeappointmentCustomerCustomeridGet(c: Context) {
    const event = createAppointmentsApiGatewayEvent(c.req);
    mergeAllQueryFromHono(c, event);
    event.pathParameters = {
      ...(event.pathParameters && typeof event.pathParameters === 'object' ? event.pathParameters : {}),
      customerId: c.req.param('customerId'),
    };
    event.queryStringParameters = {
      ...(event.queryStringParameters && typeof event.queryStringParameters === 'object'
        ? event.queryStringParameters
        : {}),
      status: c.req.query('status') || 'all',
    };
    const context = createEmptyLambdaContext();
    return runAppointmentHandler(
      c,
      () => getAppointmentsHandler.execute(event, context),
      LIST_FALLBACK,
      200,
      { coerceListErrorsToEmpty: true }
    );
}
