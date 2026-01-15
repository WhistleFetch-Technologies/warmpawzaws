/**
 * ============================================================================
 * API RESPONSE NORMALIZERS
 * ============================================================================
 * 
 * Normalizes API responses to consistent camelCase format
 * Handles both snake_case and camelCase responses from the backend
 * 
 * Usage:
 *   const normalized = normalizeBookingResponse(apiResponse);
 *   const services = normalizeServicesResponse(apiResponse);
 */

// ============================================================================
// GENERIC NORMALIZER
// ============================================================================

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Recursively convert all keys in an object from snake_case to camelCase
 */
export function normalizeKeys<T>(obj: any): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => normalizeKeys(item)) as T;
  }
  
  if (typeof obj !== 'object') {
    return obj;
  }
  
  const normalized: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = snakeToCamel(key);
    normalized[camelKey] = normalizeKeys(value);
  }
  
  return normalized as T;
}

// ============================================================================
// BOOKING NORMALIZERS
// ============================================================================

export interface NormalizedBooking {
  id: string;
  bookingId: string;
  customerId: string;
  vendorId: string;
  serviceId: string;
  staffId?: string;
  petId?: string;
  bookingDate: string;
  bookingTime: string;
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  serviceType: 'at_center' | 'at_home' | 'tele';
  totalAmount: number;
  basePrice: number;
  discountAmount: number;
  taxAmount: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  serviceName: string;
  vendorName: string;
  customerName?: string;
  petName?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

export function normalizeBooking(raw: any): NormalizedBooking {
  return {
    id: raw.id || raw.booking_id,
    bookingId: raw.bookingId || raw.booking_id || raw.id,
    customerId: raw.customerId || raw.customer_id,
    vendorId: raw.vendorId || raw.vendor_id,
    serviceId: raw.serviceId || raw.service_id,
    staffId: raw.staffId || raw.staff_id,
    petId: raw.petId || raw.pet_id,
    bookingDate: raw.bookingDate || raw.booking_date,
    bookingTime: raw.bookingTime || raw.booking_time,
    status: raw.status || 'pending',
    serviceType: normalizeServiceType(raw.serviceType || raw.service_type),
    totalAmount: parseFloat(raw.totalAmount || raw.total_amount || '0'),
    basePrice: parseFloat(raw.basePrice || raw.base_price || '0'),
    discountAmount: parseFloat(raw.discountAmount || raw.discount_amount || '0'),
    taxAmount: parseFloat(raw.taxAmount || raw.tax_amount || '0'),
    paymentStatus: raw.paymentStatus || raw.payment_status || 'pending',
    serviceName: raw.serviceName || raw.service_name || 'Service',
    vendorName: raw.vendorName || raw.vendor_name || raw.business_name || 'Vendor',
    customerName: raw.customerName || raw.customer_name || raw.full_name,
    petName: raw.petName || raw.pet_name,
    address: raw.address,
    notes: raw.notes || raw.special_instructions,
    createdAt: raw.createdAt || raw.created_at,
    updatedAt: raw.updatedAt || raw.updated_at,
    completedAt: raw.completedAt || raw.completed_at,
  };
}

export function normalizeBookings(raw: any[]): NormalizedBooking[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeBooking);
}

function normalizeServiceType(type: string): 'at_center' | 'at_home' | 'tele' {
  const typeMap: Record<string, 'at_center' | 'at_home' | 'tele'> = {
    'at_center': 'at_center',
    'at_clinic': 'at_center',
    'at_vendor': 'at_center',
    'at_home': 'at_home',
    'home_visit': 'at_home',
    'tele': 'tele',
    'online': 'tele',
    'video': 'tele',
    'video_consultation': 'tele',
  };
  return typeMap[type?.toLowerCase()] || 'at_center';
}

// ============================================================================
// SERVICE NORMALIZERS
// ============================================================================

export interface NormalizedService {
  id: string;
  serviceId: string;
  vendorServiceId?: string;
  catalogId?: string;
  serviceName: string;
  categoryName: string;
  categoryId?: string;
  subCategoryName?: string;
  subCategoryId?: string;
  description: string;
  serviceStyle: 'at_center' | 'at_home' | 'tele';
  price: number;
  duration: number;
  isEnabled: boolean;
  isCustom: boolean;
  publishStatus: 'draft' | 'published' | 'pending' | 'rejected';
  applicableRoles: string[];
}

export function normalizeService(raw: any): NormalizedService {
  return {
    id: raw.id || raw.service_id || raw.catalog_id,
    serviceId: raw.serviceId || raw.service_id || raw.id,
    vendorServiceId: raw.vendorServiceId || raw.vendor_service_id,
    catalogId: raw.catalogId || raw.catalog_id,
    serviceName: raw.serviceName || raw.service_name || raw.name || 'Service',
    categoryName: raw.categoryName || raw.category_name || raw.category || 'General',
    categoryId: raw.categoryId || raw.category_id,
    subCategoryName: raw.subCategoryName || raw.sub_category_name || raw.sub_category,
    subCategoryId: raw.subCategoryId || raw.sub_category_id,
    description: raw.description || raw.customDescription || raw.custom_description || '',
    serviceStyle: normalizeServiceType(raw.serviceStyle || raw.service_style),
    price: parseFloat(raw.price || raw.basePrice || raw.base_price || raw.customPrice || raw.custom_price || '0'),
    duration: parseInt(raw.duration || raw.durationMinutes || raw.duration_minutes || '30', 10),
    isEnabled: raw.isEnabled ?? raw.is_enabled ?? true,
    isCustom: raw.isCustomService ?? raw.is_custom_service ?? raw.isCustom ?? false,
    publishStatus: raw.publishStatus || raw.publish_status || 'published',
    applicableRoles: raw.applicableRoles || raw.applicable_roles || [],
  };
}

