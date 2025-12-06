import { projectId, publicAnonKey } from '../utils/supabase/info';
import type {
  User,
  Customer,
  Vendor,
  Booking,
  VendorApplication,
  FoodSubscription,
  InsurancePolicy,
  MatingRequest,
} from '../types';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

// Generic API client
async function apiCall<T>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  token?: string
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token || publicAnonKey}`,
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, options);
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error (${response.status}): ${error}`);
  }

  return response.json();
}

// User Management
export const userAPI = {
  async getCurrentUser(token: string): Promise<User | null> {
    return apiCall<User>('/users/me', 'GET', undefined, token);
  },

  async updateUser(userId: string, data: Partial<User>, token: string): Promise<User> {
    return apiCall<User>(`/users/${userId}`, 'PATCH', data, token);
  },

  async getUserByPhone(phone: string): Promise<User | null> {
    return apiCall<User>(`/users/phone/${phone}`, 'GET');
  },
};

// Customer Management
export const customerAPI = {
  async getCustomer(customerId: string, token: string): Promise<Customer> {
    return apiCall<Customer>(`/customers/${customerId}`, 'GET', undefined, token);
  },

  async updateCustomer(customerId: string, data: Partial<Customer>, token: string): Promise<Customer> {
    return apiCall<Customer>(`/customers/${customerId}`, 'PATCH', data, token);
  },

  async addPet(customerId: string, petData: any, token: string): Promise<Customer> {
    return apiCall<Customer>(`/customers/${customerId}/pets`, 'POST', petData, token);
  },

  async updatePet(customerId: string, petId: string, petData: any, token: string): Promise<Customer> {
    return apiCall<Customer>(`/customers/${customerId}/pets/${petId}`, 'PATCH', petData, token);
  },

  async deletePet(customerId: string, petId: string, token: string): Promise<void> {
    return apiCall<void>(`/customers/${customerId}/pets/${petId}`, 'DELETE', undefined, token);
  },
};

// Vendor Management
export const vendorAPI = {
  async getVendor(vendorId: string, token: string): Promise<Vendor> {
    return apiCall<Vendor>(`/vendors/${vendorId}`, 'GET', undefined, token);
  },

  async createVendor(vendorData: Partial<Vendor>, token: string): Promise<Vendor> {
    return apiCall<Vendor>('/vendors', 'POST', vendorData, token);
  },

  async updateVendor(vendorId: string, data: Partial<Vendor>, token: string): Promise<Vendor> {
    return apiCall<Vendor>(`/vendors/${vendorId}`, 'PATCH', data, token);
  },

  async getVendorsByService(serviceType: string, location?: { lat: number; lng: number }): Promise<Vendor[]> {
    const params = new URLSearchParams({ serviceType });
    if (location) {
      params.append('lat', location.lat.toString());
      params.append('lng', location.lng.toString());
    }
    return apiCall<Vendor[]>(`/vendors/search?${params}`, 'GET');
  },

  async updateRevenue(vendorId: string, amount: number, token: string): Promise<void> {
    return apiCall<void>(`/vendors/${vendorId}/revenue`, 'POST', { amount }, token);
  },
};

// Admin Management
export const adminAPI = {
  async getAllVendorApplications(token: string): Promise<VendorApplication[]> {
    return apiCall<VendorApplication[]>('/admin/vendor-applications', 'GET', undefined, token);
  },

  async getVendorApplication(applicationId: string, token: string): Promise<VendorApplication> {
    return apiCall<VendorApplication>(`/admin/vendor-applications/${applicationId}`, 'GET', undefined, token);
  },

  async approveVendor(vendorId: string, adminNotes: string, token: string): Promise<Vendor> {
    return apiCall<Vendor>(`/admin/vendors/${vendorId}/approve`, 'POST', { adminNotes }, token);
  },

  async rejectVendor(vendorId: string, reason: string, token: string): Promise<Vendor> {
    return apiCall<Vendor>(`/admin/vendors/${vendorId}/reject`, 'POST', { reason }, token);
  },

  async suspendVendor(vendorId: string, reason: string, token: string): Promise<Vendor> {
    return apiCall<Vendor>(`/admin/vendors/${vendorId}/suspend`, 'POST', { reason }, token);
  },

  async getAllVendors(status?: string, token?: string): Promise<Vendor[]> {
    const params = status ? `?status=${status}` : '';
    return apiCall<Vendor[]>(`/admin/vendors${params}`, 'GET', undefined, token);
  },

  async getAnalytics(token: string): Promise<any> {
    return apiCall<any>('/admin/analytics', 'GET', undefined, token);
  },
};

