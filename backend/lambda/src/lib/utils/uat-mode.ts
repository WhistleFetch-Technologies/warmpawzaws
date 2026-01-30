/**
 * UAT Mode Utility
 * 
 * Detects if the application is running in UAT/Development mode
 * Similar to how OTP uses '123456' in UAT mode
 */

export interface UATContext {
  isUAT: boolean;
  headers?: Record<string, string>;
}

/**
 * Check if UAT mode is enabled
 * Checks both environment variables and request headers
 */
export function isUATMode(context?: UATContext): boolean {
  // Check environment variables
  const envUAT = process.env.UAT_MODE === 'true' || 
                 process.env.NODE_ENV === 'development' || 
                 process.env.NODE_ENV === 'dev';
  
  // Check request headers (if context provided)
  // Headers are normalized to lowercase, so check both lowercase and original case
  const headerUAT = context?.headers && (
    context.headers['x-uat-mode'] === 'true' ||
    context.headers['X-UAT-Mode'] === 'true' ||
    context.headers['x-uat-mode'] === 'True' ||
    context.headers['X-UAT-Mode'] === 'True'
  );
  
  const result = envUAT || headerUAT || false;
  
  // Debug logging
  if (context?.headers) {
    console.log('[isUATMode] Check:', {
      envUAT,
      headerUAT,
      result,
      headers: Object.keys(context.headers),
      xUatModeValue: context.headers['x-uat-mode'],
      XUatModeValue: context.headers['X-UAT-Mode']
    });
  }
  
  return result;
}

/**
 * Get UAT mode status with details
 */
export function getUATModeStatus(context?: UATContext): {
  isUAT: boolean;
  source: 'env' | 'header' | 'none';
} {
  const envUAT = process.env.UAT_MODE === 'true' || process.env.NODE_ENV === 'development';
  const headerUAT = context?.headers && (
    context.headers['x-uat-mode'] === 'true' ||
    context.headers['X-UAT-Mode'] === 'true'
  );
  
  if (headerUAT) {
    return { isUAT: true, source: 'header' };
  }
  if (envUAT) {
    return { isUAT: true, source: 'env' };
  }
  return { isUAT: false, source: 'none' };
}
