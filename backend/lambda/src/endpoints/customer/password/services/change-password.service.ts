import type { Context } from 'hono';
import { mergeHonoJsonBodyFromRequest } from './password-body.utils';
import {
  createApiGatewayEventFromParsedBody,
  createLambdaContext,
  mergeChangePasswordParsedBody,
} from './lambda-event.utils';
import { changePasswordHandlerInstance } from './change-password-base-handler.service';

export async function executeChangePassword(c: Context) {
  const envPb = (c.env as { parsedBody?: Record<string, unknown> | null } | undefined)?.parsedBody;
  const merged = await mergeHonoJsonBodyFromRequest(c);
  const parsed = mergeChangePasswordParsedBody(envPb, merged);
  const event = createApiGatewayEventFromParsedBody(c.req, parsed);
  (event as { __parsedRequestBody?: Record<string, unknown> }).__parsedRequestBody = parsed;
  const context = createLambdaContext();
  const result = await changePasswordHandlerInstance.execute(event, context);
  return c.json(JSON.parse(result.body), result.statusCode);
}
