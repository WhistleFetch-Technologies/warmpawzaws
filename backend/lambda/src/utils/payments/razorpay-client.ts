/**
 * ============================================================================
 * RAZORPAY CLIENT UTILITY
 * ============================================================================
 * 
 * Centralized Razorpay API client
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import { query, select } from '../../database/rds-connection';
import { getSecretJson } from '../aws/secrets-manager';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  /** RazorpayX Current Account number (Customer Identifier) for Payouts API - from x.razorpay.com → Banking */
  razorpayXAccountNumber?: string;
}

/**
 * Get Razorpay configuration from AWS Secrets Manager (primary) or database/env (fallback).
 *
 * AWS Secrets Manager (recommended for production):
 * - Secret name: warmpawz/{STAGE}/razorpay (e.g. warmpawz/dev/razorpay)
 * - Value (JSON): { "keyId": "rzp_...", "keySecret": "...", "webhookSecret": "..." }
 * - Lambda must have IAM permission secretsmanager:GetSecretValue for this secret.
 * - If Lambda runs in a VPC, ensure NAT Gateway or VPC endpoint for Secrets Manager.
 */
export async function getRazorpayConfig(): Promise<RazorpayConfig> {

  // try database first 
  try {
    const integrations = await select('platform_integrations', {
      integration_name: 'razorpay',
    });

    if (integrations.length > 0 && integrations[0].integration_config) {
      const config = integrations[0].integration_config as any;
      if (config.keyId && config.keySecret) {
        console.log('[RAZORPAY-CONFIG] Loaded from database');
        const xAccount = config.razorpayXAccountNumber || config.xAccountNumber || '';
        console.log('[RAZORPAY-CONFIG] Loaded from database', config);
        return {
          keyId: config.keyId,
          keySecret: config.keySecret,
          webhookSecret: config.webhookSecret || '',
          razorpayXAccountNumber: xAccount?.trim() || undefined,
        };
      }
    }
  } catch (error: any) {
    console.warn('[RAZORPAY-CONFIG] Failed to load from database, trying env vars:', error.message);
  }

  //try secrets manager second
  try {
    const secretConfig = await Promise.race([
      getSecretJson<{
        keyId: string;
        keySecret: string;
        webhookSecret?: string;
        razorpayXAccountNumber?: string;
        xAccountNumber?: string;
      }>('razorpay'),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Secrets Manager timeout')), 5000) // 5s timeout
      )
    ]).catch((error) => {
      // If timeout, return null to trigger fallback
      if (error.message === 'Secrets Manager timeout') {
        console.warn('[RAZORPAY-CONFIG] Secrets Manager timeout, using fallback');
        return null;
      }
      throw error;
    });

    if (secretConfig && secretConfig.keyId && secretConfig.keySecret) {
      console.log('[RAZORPAY-CONFIG] Loaded from AWS Secrets Manager');
      const xAccount = (secretConfig as any).razorpayXAccountNumber || (secretConfig as any).xAccountNumber || '';
      return {
        keyId: secretConfig.keyId,
        keySecret: secretConfig.keySecret,
        webhookSecret: secretConfig.webhookSecret || '',
        razorpayXAccountNumber: xAccount?.trim() || undefined,
      };
    }
  } catch (error: any) {
    console.warn('[RAZORPAY-CONFIG] Failed to load from Secrets Manager, trying fallback:', error.message);
  }



  // Try environment variables
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (keyId && keySecret) {
    const xFromEnv = process.env.RAZORPAY_X_ACCOUNT_NUMBER?.trim();
    console.log('[RAZORPAY-CONFIG] Loaded from environment variables');
    return {
      keyId,
      keySecret,
      webhookSecret: webhookSecret || '',
      razorpayXAccountNumber: xFromEnv || undefined,
    };
  }

  throw new Error('Razorpay not configured. Please configure in AWS Secrets Manager, Platform Settings, or environment variables.');
}

/**
 * Get Razorpay authorization header
 */
export async function getRazorpayAuthHeader(): Promise<string> {
  const config = await getRazorpayConfig();
  const auth = Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64');
  return `Basic ${auth}`;
}

/**
 * Make Razorpay API request with timeout handling
 * @param extraHeaders - Optional headers (e.g. X-Payout-Idempotency for payouts)
 */
