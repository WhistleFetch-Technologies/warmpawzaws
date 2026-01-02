/**
 * CENTRALIZED RAZORPAY CREDENTIALS HELPER
 * 
 * Fetches Razorpay credentials from platform settings (admin portal)
 * Falls back to environment variables if not found in settings
 * 
 * This ensures single source of truth for payment gateway configuration
 */

// ✅ SQL MIGRATION: All KV operations replaced with SQL repositories
import { getPlatformSettingsRepository } from '../../../supabase/lib/repositories/index';

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
    // ✅ SQL: Get from platform settings (admin portal) - PRIMARY SOURCE
    const platformSettingsRepo = getPlatformSettingsRepository();
    const paymentGatewaySettings = await platformSettingsRepo.getPaymentGatewaySettings();
    
    if (paymentGatewaySettings?.razorpay) {
      // Support multiple field name variations
      const razorpayConfig = paymentGatewaySettings.razorpay;
      const keyId = razorpayConfig.key_id || razorpayConfig.keyId || razorpayConfig.apiKey;
      const keySecret = razorpayConfig.key_secret || razorpayConfig.keySecret || razorpayConfig.apiSecret;
      
      if (keyId && keySecret) {
        console.log('✅ [RAZORPAY-CREDS] Using credentials from platform settings');
        return {
          keyId,
          keySecret,
          enabled: razorpayConfig.enabled !== false
        };
      }
    }
    
    // 2. Fallback to environment variables
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
    console.error('❌ [RAZORPAY-CREDS] No Razorpay credentials found in platform settings or environment');
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

