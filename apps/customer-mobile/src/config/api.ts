/**
 * API Configuration for Customer Mobile App
 * Matches web app configuration
 */

// Type declaration for process.env (React Native compatibility)
declare const process: {
  env?: {
    SUPABASE_ANON_KEY?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    [key: string]: string | undefined;
  };
} | undefined;

// Supabase Project Configuration (matching web app)
export const projectId = 'vpvpbdwtyugbknrntkho';

export const SUPABASE_URL = 
  `https://${projectId}.supabase.co`;

// Get publicAnonKey from environment variables
// SECURITY: Never hardcode JWT tokens in source code
// For production, this MUST be set via environment variables
// 
// For React Native/Expo:
// - Use EXPO_PUBLIC_SUPABASE_ANON_KEY for Expo projects
// - Use build-time environment variables for bare React Native
// - Configure via .env files or build settings

// Internal function that actually retrieves the key
const getPublicAnonKeyInternal = (): string => {
  // Try multiple environment variable sources for compatibility
  // Use type-safe checks to avoid TypeScript errors
  let key: string | undefined;
  
  try {
    // Check process.env (available in Node.js and some React Native setups)
    if (typeof process !== 'undefined' && process.env) {
      key = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    }
  } catch (e) {
    // process.env not available, continue to other sources
  }
  
  // Check window.__ENV__ (some bundlers inject env vars here)
  if (!key && typeof window !== 'undefined') {
    const windowEnv = (window as any).__ENV__;
    if (windowEnv) {
      key = windowEnv.SUPABASE_ANON_KEY || windowEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    }
  }
  
  if (!key) {
    if (__DEV__) {
      // In development, throw a clear error
      console.error(
        '⚠️ SUPABASE_ANON_KEY is not set!\n' +
        'Please set it in your .env file or environment variables.\n' +
        'For Expo: Use EXPO_PUBLIC_SUPABASE_ANON_KEY\n' +
        'For React Native: Configure in build settings or .env file'
      );
      throw new Error(
        'SUPABASE_ANON_KEY is not set. Please configure it in your environment variables.'
      );
    } else {
      // In production, throw a generic error (don't expose internal details)
      throw new Error('Configuration error: API key not found');
    }
  }
  
  return key;
};

// Lazy evaluation: Get publicAnonKey when first accessed
// This prevents module initialization crashes if env vars are missing
let cachedPublicAnonKey: string | null = null;

export const getPublicAnonKey = (): string => {
  if (cachedPublicAnonKey === null) {
    cachedPublicAnonKey = getPublicAnonKeyInternal();
  }
  return cachedPublicAnonKey;
};

// Export for backward compatibility (TRUE lazy evaluation)
// Since TypeScript/ES modules don't support getter properties on exports directly,
// we use a Proxy to intercept all property access and provide lazy evaluation.
// This ensures the key is only retrieved when first accessed, not at module load time.
//
// Usage: import { publicAnonKey } from './config/api';
//        const key = publicAnonKey; // Only retrieved here, not at import time
//        const header = `Bearer ${publicAnonKey}`; // Works in template strings
const publicAnonKeyProxy = new Proxy({} as any, {
  get: function(_target, prop) {
    // When any property is accessed, return the actual key value
    const key = getPublicAnonKey();
    // ✅ FIX: Handle primitive conversion for template strings
    // When used in template strings like `${publicAnonKey}`, JavaScript calls:
    // 1. Symbol.toPrimitive (if present)
    // 2. valueOf() (if present)
    // 3. toString() (if present)
    if (prop === Symbol.toPrimitive) {
      // Return a function that will be called during primitive conversion
      return (hint: string) => key;
    }
    if (prop === 'toString') {
      // Return a function that will be called when converting to string
      return () => key;
    }
    if (prop === 'valueOf') {
      // Return a function that will be called when converting to primitive
      return () => key;
    }
    // For any other property access, return the key string directly
    return key;
  },
});

export const publicAnonKey = publicAnonKeyProxy as unknown as string;

export const API_BASE_URL = 
  `${SUPABASE_URL}/functions/v1/make-server-3dd53475`;

// API Endpoints
export const API_ENDPOINTS = {
  // Customer endpoints
  customer: {
    featuredServices: `${API_BASE_URL}/customer/featured-services`,
    bookings: `${API_BASE_URL}/customer/bookings`,
    previousProviders: `${API_BASE_URL}/customer/:customerId/previous-providers`,
    problemSearch: `${API_BASE_URL}/customer/problem-first-search`,
  },
  // Service endpoints
  services: {
    detail: `${API_BASE_URL}/services/:serviceId`,
    search: `${API_BASE_URL}/customer/search-services`,
  },
  // Booking endpoints
  booking: {
    create: `${API_BASE_URL}/booking/create`,
    confirm: `${API_BASE_URL}/booking/:bookingId/confirm`,
    cancel: `${API_BASE_URL}/booking/:bookingId/cancel`,
  },
  // GPS Tracking
  gps: {
    tracking: `${API_BASE_URL}/gps/tracking/:trackingId`,
  },
};

