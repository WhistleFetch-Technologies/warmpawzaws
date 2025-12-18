/**
 * API Configuration for Vendor Mobile App
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
  let key: string | undefined;
  
  try {
    if (typeof process !== 'undefined' && process.env) {
      key = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    }
  } catch (e) {
    // process.env not available
  }
  
  if (!key && typeof window !== 'undefined') {
    const windowEnv = (window as any).__ENV__;
    if (windowEnv) {
      key = windowEnv.SUPABASE_ANON_KEY || windowEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    }
  }
  
  if (!key) {
    if (__DEV__) {
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

// Export for backward compatibility (lazy evaluation)
// This will be evaluated on first access, not at module load time
export const publicAnonKey = getPublicAnonKey();

export const API_BASE_URL = 
  `${SUPABASE_URL}/functions/v1/make-server-3dd53475`;

// API Endpoints for Vendor
export const API_ENDPOINTS = {
  // Vendor endpoints
  vendor: {
    profile: `${API_BASE_URL}/vendor/profile`,
    application: `${API_BASE_URL}/vendor/application`,
    status: `${API_BASE_URL}/vendor/status`,
    onboarding: `${API_BASE_URL}/vendor/onboarding`,
  },
  // Booking endpoints
  booking: {
    list: `${API_BASE_URL}/vendor/bookings`,
    detail: `${API_BASE_URL}/vendor/booking/:bookingId`,
    update: `${API_BASE_URL}/vendor/booking/:bookingId/update`,
    accept: `${API_BASE_URL}/vendor/booking/:bookingId/accept`,
    reject: `${API_BASE_URL}/vendor/booking/:bookingId/reject`,
  },
  // Service endpoints
  services: {
    list: `${API_BASE_URL}/vendor/services`,
    create: `${API_BASE_URL}/vendor/services/create`,
    update: `${API_BASE_URL}/vendor/services/:serviceId`,
  },
  // Staff endpoints
  staff: {
    list: `${API_BASE_URL}/vendor/staff`,
    create: `${API_BASE_URL}/vendor/staff/create`,
    update: `${API_BASE_URL}/vendor/staff/:staffId`,
  },
  // Schedule endpoints
  schedule: {
    get: `${API_BASE_URL}/vendor/schedule`,
    update: `${API_BASE_URL}/vendor/schedule/update`,
  },
};

