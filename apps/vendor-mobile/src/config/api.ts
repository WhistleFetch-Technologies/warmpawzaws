/**
 * API Configuration for Vendor Mobile App
 */

// Get from environment or use default
// For React Native, use react-native-config or direct values
// For now, using direct values - replace with actual keys
export const API_BASE_URL = 
  'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475';

export const SUPABASE_URL = 
  'https://vpvpbdwtyugbknrntkho.supabase.co';

export const SUPABASE_ANON_KEY = 
  'your-anon-key-here'; // TODO: Replace with actual anon key

// API Endpoints
export const API_ENDPOINTS = {
  // Vendor endpoints
  vendor: {
    dashboard: `${API_BASE_URL}/vendor/dashboard`,
    profile: `${API_BASE_URL}/vendor/profile`,
    bookings: `${API_BASE_URL}/vendor/bookings`,
    services: `${API_BASE_URL}/vendor/services`,
    staff: `${API_BASE_URL}/vendor/staff`,
  },
  // Service endpoints
  services: {
    list: `${API_BASE_URL}/vendor/:vendorId/services`,
    detail: `${API_BASE_URL}/vendor/services/:serviceId`,
    create: `${API_BASE_URL}/vendor/services`,
    update: `${API_BASE_URL}/vendor/services/:serviceId`,
    delete: `${API_BASE_URL}/vendor/services/:serviceId`,
  },
  // Staff endpoints
  staff: {
    list: `${API_BASE_URL}/vendor/:vendorId/staff`,
    detail: `${API_BASE_URL}/staff/:staffId`,
    create: `${API_BASE_URL}/vendor/staff`,
    update: `${API_BASE_URL}/staff/:staffId`,
    delete: `${API_BASE_URL}/staff/:staffId`,
  },
};

