/**
 * CENTRALIZED RAZORPAY CREDENTIALS HELPER
 * 
 * Fetches Razorpay credentials from platform settings (SQL database)
 * Falls back to environment variables if not found in settings
 * 
 * This ensures single source of truth for payment gateway configuration
 * ✅ MIGRATED: Now uses SQL instead of KV store
 */

import { getPlatformSettingsRepository } from "../../lib/repositories/platform-settings.ts";

/**
 * Get Razorpay credentials from platform settings
 * Priority: Platform Settings (SQL) → Environment Variables
 */
export async function getRazorpayCredentials(): Promise<{
  keyId: string;
  keySecret: string;
  enabled: boolean;
}> {
  try {
    // 1. PRIMARY: Admin Portal settings (SQL database) - Auto-synced from UI
    const settingsRepo = getPlatformSettingsRepository();
    const paymentGatewaySettings = await settingsRepo.getPaymentGatewaySettings('razorpay');
    
    if (paymentGatewaySettings && paymentGatewaySettings.key_id && paymentGatewaySettings.key_secret) {
      console.log('✅ [RAZORPAY-CREDS] Using credentials from Admin Portal (SQL)');
      return {
        keyId: paymentGatewaySettings.key_id,
        keySecret: paymentGatewaySettings.key_secret,
        enabled: paymentGatewaySettings.enabled !== false
      };
    }
    
    // 2. FALLBACK: Environment variables (for deployment/CI)
    const envKeyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
    const envKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
    
    if (envKeyId && envKeySecret) {
      console.log('⚠️ [RAZORPAY-CREDS] Using credentials from environment variables (fallback)');
      return {
        keyId: envKeyId,
        keySecret: envKeySecret,
        enabled: true
      };
    }
    
    // 3. No credentials found
    console.error('❌ [RAZORPAY-CREDS] No Razorpay credentials found in Admin Portal or environment');
    return {
      keyId: '',
      keySecret: '',
      enabled: false
    };
    
  } catch (error) {
    console.error('❌ [RAZORPAY-CREDS] Error fetching credentials:', error);
    
    // Fallback to environment variables on error
    const envKeyId = Deno.env.get('RAZORPAY_KEY_ID') || '';
    const envKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || '';
    
    return {
      keyId: envKeyId,
      keySecret: envKeySecret,
      enabled: !!(envKeyId && envKeySecret)
    };
  }
}

/**
 * Get Razorpay API base URL
 */
export function getRazorpayApiBase(): string {
  return 'https://api.razorpay.com/v1';
}

/**
 * Get Razorpay authorization header
 */
export async function getRazorpayAuthHeader(): Promise<string> {
  const credentials = await getRazorpayCredentials();
  
  if (!credentials.keyId || !credentials.keySecret) {
    throw new Error('Razorpay credentials not configured');
  }
  
  const auth = btoa(`${credentials.keyId}:${credentials.keySecret}`);
  return `Basic ${auth}`;
}

/**
 * Validate Razorpay credentials are configured
 */
export async function validateRazorpayCredentials(): Promise<boolean> {
  const credentials = await getRazorpayCredentials();
  return credentials.enabled && !!credentials.keyId && !!credentials.keySecret;
}

