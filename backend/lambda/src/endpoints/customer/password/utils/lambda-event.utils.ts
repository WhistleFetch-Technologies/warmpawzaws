import type { Context } from 'hono';
import {
  omitEmptyPasswordKeys,
  omitUndefinedShallow,
} from '../utils/password-body.utils';

export function createApiGatewayEventFromParsedBody(req: Context['req'], parsed: Record<string, unknown>): any {
  const headers: Record<string, string> = {};
  req.raw.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return {
    pathParameters: {},
    queryStringParameters: {},
    body: JSON.stringify(parsed ?? {}),
    isBase64Encoded: false,
    headers,
    requestContext: {
      authorizer: {
        claims: {
          sub: req.header('x-user-id') || 'test-user',
        },
      },
    },
  };
}

export function createLambdaContext(): any {
  return {};
}

export function mergeChangePasswordParsedBody(
  envPb: Record<string, unknown> | null | undefined,
  merged: Record<string, unknown>
): Record<string, unknown> {
  const fromGateway =
    envPb && typeof envPb === 'object' && !Array.isArray(envPb) ? { ...envPb } : {};
  return {
    ...omitEmptyPasswordKeys(omitUndefinedShallow(fromGateway)),
    ...omitEmptyPasswordKeys(omitUndefinedShallow(merged)),
  };
}
