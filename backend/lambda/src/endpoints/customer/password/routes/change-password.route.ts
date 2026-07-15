import type { Hono } from 'hono';
import { ChangePasswordHandler } from '../handlers/change-password.handler';
import { mergeHonoJsonBodyFromRequest } from '../services/password-body.utils';
import {
  createApiGatewayEventFromParsedBody,
  createLambdaContext,
  mergeChangePasswordParsedBody,
} from '../services/lambda-event.utils';

export function registerChangePasswordRoute(app: Hono) {
  const changePasswordHandler = new ChangePasswordHandler();

  app.post('/customer/change-password', async (c) => {
    const envPb = (c.env as { parsedBody?: Record<string, unknown> | null } | undefined)?.parsedBody;
    const merged = await mergeHonoJsonBodyFromRequest(c);
    const parsed = mergeChangePasswordParsedBody(envPb, merged);
    const event = createApiGatewayEventFromParsedBody(c.req, parsed);
    (event as { __parsedRequestBody?: Record<string, unknown> }).__parsedRequestBody = parsed;
    const context = createLambdaContext();
    const result = await changePasswordHandler.execute(event, context);
    return c.json(JSON.parse(result.body), result.statusCode);
  });
}