export async function razorpayRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  timeoutMs: number = 20000, // ✅ FIX: Increased default to 20 seconds
  extraHeaders?: Record<string, string>
): Promise<any> {
  const authHeader = await getRazorpayAuthHeader();
  const url = `https://api.razorpay.com/v1${endpoint}`;

  console.log(`[RAZORPAY-REQUEST] ${method} ${endpoint} (timeout: ${timeoutMs}ms)`);

  const headers: Record<string, string> = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[RAZORPAY-REQUEST] Timeout after ${timeoutMs}ms for ${endpoint}`);
    controller.abort();
  }, timeoutMs);

  try {
    const startTime = Date.now();

    // ✅ Enhanced logging for debugging
    console.log(`[RAZORPAY-REQUEST] Attempting ${method} ${url}`, {
      hasBody: !!body,
      bodySize: body ? JSON.stringify(body).length : 0,
      timeout: timeoutMs,
    });

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    console.log(`[RAZORPAY-REQUEST] Response received in ${duration}ms for ${endpoint}`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
    });

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      const errorMsg = error?.error?.description || error?.error?.message || response.statusText || 'Unknown error';
      console.error(`[RAZORPAY-REQUEST] API error (${response.status}): ${errorMsg}`, {
        errorDetails: error,
        responseHeaders: Object.fromEntries(response.headers.entries()),
      });
      throw new Error(`Razorpay API error: ${errorMsg}`);
    }

    const result = await response.json();
    console.log(`[RAZORPAY-REQUEST] Success for ${endpoint}`);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // ✅ Enhanced error logging with more details
    const errorDetails: any = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      cause: error.cause,
      endpoint,
      method,
      url,
    };

    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.error(`[RAZORPAY-REQUEST] Timeout after ${timeoutMs}ms for ${endpoint}`, errorDetails);
      throw new Error(`Razorpay API request timeout after ${timeoutMs}ms`);
    }

    // ✅ Check for network/DNS errors
    if (error.message?.includes('fetch failed') || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error(`[RAZORPAY-REQUEST] Network error for ${endpoint}:`, errorDetails);
      throw new Error(`Network error connecting to Razorpay API: ${error.message || error.code || 'Unknown network error'}. Please check Lambda VPC configuration and internet connectivity.`);
    }

    // ✅ Check for SSL/TLS errors
    if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'CERT_HAS_EXPIRED' || error.message?.includes('certificate')) {
      console.error(`[RAZORPAY-REQUEST] SSL/TLS error for ${endpoint}:`, errorDetails);
      throw new Error(`SSL/TLS error connecting to Razorpay API: ${error.message || error.code}`);
    }

    console.error(`[RAZORPAY-REQUEST] Error for ${endpoint}:`, errorDetails);

    // ✅ Re-throw with more context
    if (error.message) {
      throw new Error(`Razorpay API request failed: ${error.message}`);
    }
    throw error;
  }
}

/** RazorpayX current account (customer identifier) — same as bank fund_account validations. */
async function getRazorpayXSourceAccountNumber(): Promise<string | null> {
  try {
    const config = await getRazorpayConfig();
    const x = (config as any).razorpayXAccountNumber;
    if (x != null && String(x).trim() !== '') return String(x).trim();
  } catch {
    /* use env only */
  }
  const env = process.env.RAZORPAY_X_ACCOUNT_NUMBER?.trim();
  return env || null;
}

/**
 * Payments API POST /v1/payments/validate/vpa is not enabled for many merchants (UPI collect / manual flag).
 * Razorpay returns 400 with description "The requested URL was not found on the server."
 */
function isPaymentsValidateVpaUnavailableError(message: string): boolean {
  const m = String(message || '').toLowerCase();
  return (
    m.includes('not found on the server') ||
    m.includes('the requested url was not found') ||
    m.includes('url was not found')
  );
}

/**
 * VPA validation via RazorpayX: POST /v1/fund_accounts/validations (pennydrop + account_type vpa).
 * @see https://razorpay.com/docs/api/x/account-validation/vpa/
 */
async function validateRazorpayVpaViaFundAccountValidation(vpaAddress: string): Promise<{
  valid: boolean;
  customerName?: string;
  error?: string;
}> {
  const sourceAccount = await getRazorpayXSourceAccountNumber();
  if (!sourceAccount?.trim()) {
    return {
      valid: false,
      error:
        'Standard UPI validate API is not enabled on your Razorpay account, and RazorpayX current account is missing. Add razorpayXAccountNumber to your Razorpay secret (Dashboard → Banking → Customer Identifier) or set RAZORPAY_X_ACCOUNT_NUMBER, or ask Razorpay support to enable VPA validation.',
    };
  }

  const ref = `vpa-${Date.now()}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const body = {
    source_account_number: sourceAccount,
    validation_type: 'pennydrop',
    reference_id: ref,
    fund_account: {
      account_type: 'vpa',
      vpa: {
        address: vpaAddress,
      },
      contact: {
        name: 'Vendor payout UPI',
        email: `vendor-upi-${ref}@validation.warmpawz.com`,
        contact: '9999999999',
        type: 'vendor',
        reference_id: ref,
      },
    },
  };

  try {
    const res = await razorpayRequest('/fund_accounts/validations', 'POST', body, 20000);
    const status = res?.status;
    const regName =
      typeof res?.validation_results?.registered_name === 'string'
        ? res.validation_results.registered_name.trim()
        : undefined;
    if (status === 'completed') {
      return {
        valid: true,
        customerName: regName || undefined,
      };
    }
    if (status === 'failed') {
      return {
        valid: false,
        error: res?.status_details?.description || res?.status_details?.reason || 'VPA validation failed',
      };
    }
    return {
      valid: false,
      error:
        status === 'created'
          ? 'VPA validation is processing; try again in a few seconds or check RazorpayX dashboard.'
          : 'VPA validation did not complete',
    };
  } catch (e: any) {
    const msg = String(e?.message || 'RazorpayX VPA validation failed')
      .replace(/^Razorpay API error:\s*/i, '')
      .trim();
    return { valid: false, error: msg };
  }
}