// Booking Management
export const bookingAPI = {
  async createBooking(bookingData: Partial<Booking>, token: string): Promise<Booking> {
    return apiCall<Booking>('/bookings', 'POST', bookingData, token);
  },

  async getBooking(bookingId: string, token: string): Promise<Booking> {
    return apiCall<Booking>(`/bookings/${bookingId}`, 'GET', undefined, token);
  },

  async getCustomerBookings(customerId: string, token: string): Promise<Booking[]> {
    return apiCall<Booking[]>(`/bookings/customer/${customerId}`, 'GET', undefined, token);
  },

  async getVendorBookings(vendorId: string, token: string): Promise<Booking[]> {
    return apiCall<Booking[]>(`/bookings/vendor/${vendorId}`, 'GET', undefined, token);
  },

  async updateBookingStatus(bookingId: string, status: string, token: string): Promise<Booking> {
    return apiCall<Booking>(`/bookings/${bookingId}/status`, 'PATCH', { status }, token);
  },

  async cancelBooking(bookingId: string, reason: string, token: string): Promise<Booking> {
    return apiCall<Booking>(`/bookings/${bookingId}/cancel`, 'POST', { reason }, token);
  },

  async rateBooking(bookingId: string, rating: number, review: string, token: string): Promise<Booking> {
    return apiCall<Booking>(`/bookings/${bookingId}/rate`, 'POST', { rating, review }, token);
  },
};

// Subscription Management
export const subscriptionAPI = {
  async createSubscription(subscriptionData: Partial<FoodSubscription>, token: string): Promise<FoodSubscription> {
    return apiCall<FoodSubscription>('/subscriptions', 'POST', subscriptionData, token);
  },

  async getCustomerSubscriptions(customerId: string, token: string): Promise<FoodSubscription[]> {
    return apiCall<FoodSubscription[]>(`/subscriptions/customer/${customerId}`, 'GET', undefined, token);
  },

  async updateSubscription(subscriptionId: string, data: Partial<FoodSubscription>, token: string): Promise<FoodSubscription> {
    return apiCall<FoodSubscription>(`/subscriptions/${subscriptionId}`, 'PATCH', data, token);
  },

  async pauseSubscription(subscriptionId: string, token: string): Promise<FoodSubscription> {
    return apiCall<FoodSubscription>(`/subscriptions/${subscriptionId}/pause`, 'POST', undefined, token);
  },

  async cancelSubscription(subscriptionId: string, token: string): Promise<void> {
    return apiCall<void>(`/subscriptions/${subscriptionId}`, 'DELETE', undefined, token);
  },
};

// Insurance Management
export const insuranceAPI = {
  async getPolicies(customerId: string, token: string): Promise<InsurancePolicy[]> {
    return apiCall<InsurancePolicy[]>(`/insurance/customer/${customerId}`, 'GET', undefined, token);
  },

  async createPolicy(policyData: Partial<InsurancePolicy>, token: string): Promise<InsurancePolicy> {
    return apiCall<InsurancePolicy>('/insurance', 'POST', policyData, token);
  },
};

// Mating & Dating Management
export const matingAPI = {
  async createRequest(requestData: Partial<MatingRequest>, token: string): Promise<MatingRequest> {
    return apiCall<MatingRequest>('/mating-requests', 'POST', requestData, token);
  },

  async getMatches(requestId: string, token: string): Promise<MatingRequest[]> {
    return apiCall<MatingRequest[]>(`/mating-requests/${requestId}/matches`, 'GET', undefined, token);
  },

  async getCustomerRequests(customerId: string, token: string): Promise<MatingRequest[]> {
    return apiCall<MatingRequest[]>(`/mating-requests/customer/${customerId}`, 'GET', undefined, token);
  },
};
