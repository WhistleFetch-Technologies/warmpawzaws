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

export async function executecustomerAppointmentsIdGet(c: Context) {
    const event = createAppointmentsApiGatewayEvent(c.req);
    mergeAllQueryFromHono(c, event);
    event.pathParameters = {
      ...(event.pathParameters && typeof event.pathParameters === 'object' ? event.pathParameters : {}),
      id: c.req.param('id'),
    };
    const context = createEmptyLambdaContext();
    return runAppointmentHandler(
      c,
      () => getDetailsHandler.execute(event, context),
      NOT_FOUND_FALLBACK,
      404
    );
}