/** Razorpay validate-VPA API can return success in slightly different shapes across API versions. */
function razorpayVpaResponseIsValid(res: any): boolean {
  if (!res || typeof res !== 'object') return false;
  if (res.success === false || res.success === 'false' || res.success === 0) return false;
  if (res.success === true || res.success === 1 || res.success === 'true') return true;
  const name = res.customer_name;
  if (typeof name === 'string' && name.trim().length > 0 && res.error == null && res.success !== false) {
    return true;
  }
  return false;
}

/**
 * Verify a UPI VPA via Razorpay Payments API (POST /v1/payments/validate/vpa).
 * Uses getRazorpayConfig() / getRazorpayAuthHeader() — identical credential chain to payments, refunds, and payouts.
 */
export async function validateRazorpayVpa(vpa: string): Promise<{
  valid: boolean;
  customerName?: string;
  error?: string;
}> {
  const normalized = String(vpa || '')
    .trim()
    .toLowerCase();
  if (!normalized.includes('@')) {
    return { valid: false, error: 'Invalid UPI ID format' };
  }
  const [handle, psp] = normalized.split('@');
  if (!handle || !psp || psp.length < 2) {
    return { valid: false, error: 'Invalid UPI ID format' };
  }

  try {
    const cfg = await getRazorpayConfig();
    const keyPrefix = cfg.keyId ? `${String(cfg.keyId).slice(0, 10)}…` : '(missing)';
    console.log('[RAZORPAY-VPA] Validating VPA with same Razorpay config as payments (keyId prefix):', keyPrefix);
  } catch (e: any) {
    const msg = e?.message || 'Razorpay is not configured';
    console.error('[RAZORPAY-VPA] Config load failed:', msg);
    return { valid: false, error: msg };
  }

  try {
    let res: any;
    try {
      res = await razorpayRequest('/payments/validate/vpa', 'POST', { vpa: normalized }, 15000);
    } catch (first: any) {
      const rawFirst = String(first?.message || '');
      if (isPaymentsValidateVpaUnavailableError(rawFirst)) {
        console.warn(
          '[RAZORPAY-VPA] /payments/validate/vpa unavailable for this merchant; using RazorpayX fund_accounts/validations',
        );
        return validateRazorpayVpaViaFundAccountValidation(normalized);
      }
      const msg = rawFirst
        .replace(/^Razorpay API error:\s*/i, '')
        .replace(/^Razorpay API request failed:\s*/i, '')
        .trim();
      return { valid: false, error: msg || rawFirst };
    }

    if (razorpayVpaResponseIsValid(res)) {
      const customerName =
        typeof res.customer_name === 'string' && res.customer_name.trim()
          ? res.customer_name.trim()
          : undefined;
      return { valid: true, customerName };
    }
    const desc =
      res?.error?.description ||
      res?.error?.reason ||
      res?.error?.message ||
      (typeof res?.message === 'string' ? res.message : undefined);
    return { valid: false, error: desc || 'This UPI ID could not be verified' };
  } catch (e: any) {
    const raw = e?.message || 'UPI verification failed';
    const msg = raw.replace(/^Razorpay API error:\s*/i, '').replace(/^Razorpay API request failed:\s*/i, '').trim() || raw;
    return { valid: false, error: msg };
  }
}

