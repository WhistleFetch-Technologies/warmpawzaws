/**
 * Environment Sync Helper
 * Dynamically reads from Admin Portal KV store and syncs to environment variables
 * This ensures .env files stay in sync with UI endpoint changes
 */

import * as kv from "./kv_store.tsx";

/**
 * Get environment variable from KV store (Admin Portal) or fallback to Deno.env
 */
export async function getEnvVar(key: string, fallback?: string): Promise<string> {
  // Map environment variable keys to KV store keys
  const kvKeyMap: Record<string, string> = {
    'VITE_GOOGLE_MAPS_API_KEY': 'platform:settings:google_maps',
    'AWS_ACCESS_KEY_ID': 'platform:settings:aws',
    'AWS_SECRET_ACCESS_KEY': 'platform:settings:aws',
    'AWS_REGION': 'platform:settings:aws',
    'RAZORPAY_KEY_ID': 'platform:settings:payment_gateway',
    'RAZORPAY_KEY_SECRET': 'platform:settings:payment_gateway',
    'RAZORPAY_WEBHOOK_SECRET': 'platform:settings:payment_gateway',
  };

  const kvKey = kvKeyMap[key];
  
  if (kvKey) {
    try {
      const settings = await kv.get(kvKey);
      
      if (settings) {
        // Extract value based on key
        switch (key) {
          case 'VITE_GOOGLE_MAPS_API_KEY':
            return settings.apiKey || fallback || '';
          
          case 'AWS_ACCESS_KEY_ID':
            return settings.credentials?.accessKeyId || fallback || '';
          
          case 'AWS_SECRET_ACCESS_KEY':
            return settings.credentials?.secretAccessKey || fallback || '';
          
          case 'AWS_REGION':
            return settings.credentials?.region || settings.region || fallback || 'ap-south-1';
          
          case 'RAZORPAY_KEY_ID':
            return settings.razorpay?.key_id || settings.razorpay?.keyId || fallback || '';
          
          case 'RAZORPAY_KEY_SECRET':
            return settings.razorpay?.key_secret || settings.razorpay?.keySecret || fallback || '';
          
          case 'RAZORPAY_WEBHOOK_SECRET':
            return settings.razorpay?.webhook_secret || settings.razorpay?.webhookSecret || fallback || '';
        }
      }
    } catch (error) {
      console.error(`[ENV-SYNC] Error reading ${kvKey}:`, error);
    }
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
