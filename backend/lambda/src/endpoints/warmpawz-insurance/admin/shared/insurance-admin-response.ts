import type { Context } from 'hono';
import { ZodError } from 'zod';

export const INSURANCE_ADMIN_LOG_PREFIX = '[warmpawz-insurance-admin]';

type ErrorStatus = 400 | 404 | 409 | 422 | 500;

export class InsuranceAdminError extends Error {
  constructor(
    readonly status: ErrorStatus,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'InsuranceAdminError';
  }
}

export function insuranceNotFound(what: string): InsuranceAdminError {
  return new InsuranceAdminError(404, 'NOT_FOUND', `${what} not found`);
}

export function insuranceAdminOk<T>(c: Context, data: T, status: 200 | 201 = 200): Response {
  return c.json({ success: true, data }, status);
}

function pgCode(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

export function insuranceAdminError(c: Context, error: unknown): Response {
  if (error instanceof ZodError) {
    return c.json(
      {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.flatten() },
      },
      400,
    );
  }
  if (error instanceof InsuranceAdminError) {
    return c.json({ success: false, error: { code: error.code, message: error.message } }, error.status);
  }
  const code = pgCode(error);
  if (code === '23505') {
    return c.json({ success: false, error: { code: 'DUPLICATE', message: 'This record already exists' } }, 409);
  }
  if (code === '23514' || code === '23503') {
    return c.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'The data does not meet the required rules' } },
      400,
    );
  }
  if (code === '42P01') {
    console.error(`${INSURANCE_ADMIN_LOG_PREFIX} tables missing — run migrations 1127–1130`);
  }
  console.error(`${INSURANCE_ADMIN_LOG_PREFIX} unexpected error`, error);
  return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, 500);
}
