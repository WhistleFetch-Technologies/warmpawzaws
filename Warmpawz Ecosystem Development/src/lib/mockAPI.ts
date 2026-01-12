/**
 * =====================================================
 * WARMPAWZ MOCK API SYSTEM
 * =====================================================
 * Mock API functions to replace all Supabase/Backend calls
 * Provides realistic async behavior with delays
 * Handles all CRUD operations on mock data
 * 
 * Usage: Import and use instead of fetch/supabase calls
 * =====================================================
 */

import {
  MOCK_CUSTOMERS,
  MOCK_VENDORS,
  MOCK_PETS,
  MOCK_ADDRESSES,
  MOCK_VENDOR_ROLES,
  type Customer,
  type Vendor,
  type Pet,
  type Address,
  type VendorRole,
  type User,
  type Admin
} from './mockData';

import {
  MOCK_SERVICES,
  MOCK_STAFF,
  MOCK_BOOKINGS,
  MOCK_PACKAGES,
  MOCK_PRODUCTS,
  MOCK_ORDERS,
  MOCK_ADMINS,
  EXPANDED_SERVICES,
  EXPANDED_PRODUCTS,
  MOCK_COUPONS,
  MOCK_BUNDLE_DEALS,
  PROMO_BANNERS,
  MOCK_INSURANCE_PLANS,
  MOCK_CAFE_TABLES,
  MOCK_CAFE_MENU,
  MOCK_RESORT_ROOMS,
  type Service,
  type Staff,
  type Booking,
  type Package,
  type Product,
  type Order,
  type Coupon,
  type BundleDeal,
  type PromoBanner
} from './mockDataExtended';

// =====================================================
// CONFIGURATION
// =====================================================

const MOCK_DELAY = 300; // ms - simulate network delay
const USE_LOCAL_STORAGE = true; // Persist data in localStorage

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const delay = (ms: number = MOCK_DELAY) => new Promise(resolve => setTimeout(resolve, ms));

