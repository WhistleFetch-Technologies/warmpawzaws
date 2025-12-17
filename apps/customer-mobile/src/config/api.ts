/**
 * API Configuration for Customer Mobile App
 * Matches web app configuration
 */

// Supabase Project Configuration (matching web app)
export const projectId = 'vpvpbdwtyugbknrntkho';

export const SUPABASE_URL = 
  `https://${projectId}.supabase.co`;

// Get publicAnonKey from environment or use default
// For production, this should come from environment variables
// Matching web app configuration
export const publicAnonKey = process.env.SUPABASE_ANON_KEY || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdnBiZHd0eXVnYmtucm50a2hvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI4NDU4MjEsImV4cCI6MjA3ODQyMTgyMX0.z9Qo6ce4-y47Z-Q-lTRgRHUXBuERSFcplHuPypzgRbM';

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

