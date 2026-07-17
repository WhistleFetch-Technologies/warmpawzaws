import type { Context } from 'hono';
import {
  createAppointmentsApiGatewayEvent,
  createEmptyLambdaContext,
  mergeAllQueryFromHono,
} from '../../shared/hono-lambda-bridge.utils';
import { runAppointmentHandler, NOT_FOUND_FALLBACK, LIST_FALLBACK, attachParsedJsonBody } from '../repos/appointment-runtime.repo';
import {
  getAppointmentsHandler,
  getDetailsHandler,
  rescheduleHandler,
  cancelHandler,
} from './handler-instances.service';

export async function executecustomerAppointmentsIdCancelPost(c: Context) {
    const event = createAppointmentsApiGatewayEvent(c.req);
    mergeAllQueryFromHono(c, event);
    await attachParsedJsonBody(c, event);
    const context = createEmptyLambdaContext();
    return runAppointmentHandler(
      c,
      () => cancelHandler.execute(event, context),
      NOT_FOUND_FALLBACK,
      404
    );
}
