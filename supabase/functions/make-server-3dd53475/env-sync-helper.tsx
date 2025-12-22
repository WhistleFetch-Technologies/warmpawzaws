/**
 * Environment Sync Helper
 * Dynamically reads from Admin Portal SQL database and syncs to environment variables
 * This ensures .env files stay in sync with UI endpoint changes
 * ✅ MIGRATED: Now uses SQL instead of KV store
 */

import { getPlatformSettingsRepository } from "../../lib/repositories/platform-settings.ts";

/**
 * Get environment variable from SQL database (Admin Portal) or fallback to Deno.env
 */
export async function getEnvVar(key: string, fallback?: string): Promise<string> {
  try {
    const settingsRepo = getPlatformSettingsRepository();
    
    // Extract value based on key
    switch (key) {
      case 'VITE_GOOGLE_MAPS_API_KEY': {
        const googleMaps = await settingsRepo.getGoogleMapsSettings();
        return googleMaps?.api_key || fallback || '';
      }
      
      case 'AWS_ACCESS_KEY_ID': {
        const aws = await settingsRepo.getAWSSettings();
        return aws?.credentials?.accessKeyId || fallback || '';
      }
      
      case 'AWS_SECRET_ACCESS_KEY': {
        const aws = await settingsRepo.getAWSSettings();
        return aws?.credentials?.secretAccessKey || fallback || '';
      }
      
      case 'AWS_REGION': {
        const aws = await settingsRepo.getAWSSettings();
        return aws?.credentials?.region || fallback || 'ap-south-1';
      }
      
      case 'RAZORPAY_KEY_ID': {
        const payment = await settingsRepo.getPaymentGatewaySettings('razorpay');
        return payment?.key_id || fallback || '';
      }
      
      case 'RAZORPAY_KEY_SECRET': {
        const payment = await settingsRepo.getPaymentGatewaySettings('razorpay');
        return payment?.key_secret || fallback || '';
      }
      
      case 'RAZORPAY_WEBHOOK_SECRET': {
        const payment = await settingsRepo.getPaymentGatewaySettings('razorpay');
        return payment?.webhook_secret || fallback || '';
      }
    }
  } catch (error) {
    console.error(`[ENV-SYNC] Error reading ${key}:`, error);
  }
  
  // Fallback to Deno.env
  return Deno.env.get(key) || fallback || '';
}

/**
 * Get all environment variables synced from Admin Portal
 */
export async function getAllSyncedEnvVars(): Promise<Record<string, string>> {
  return {
    VITE_GOOGLE_MAPS_API_KEY: await getEnvVar('VITE_GOOGLE_MAPS_API_KEY'),
    AWS_ACCESS_KEY_ID: await getEnvVar('AWS_ACCESS_KEY_ID'),
    AWS_SECRET_ACCESS_KEY: await getEnvVar('AWS_SECRET_ACCESS_KEY'),
    AWS_REGION: await getEnvVar('AWS_REGION'),
    RAZORPAY_KEY_ID: await getEnvVar('RAZORPAY_KEY_ID'),
    RAZORPAY_KEY_SECRET: await getEnvVar('RAZORPAY_KEY_SECRET'),
    RAZORPAY_WEBHOOK_SECRET: await getEnvVar('RAZORPAY_WEBHOOK_SECRET'),
  };
}

/**
 * Export current settings as .env file format
 */
export async function exportEnvFileFormat(): Promise<string> {
  const vars = await getAllSyncedEnvVars();
  
  let envContent = `# ============================================
# AUTO-GENERATED FROM ADMIN PORTAL SETTINGS
# DO NOT EDIT MANUALLY - Changes in Admin Portal will override
# Generated: ${new Date().toISOString()}
# ============================================

# Google Maps API (from Admin Portal > Platform Settings > Integrations > Google Maps)
VITE_GOOGLE_MAPS_API_KEY=${vars.VITE_GOOGLE_MAPS_API_KEY || ''}

# AWS Configuration (from Admin Portal > Platform Settings > Integrations > AWS)
AWS_ACCESS_KEY_ID=${vars.AWS_ACCESS_KEY_ID || ''}
AWS_SECRET_ACCESS_KEY=${vars.AWS_SECRET_ACCESS_KEY || ''}
AWS_REGION=${vars.AWS_REGION || 'ap-south-1'}

# Razorpay Configuration (from Admin Portal > Finance & Logistics > Payment Settings)
RAZORPAY_KEY_ID=${vars.RAZORPAY_KEY_ID || ''}
RAZORPAY_KEY_SECRET=${vars.RAZORPAY_KEY_SECRET || ''}
RAZORPAY_WEBHOOK_SECRET=${vars.RAZORPAY_WEBHOOK_SECRET || ''}
RAZORPAY_MARKETPLACE_MODE=true
`;

  return envContent;
}
