/**
 * UAT Mode Utility
 * 
 * Detects if the application is running in UAT/Development mode
 * SECURITY: Only checks UAT_MODE environment variable to prevent PROD bypass
 */

export interface UATContext {
  isUAT: boolean;
  headers?: Record<string, string>;
}

/**
 * Check if UAT mode is enabled
 * ONLY checks UAT_MODE environment variable - headers are NOT trusted for security
 */
export function isUATMode(context?: UATContext): boolean {
  // SECURITY: Only check UAT_MODE env variable, never headers or NODE_ENV
  // This ensures PROD (UAT_MODE=false) is never bypassed
  const result = process.env.UAT_MODE === 'true';
  
  // Debug logging
  if (context?.headers) {
    console.log('[isUATMode] Check:', {
      UAT_MODE: process.env.UAT_MODE,
      result,
    });
  }
  
  return result;
}

/**
 * Get UAT mode status with details
 */
export function getUATModeStatus(context?: UATContext): {
  isUAT: boolean;
  source: 'env' | 'none';
} {
  // SECURITY: Only check UAT_MODE env variable
  const envUAT = process.env.UAT_MODE === 'true';
  
  if (envUAT) {
    return { isUAT: true, source: 'env' };
  }
  return { isUAT: false, source: 'none' };
}
