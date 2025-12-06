import { projectId, publicAnonKey } from '../supabase/info';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = 'https://vpvpbdwtyugbknrntkho.supabase.co/functions/v1/make-server-3dd53475';
const supabase = createClient(`https://${projectId}.supabase.co`, publicAnonKey);

interface ApiOptions {
  method?: string;
  body?: any;
  requiresAuth?: boolean;
}

export async function apiCall(endpoint: string, options: ApiOptions = {}) {
  const { method = 'GET', body, requiresAuth = true } = options;

  let headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (requiresAuth) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }
    headers['Authorization'] = `Bearer ${session.access_token}`;
  } else {
    headers['Authorization'] = `Bearer ${publicAnonKey}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

// Region APIs
export const regionApi = {
  getAll: () => apiCall('/regions'),
  getById: (id: string) => apiCall(`/regions/${id}`),
  create: (data: any) => apiCall('/regions', { method: 'POST', body: data }),
  update: (id: string, data: any) => apiCall(`/regions/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => apiCall(`/regions/${id}`, { method: 'DELETE' }),
  getCatalog: (id: string) => apiCall(`/regions/${id}/catalog`),
  updateCatalog: (id: string, data: any) => apiCall(`/regions/${id}/catalog`, { method: 'POST', body: data }),
};

// Service Catalog APIs
export const catalogApi = {
  getServices: () => apiCall('/catalog/services'),
  getServiceById: (id: string) => apiCall(`/catalog/services/${id}`),
  createService: (data: any) => apiCall('/catalog/services', { method: 'POST', body: data }),
  updateService: (id: string, data: any) => apiCall(`/catalog/services/${id}`, { method: 'PUT', body: data }),
  deleteService: (id: string) => apiCall(`/catalog/services/${id}`, { method: 'DELETE' }),
  getCategories: () => apiCall('/catalog/categories'),
  createCategory: (data: any) => apiCall('/catalog/categories', { method: 'POST', body: data }),
};

// Booking APIs
export const bookingApi = {
  getById: (id: string) => apiCall(`/bookings/${id}`),
  generateOTP: (id: string, type: 'start' | 'complete') => 
    apiCall(`/bookings/${id}/otp/generate`, { method: 'POST', body: { type } }),
  verifyOTP: (id: string, otp: string, type: 'start' | 'complete') => 
    apiCall(`/bookings/${id}/otp/verify`, { method: 'POST', body: { otp, type } }),
  updateStatus: (id: string, status: string, note?: string) => 
    apiCall(`/bookings/${id}/status`, { method: 'POST', body: { status, note } }),
  getVendorBookings: (vendorId: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiCall(`/bookings/vendor/${vendorId}${query}`);
  },
  getCustomerBookings: (customerId: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return apiCall(`/bookings/customer/${customerId}${query}`);
  },
};

// Tracking APIs
export const trackingApi = {
  getActive: () => apiCall('/tracking/active'),
  getByBooking: (id: string) => apiCall(`/tracking/${id}`),
  updateLocation: (id: string, location: { lat: number; lng: number; accuracy: number; timestamp: string }) =>
    apiCall(`/tracking/${id}/update`, { method: 'POST', body: location }),
  getHistory: (id: string) => apiCall(`/tracking/${id}/history`),
};

// Search APIs
export const searchApi = {
  vendors: (params: any) => apiCall('/search/vendors', { method: 'POST', body: params }),
  nearby: (params: any) => apiCall('/search/vendors/nearby', { method: 'POST', body: params }),
  topRated: (limit?: number, serviceType?: string) => {
    const query = new URLSearchParams();
    if (limit) query.append('limit', limit.toString());
    if (serviceType) query.append('serviceType', serviceType);
    return apiCall(`/search/vendors/top-rated?${query.toString()}`);
  },
  categories: () => apiCall('/search/categories'),
};

// Analytics APIs
export const analyticsApi = {
  vendorDashboard: (vendorId: string) => apiCall(`/analytics/vendor/${vendorId}/dashboard`),
  customerDashboard: (customerId: string) => apiCall(`/analytics/customer/${customerId}/dashboard`),
  platformStats: () => apiCall('/analytics/admin/platform'),
  vendorRevenue: (vendorId: string, period?: string) => {
    const query = period ? `?period=${period}` : '';
    return apiCall(`/analytics/vendor/${vendorId}/revenue${query}`);
  },
};

// Pet APIs
export const petApi = {
  create: (data: any) => apiCall('/pets/create', { method: 'POST', body: data }),
  getById: (id: string) => apiCall(`/pets/${id}`),
  getCustomerPets: (customerId: string) => apiCall(`/pets/customer/${customerId}`),
  update: (id: string, data: any) => apiCall(`/pets/${id}`, { method: 'PUT', body: data }),
  delete: (id: string) => apiCall(`/pets/${id}`, { method: 'DELETE' }),
  addMedicalRecord: (id: string, data: any) => 
    apiCall(`/pets/${id}/medical-record`, { method: 'POST', body: data }),
  addVaccination: (id: string, data: any) => 
    apiCall(`/pets/${id}/vaccination`, { method: 'POST', body: data }),
};

// Payment APIs
export const paymentApi = {
  process: (data: any) => apiCall('/payments/process', { method: 'POST', body: data }),
  getById: (id: string) => apiCall(`/payments/${id}`),
  refund: (id: string, amount: number, reason: string, refundedBy: string) =>
    apiCall(`/payments/${id}/refund`, { method: 'POST', body: { amount, reason, refundedBy } }),
  getCustomerHistory: (customerId: string) => apiCall(`/payments/customer/${customerId}`),
  getVendorHistory: (vendorId: string) => apiCall(`/payments/vendor/${vendorId}`),
  getVendorEarnings: (vendorId: string) => apiCall(`/payments/vendor/${vendorId}/earnings`),
};

// Review APIs
export const reviewApi = {
  create: (data: any) => apiCall('/reviews/create', { method: 'POST', body: data }),
  getById: (id: string) => apiCall(`/reviews/${id}`),
  getVendorReviews: (vendorId: string, status?: string, limit?: number) => {
    const query = new URLSearchParams();
    if (status) query.append('status', status);
    if (limit) query.append('limit', limit.toString());
    return apiCall(`/reviews/vendor/${vendorId}?${query.toString()}`);
  },
  getVendorSummary: (vendorId: string) => apiCall(`/reviews/vendor/${vendorId}/summary`),
  respond: (id: string, vendorId: string, response: string) =>
    apiCall(`/reviews/${id}/respond`, { method: 'POST', body: { vendorId, response } }),
};
