/**
 * CENTRALIZED RAZORPAY CREDENTIALS HELPER
 * 
 * Fetches Razorpay credentials from platform settings (admin portal)
 * Falls back to environment variables if not found in settings
 * 
 * This ensures single source of truth for payment gateway configuration
 */

import * as kv from "./kv_store.tsx";

/**
 * Get Razorpay credentials from platform settings
 * Priority: Platform Settings → Environment Variables
 */
export async function getRazorpayCredentials(): Promise<{
  keyId: string;
  keySecret: string;
  enabled: boolean;
}> {
  try {
    // 1. PRIMARY: Admin Portal settings (KV store) - Auto-synced from UI
    const paymentGatewaySettings = await kv.get('platform:settings:payment_gateway') ||
                                   await kv.get('admin:settings:payment_gateway') ||
                                   await kv.get('admin:settings:payment');
    
    if (paymentGatewaySettings?.razorpay) {
      const keyId = paymentGatewaySettings.razorpay.key_id || 
                   paymentGatewaySettings.razorpay.keyId || 
                   paymentGatewaySettings.razorpay.apiKey;
      const keySecret = paymentGatewaySettings.razorpay.key_secret || 
                       paymentGatewaySettings.razorpay.keySecret || 
                       paymentGatewaySettings.razorpay.apiSecret;
      
      if (keyId && keySecret) {
        console.log('✅ [RAZORPAY-CREDS] Using credentials from Admin Portal (auto-synced)');
        return {
          keyId,
          keySecret,
          enabled: paymentGatewaySettings.razorpay.enabled !== false
        };
      }
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