/**
 * Convenience accessor for Razorpay client actions
 */
export function getRazorpayClient() {
  const payments = {
    async refund(params: { payment_id: string; amount?: number }) {
      const { payment_id, amount } = params;
      return razorpayRequest(`/payments/${payment_id}/refund`, 'POST', amount ? { amount } : undefined);
    },
  };

  const payouts = {
    /** Create payout (Composite API: pass account_number + fund_account with contact + bank_account). Optional idempotencyKey. */
    async create(body: any, idempotencyKey?: string) {
      const extraHeaders: Record<string, string> = {};
      if (idempotencyKey) extraHeaders['X-Payout-Idempotency'] = idempotencyKey;
      return razorpayRequest('/payouts', 'POST', body, 20000, Object.keys(extraHeaders).length ? extraHeaders : undefined);
    },
  };

  const validateBankAccount = async (params: {
    account_number: string;
    ifsc: string;
    beneficiary_name: string;
    contact_phone?: string;
    contact_email?: string;
    reference_id?: string;
  }): Promise<{ valid: boolean; error?: string; validationId?: string }> => {
    const sourceAccount = await getRazorpayXAccountNumber();
    if (!sourceAccount?.trim()) {
      return { valid: false, error: 'RazorpayX source account not configured (razorpayXAccountNumber in secret or RAZORPAY_X_ACCOUNT_NUMBER)' };
    }
    const ref = params.reference_id || `val-${Date.now()}`;
    const body = {
      source_account_number: sourceAccount,
      validation_type: 'optimized',
      reference_id: ref.slice(0, 40),
      fund_account: {
        account_type: 'bank_account',
        bank_account: {
          name: params.beneficiary_name,
          ifsc: params.ifsc.toUpperCase(),
          account_number: String(params.account_number).replace(/\s/g, ''),
        },
      },
      contact: {
        name: params.beneficiary_name,
        email: params.contact_email || `vendor-${ref}@validation.warmpawz.com`,
        contact: (params.contact_phone || '0000000000').replace(/\D/g, '').slice(-10) || '0000000000',
        type: 'vendor',
        reference_id: ref.slice(0, 40),
      },
    };
    try {
      const res = await razorpayRequest('/fund_accounts/validations', 'POST', body, 15000);
      const status = res?.status;
      const validationId = res?.id;
      if (status === 'completed') return { valid: true, validationId };
      if (status === 'failed') return { valid: false, error: res?.status_details?.description || 'Validation failed', validationId };
      return { valid: false, error: status === 'created' ? 'Validation initiated; check RazorpayX dashboard for result' : 'Validation incomplete', validationId };
    } catch (e: any) {
      const msg = e?.message || 'Validation API error';
      return { valid: false, error: msg };
    }
  };

  /** Get RazorpayX Current Account number for Payouts API (from secret or env) */
  const getRazorpayXAccountNumber = async (): Promise<string | null> => {
    try {
      const config = await getRazorpayConfig();
      if ((config as any).razorpayXAccountNumber) return (config as any).razorpayXAccountNumber.trim();
    } catch (_) { }
    const env = process.env.RAZORPAY_X_ACCOUNT_NUMBER?.trim();
    return env || null;
  };

  return {
    request: razorpayRequest,
    getConfig: getRazorpayConfig,
    getAuthHeader: getRazorpayAuthHeader,
    getRazorpayXAccountNumber,
    payments,
    payouts,
    validateBankAccount,
    /** Same Razorpay key/secret as payments — POST /v1/payments/validate/vpa */
    validateVpa: validateRazorpayVpa,
  };
}