const generateId = (prefix: string = 'id') => {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// LocalStorage helpers
const getFromStorage = (key: string, defaultValue: any): any => {
  if (!USE_LOCAL_STORAGE || typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(`warmpawz_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setToStorage = (key: string, value: any): void => {
  if (!USE_LOCAL_STORAGE || typeof window === 'undefined') return;
  try {
    localStorage.setItem(`warmpawz_${key}`, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
};

// Initialize data from localStorage or defaults
let customers = getFromStorage('customers', MOCK_CUSTOMERS);
let vendors = getFromStorage('vendors', MOCK_VENDORS);
let pets = getFromStorage('pets', MOCK_PETS);
let addresses = getFromStorage('addresses', MOCK_ADDRESSES);
// Merge base services with expanded services
let services = getFromStorage('services', [...MOCK_SERVICES, ...EXPANDED_SERVICES]);
let staff = getFromStorage('staff', MOCK_STAFF);
let bookings = getFromStorage('bookings', MOCK_BOOKINGS);
let packages = getFromStorage('packages', MOCK_PACKAGES);
// Merge base products with expanded products
let products = getFromStorage('products', [...MOCK_PRODUCTS, ...EXPANDED_PRODUCTS]);
let orders = getFromStorage('orders', MOCK_ORDERS);
let admins = getFromStorage('admins', MOCK_ADMINS);
// Add coupons and bundles
let coupons = getFromStorage('coupons', MOCK_COUPONS);
let bundleDeals = getFromStorage('bundleDeals', MOCK_BUNDLE_DEALS);
let promoBanners = getFromStorage('promoBanners', PROMO_BANNERS);

// Current user session
let currentUser: User | null = null;

// =====================================================
// UTILITY FUNCTIONS FOR SEARCH
// =====================================================

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// =====================================================
// AUTHENTICATION API
// =====================================================

export const mockAuthAPI = {
  // ... (keeping existing implementation)
  async generateOTP(phone: string) { await delay(); return { success: true, otp: '123456' }; },
  async verifyOTP(phone: string, otp: string) { await delay(); return { success: true, customer: { id: 'cust_new', phone }, sessionToken: 'token' }; },
  async signIn(phone: string, password: string) { await delay(); return { success: true, user: { id: 'user_1', phone }, token: 'token' }; },
  async signUp(data: any) { await delay(); return { success: true, user: { id: 'user_new', ...data } }; },
  async getSession() { await delay(100); return { user: currentUser }; },
  async logout() { await delay(100); currentUser = null; return { success: true }; }
};

// =====================================================
// CUSTOMER API
// =====================================================

export const mockCustomerAPI = {
  // ... (keeping existing implementation)
  async getProfile(customerId: string) { await delay(); return customers.find((c: any) => c.id === customerId); },
  async updateProfile(customerId: string, updates: any) { await delay(); return { id: customerId, ...updates }; },
  async getPets(customerId: string) { await delay(); return pets.filter((p: any) => p.owner_id === customerId); },
  async addPet(petData: any) { await delay(); return { id: generateId('pet'), ...petData }; },
  async updatePet(petId: string, updates: any) { await delay(); return { id: petId, ...updates }; },
  async getAddresses(customerId: string) { await delay(); return addresses.filter((a: any) => a.user_id === customerId); },
  async addAddress(addressData: any) { await delay(); return { id: generateId('addr'), ...addressData }; },
  async updateWalletBalance(customerId: string, amount: number) { await delay(); return amount; },
  async getPetMedicalDocuments(petId: string) { await delay(); return []; },
  async uploadPetMedicalDocument(petId: string, data: any) { await delay(); return { id: generateId('doc'), ...data }; },
  async deletePetMedicalDocument(docId: string) { await delay(); },
  async sharePetMedicalDocument(docId: string, vetId: string) { await delay(); }
};

// =====================================================
// VENDOR API
// =====================================================

export const mockVendorAPI = {
  // ... (keeping existing implementation)
  async getRoles() { await delay(); return MOCK_VENDOR_ROLES; },
  async submitApplication(data: any) { await delay(); return { id: generateId('vendor'), status: 'submitted', ...data }; },
  async getProfile(vendorId: string) { await delay(); return vendors.find((v: any) => v.id === vendorId); },
  async updateProfile(vendorId: string, updates: any) { await delay(); return { id: vendorId, ...updates }; },
  async getServices(vendorId: string) { await delay(); return services.filter((s: any) => s.vendor_id === vendorId); },
  async addService(data: any) { await delay(); return { id: generateId('svc'), ...data }; },
  async updateService(id: string, updates: any) { await delay(); return { id, ...updates }; },
  async getBookings(vendorId: string, status?: string) { await delay(); return bookings.filter((b: any) => b.vendor_id === vendorId); },
  async updateBookingStatus(id: string, status: string) { await delay(); return { id, status }; },
  async getStaff(vendorId: string) { await delay(); return staff.filter((s: any) => s.vendor_id === vendorId); },
  async addStaff(data: any) { await delay(); return { id: generateId('staff'), ...data }; }
};

// =====================================================
// BOOKING API
// =====================================================

export const mockBookingAPI = {
  // ... (keeping existing implementation)
  async createBooking(data: any) { await delay(); return { id: generateId('bk'), status: 'confirmed', ...data }; },
  async getBooking(id: string) { await delay(); return bookings.find((b: any) => b.id === id); },
  async getBookingById(id: string) { return this.getBooking(id); },
  async getCustomerBookings(customerId: string) { await delay(); return bookings.filter((b: any) => b.customer_id === customerId); },
  async updateBooking(id: string, updates: any) { await delay(); return { id, ...updates }; },
  async cancelBooking(id: string) { await delay(); return { id, status: 'cancelled' }; },
  async addReview(id: string, rating: number, review: string) { await delay(); return { id, rating, review }; }
};

// =====================================================
// SEARCH & DISCOVERY API
// =====================================================

export const mockSearchAPI = {
  // ... (keeping existing implementation)
  async searchVendors(params: any) { 
    await delay(); 
    return vendors.filter((v: any) => !params.role || v.role_id === params.role); 
  },
  async searchServices(params: any) { 
    await delay(); 
    return services.filter((s: any) => !params.category || s.category === params.category); 
  },
  async universalSearch(query: string) {
    await delay();
    return { vendors: [], services: [], products: [] };
  }
};

// =====================================================
// E-COMMERCE API
// =====================================================

export const mockEcommerceAPI = {
  // ... (keeping existing implementation)
  async getProducts(params?: any) { await delay(); return products; },
  async getProduct(id: string) { await delay(); return products.find((p: any) => p.id === id); },
  async createOrder(data: any) { await delay(); return { id: generateId('ord'), status: 'pending', ...data }; },
  async getCustomerOrders(customerId: string) { await delay(); return orders.filter((o: any) => o.customer_id === customerId); },
  async getOrder(id: string) { await delay(); return orders.find((o: any) => o.id === id); },
  async updateOrderStatus(id: string, status: string) { await delay(); return { id, order_status: status }; },
  async getProductReviews(id: string) { await delay(); return []; },
  async addProductReview(data: any) { await delay(); },
  async markReviewHelpful(id: string) { await delay(); },
  async getCart(customerId: string) { await delay(); return { items: [], total: 0 }; },
  async updateCartItem(customerId: string, itemId: string, qty: number) { await delay(); },
  async removeFromCart(customerId: string, itemId: string) { await delay(); },
  async getSavedItems(customerId: string) { await delay(); return []; }
};

// =====================================================
// ADMIN API
// =====================================================

export const mockAdminAPI = {
  async getProfile(id: string) { await delay(); return admins.find((a: any) => a.id === id); },
  async getAllVendors() { await delay(); return vendors; },
  async updateVendorStatus(id: string, status: string) { await delay(); return { id, status }; },
  async getAnalytics() { await delay(); return { total_vendors: vendors.length, total_revenue: 100000 }; }
};

// =====================================================
// LOYALTY API
// =====================================================

export const mockLoyaltyAPI = {
  async applyReferral(code: string, userId: string, type: string) { await delay(); return { success: true }; },
  async getPoints(userId: string) { await delay(); return 100; },
  async redeemPoints(userId: string, rewardId: string, points: number) { await delay(); return { success: true }; },
  async getProfile(userId: string) { 
    await delay(); 
    return { customerId: userId, points: 150, tier: 'Silver', tierBenefits: {}, pointsEarned: 200, pointsRedeemed: 50 }; 
  },
  async getRewardsCatalog() { await delay(); return []; }
};

// =====================================================
// PROMO API
// =====================================================

export const mockPromoAPI = {
  async getCoupons() { await delay(); return MOCK_COUPONS; },
  async applyCoupon(code: string, amount: number) { await delay(); return { success: true, discount: 50, finalAmount: amount - 50 }; },
  async getBundleDeals() { await delay(); return MOCK_BUNDLE_DEALS; },
  async getBanners() { await delay(); return PROMO_BANNERS; },
  async getFlashSaleItems() { await delay(); return []; },
  async trackCouponUsage() { await delay(); },
  async getCustomerCouponHistory() { await delay(); return []; }
};

// =====================================================
// INTEGRATED SERVICES API
// =====================================================

export const mockIntegratedServicesAPI = {
  async bookAmbulance(data: any) { 
    await delay(); 
    return { 
      id: generateId('amb'), 
      driver: { name: 'Ramesh', phone: '9876543210', vehicle: 'Van', location: { lat: 0, lng: 0 } },
      eta: '10 mins',
      status: 'dispatched'
    }; 
  },
  async getInsurancePlans() { await delay(); return MOCK_INSURANCE_PLANS; },
  async purchaseInsurance(data: any) { await delay(); return { id: generateId('pol'), status: 'active', ...data }; },
  async getCustomerPolicies(custId: string) { await delay(); return []; },
  async getCustomerClaims(custId: string) { await delay(); return []; },
  async fileInsuranceClaim(data: any) { await delay(); return { id: generateId('claim'), status: 'submitted' }; },
  
  // Cafe & Resort
  async getCafeDetails(vendorId: string) { 
    await delay(); 
    return { tables: MOCK_CAFE_TABLES.filter(t => t.vendor_id === vendorId), menu: MOCK_CAFE_MENU.filter(m => m.vendor_id === vendorId) }; 
  },
  async getResortDetails(vendorId: string) { 
    await delay(); 
    return { rooms: MOCK_RESORT_ROOMS.filter(r => r.vendor_id === vendorId) }; 
  }
};

// =====================================================
// AI API
// =====================================================

export const mockAIAPI = {
  async chat(params: any) { 
    await delay(); 
    return { message: "I can help you with that!", suggestions: ["Book Vet", "Shop Food"] }; 
  }
};

// =====================================================
// SUPPORT API
// =====================================================

export const mockSupportAPI = {
  async createTicket(data: any) { await delay(); return { id: generateId('tkt'), status: 'open', ...data }; }
};

// =====================================================
// EXPORT DEFAULT
// =====================================================

export const MockAPI = {
  auth: mockAuthAPI,
  customer: mockCustomerAPI,
  vendor: mockVendorAPI,
  booking: mockBookingAPI,
  search: mockSearchAPI,
  ecommerce: mockEcommerceAPI,
  admin: mockAdminAPI,
  loyalty: mockLoyaltyAPI,
  promo: mockPromoAPI,
  integratedServices: mockIntegratedServicesAPI,
  ai: mockAIAPI,
  support: mockSupportAPI,
  // Fallbacks
  get: async (url: string) => { console.log('Generic GET', url); await delay(); return { success: true }; },
  post: async (url: string, body: any) => { console.log('Generic POST', url); await delay(); return { success: true }; }
};

export default MockAPI;