export function normalizeServices(raw: any[]): NormalizedService[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeService);
}

// ============================================================================
// VENDOR NORMALIZERS
// ============================================================================

export interface NormalizedVendor {
  id: string;
  vendorId: string;
  businessName: string;
  ownerName: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  roleId?: string;
  roleName?: string;
  vendorType: string;
  status: string;
  tier?: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
}

export function normalizeVendor(raw: any): NormalizedVendor {
  return {
    id: raw.id || raw.vendor_id,
    vendorId: raw.vendorId || raw.vendor_id || raw.id,
    businessName: raw.businessName || raw.business_name || raw.name || 'Business',
    ownerName: raw.ownerName || raw.owner_name || raw.fullName || raw.full_name || '',
    phone: raw.phone || '',
    email: raw.email,
    address: raw.address,
    city: raw.city,
    state: raw.state,
    pincode: raw.pincode || raw.zip_code,
    roleId: raw.roleId || raw.role_id,
    roleName: raw.roleName || raw.role_name,
    vendorType: raw.vendorType || raw.vendor_type || 'business',
    status: raw.status || raw.onboardingStatus || raw.onboarding_status || 'pending',
    tier: raw.tier,
    rating: parseFloat(raw.rating || raw.averageRating || raw.average_rating || '0'),
    reviewCount: parseInt(raw.reviewCount || raw.review_count || raw.total_reviews || '0', 10),
    isActive: raw.isActive ?? raw.is_active ?? true,
    createdAt: raw.createdAt || raw.created_at,
  };
}

// ============================================================================
// STATS NORMALIZERS
// ============================================================================

export interface NormalizedStats {
  totalRevenue: number;
  todayRevenue: number;
  totalBookings: number;
  completedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  averageRating: number;
  reviewCount: number;
}

export function normalizeStats(raw: any): NormalizedStats {
  return {
    totalRevenue: parseFloat(raw.totalRevenue || raw.total_revenue || '0'),
    todayRevenue: parseFloat(raw.todayRevenue || raw.today_revenue || '0'),
    totalBookings: parseInt(raw.totalBookings || raw.total_bookings || raw.total || '0', 10),
    completedBookings: parseInt(raw.completedBookings || raw.completed_bookings || raw.completed || '0', 10),
    pendingBookings: parseInt(raw.pendingBookings || raw.pending_bookings || raw.pending || '0', 10),
    cancelledBookings: parseInt(raw.cancelledBookings || raw.cancelled_bookings || raw.cancelled || '0', 10),
    averageRating: parseFloat(raw.averageRating || raw.average_rating || raw.rating || '0'),
    reviewCount: parseInt(raw.reviewCount || raw.review_count || raw.total_reviews || '0', 10),
  };
}

// ============================================================================
// ROLE CONFIG NORMALIZERS
// ============================================================================

export interface NormalizedRoleConfig {
  roleId: string;
  roleName: string;
  displayName: string;
  icon?: string;
  category?: string;
  serviceStyles: string[];
  capabilities: string[];
  pricingControl: {
    canControlPrice: boolean;
    canControlDuration: boolean;
  };
}

export function normalizeRoleConfig(raw: any): NormalizedRoleConfig {
  const config = raw.config || raw;
  
  return {
    roleId: raw.id || raw.roleId || raw.role_id,
    roleName: raw.name || raw.roleName || raw.role_name || '',
    displayName: raw.displayName || raw.display_name || raw.name || '',
    icon: config.icon,
    category: config.category,
    serviceStyles: (config.serviceStyles || config.service_styles || []).map(
      (s: string) => normalizeServiceType(s)
    ),
    capabilities: raw.capabilities || config.capabilities || [],
    pricingControl: {
      canControlPrice: config.pricingControl?.canControlPrice ?? config.pricing_control?.can_control_price ?? true,
      canControlDuration: config.pricingControl?.canControlDuration ?? config.pricing_control?.can_control_duration ?? true,
    },
  };
}

// ============================================================================
// RESPONSE WRAPPER NORMALIZERS
// ============================================================================

/**
 * Extract data from API response wrapper
 * Handles: { success: true, data: {...} } or { success: true, bookings: [...] } patterns
 */
export function extractData<T>(response: any, key?: string): T | null {
  if (!response) return null;
  
  // Direct data
  if (key && response[key]) {
    return response[key];
  }
  
  // Wrapped in data
  if (response.data) {
    if (key && response.data[key]) {
      return response.data[key];
    }
    return response.data;
  }
  
  // Try common keys
  const commonKeys = ['bookings', 'services', 'vendors', 'stats', 'results', 'items'];
  for (const k of commonKeys) {
    if (response[k]) {
      return response[k];
    }
  }
  
  return response;
}
