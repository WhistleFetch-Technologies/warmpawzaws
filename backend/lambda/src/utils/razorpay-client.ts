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

import { query, select } from '../database/rds-connection';
import { getSecretJson } from './secrets-manager';

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
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
  // ✅ PRIMARY: Try AWS Secrets Manager first (with timeout to prevent hangs)
  try {
    // ✅ FIX: Add timeout to Secrets Manager call to prevent Lambda timeout
    const secretConfig = await Promise.race([
      getSecretJson<{
        keyId: string;
        keySecret: string;
        webhookSecret?: string;
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
      return {
        keyId: secretConfig.keyId,
        keySecret: secretConfig.keySecret,
        webhookSecret: secretConfig.webhookSecret || '',
      };
    }
  } catch (error: any) {
    console.warn('[RAZORPAY-CONFIG] Failed to load from Secrets Manager, trying fallback:', error.message);
  }

  // ✅ FALLBACK 1: Try database
  try {
    const integrations = await select('platform_integrations', {
      integration_name: 'razorpay',
    });

    if (integrations.length > 0 && integrations[0].integration_config) {
      const config = integrations[0].integration_config as any;
      if (config.keyId && config.keySecret) {
        console.log('[RAZORPAY-CONFIG] Loaded from database');
        return {
          keyId: config.keyId,
          keySecret: config.keySecret,
          webhookSecret: config.webhookSecret || '',
        };
      }
    }
  } catch (error: any) {
    console.warn('[RAZORPAY-CONFIG] Failed to load from database, trying env vars:', error.message);
  }

  // ✅ FALLBACK 2: Try environment variables
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (keyId && keySecret) {
    console.log('[RAZORPAY-CONFIG] Loaded from environment variables');
    return {
      keyId,
      keySecret,
      webhookSecret: webhookSecret || '',
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
 */
export async function razorpayRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any,
  timeoutMs: number = 20000 // ✅ FIX: Increased default to 20 seconds
): Promise<any> {
  const authHeader = await getRazorpayAuthHeader();
  const url = `https://api.razorpay.com/v1${endpoint}`;

  console.log(`[RAZORPAY-REQUEST] ${method} ${endpoint} (timeout: ${timeoutMs}ms)`);

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn(`[RAZORPAY-REQUEST] Timeout after ${timeoutMs}ms for ${endpoint}`);
    controller.abort();
  }, timeoutMs);

  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    console.log(`[RAZORPAY-REQUEST] Response received in ${duration}ms for ${endpoint}`);

    if (!response.ok) {
      const error: any = await response.json().catch(() => ({}));
      const errorMsg = error?.error?.description || response.statusText || 'Unknown error';
      console.error(`[RAZORPAY-REQUEST] API error (${response.status}): ${errorMsg}`);
      throw new Error(`Razorpay API error: ${errorMsg}`);
    }

    const result = await response.json();
    console.log(`[RAZORPAY-REQUEST] Success for ${endpoint}`);
    return result;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      console.error(`[RAZORPAY-REQUEST] Timeout after ${timeoutMs}ms for ${endpoint}`);
      throw new Error(`Razorpay API request timeout after ${timeoutMs}ms`);
    }
    console.error(`[RAZORPAY-REQUEST] Error for ${endpoint}:`, error.message);
    throw error;
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
    async create(body: any) {
      return razorpayRequest('/payouts', 'POST', body);
    },
  };

  return {
    request: razorpayRequest,
    getConfig: getRazorpayConfig,
    getAuthHeader: getRazorpayAuthHeader,
    payments,
    payouts,
  };
}

