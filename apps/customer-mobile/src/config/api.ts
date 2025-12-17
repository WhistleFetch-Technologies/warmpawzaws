/**
 * API Configuration for Customer Mobile App
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

