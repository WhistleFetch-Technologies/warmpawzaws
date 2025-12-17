/**
 * Device & Platform Detection Utility
 * Detects device type, platform, and app context for proper token expiry configuration
 */

export type DeviceType = 'mobile' | 'web';
export type Platform = 'ios' | 'android' | 'web';
export type AppType = 'customer' | 'vendor' | 'admin';

export interface DeviceInfo {
  deviceType: DeviceType;
  platform: Platform;
  isMobile: boolean;
  isWeb: boolean;
  userAgent: string;
  appType?: AppType; // Determined from context/routing
}

/**
 * Detect device type from user agent
 */
export function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined') {
    // Server-side or no window object
    return {
      deviceType: 'web',
      platform: 'web',
      isMobile: false,
      isWeb: true,
      userAgent: ''
    };
  }

  const userAgent = window.navigator.userAgent || '';
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  let platform: Platform = 'web';
  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    platform = 'ios';
  } else if (/Android/i.test(userAgent)) {
    platform = 'android';
  }

  return {
    deviceType: isMobile ? 'mobile' : 'web',
    platform,
    isMobile,
    isWeb: !isMobile,
    userAgent
  };
}

/**
 * Detect app type from current route/path
 */
export function detectAppType(): AppType | undefined {
  if (typeof window === 'undefined') return undefined;

  const path = window.location.pathname;
  
  if (path.includes('/admin') || path.includes('/Admin')) {
    return 'admin';
  } else if (path.includes('/vendor') || path.includes('/Vendor')) {
    return 'vendor';
  } else if (path.includes('/customer') || path.includes('/Customer')) {
    return 'customer';
  }
  
  return undefined;
}

/**
 * Get complete device and app context
 */
export function getDeviceContext(): DeviceInfo {
  const deviceInfo = detectDevice();
  const appType = detectAppType();
  
  return {
    ...deviceInfo,
    appType
  };
}

/**
 * Check if running in mobile app (React Native, Capacitor, etc.)
 * This can be enhanced to detect specific mobile app frameworks
 */
export function isMobileApp(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Check for React Native
  if ((window as any).ReactNativeWebView) return true;
  
  // Check for Capacitor
  if ((window as any).Capacitor) return true;
  
  // Check for Cordova
  if ((window as any).cordova) return true;
  
  // Check user agent for mobile app indicators
  const ua = window.navigator.userAgent;
  if (ua.includes('WarmpawzApp') || ua.includes('warmpawz-app')) {
    return true;
  }
  
  return false;
}

/**
 * Determine if current context is mobile app vs mobile web
 */
export function isMobileAppContext(): boolean {
  const deviceInfo = detectDevice();
  if (!deviceInfo.isMobile) return false;
  
  // If explicitly mobile app
  if (isMobileApp()) return true;
  
  // Check localStorage for app flag (set by mobile app on launch)
  if (typeof window !== 'undefined') {
    const appFlag = localStorage.getItem('warmpawz_app_type');
    if (appFlag === 'mobile_app') return true;
  }
  
  return false;
}

