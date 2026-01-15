/**
 * ============================================================================
 * STANDARD ENTITY TYPES - SINGLE SOURCE OF TRUTH
 * ============================================================================
 * 
 * This file defines the canonical types and field names for all entities.
 * 
 * RULES:
 * 1. All IDs are UUIDs stored as strings
 * 2. All ID fields use camelCase (roleId, vendorId, serviceId)
 * 3. Database columns use snake_case (role_id, vendor_id, service_id)
 * 4. API responses always use camelCase
 * 5. When reading from DB, normalize to camelCase immediately
 * 
 * ENTITY HIERARCHY:
 * Role → Vendor → Service → Booking → Payment
 *         ↓
 *       Staff
 *         ↓
 *      Customer → Pet → Booking
 * 
 * ============================================================================
 */

// ============================================================================
// PRIMARY KEY TYPES
// ============================================================================

export type RoleId = string;       // UUID from roles.id
export type VendorId = string;     // UUID from vendors.id
export type ServiceId = string;    // UUID from services.id
export type CatalogId = string;    // UUID from service_catalog.id
export type VendorServiceId = string; // UUID from vendor_services.id
export type StaffId = string;      // UUID from staff.id
export type CustomerId = string;   // UUID from customers.id
export type PetId = string;        // UUID from pets.id
export type BookingId = string;    // UUID from bookings.id
export type PaymentId = string;    // UUID from payments.id
export type PrescriptionId = string; // UUID from prescriptions.id
export type IdentityId = string;   // UUID from vendor_identity.id

// ============================================================================
// ROLE ENTITY
// ============================================================================

export interface Role {
  roleId: RoleId;               // PRIMARY KEY
  name: string;                 // Unique code: 'veterinarian', 'pet_groomer'
  displayName: string;          // Human readable: 'Veterinarian', 'Pet Groomer'
  description: string;
  category: string;             // 'healthcare', 'service_provider', 'hospitality'
  icon?: string;
  isActive: boolean;
  isSystemRole: boolean;
  capabilities: string[];       // From role_permissions table
  serviceStyles: ServiceStyle[];
  vendorTypes: VendorType[];
  pricingControl: {
    canControlPrice: boolean;
    canControlDuration: boolean;
  };
  createdAt: string;
  updatedAt?: string;
}

export type ServiceStyle = 'at_center' | 'at_home' | 'tele';
export type VendorType = 'solo_provider' | 'center' | 'organization' | 'seller' | 'business';

// ============================================================================
// VENDOR ENTITY
// ============================================================================

export interface Vendor {
  vendorId: VendorId;           // PRIMARY KEY from vendors.id
  identityId: IdentityId;       // FK to vendor_identity.id
  roleId: RoleId;               // FK to roles.id - REQUIRED
  businessName: string;
  ownerName: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  location?: {
    lat: number;
    lng: number;
  };
  vendorType: VendorType;
  status: VendorStatus;
  tier?: string;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type VendorStatus = 
  | 'INIT'
  | 'FORM_PENDING'
  | 'ROLE_PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ACTIVATED'
  | 'REJECTED'
  | 'SUSPENDED';

// ============================================================================
// STAFF ENTITY
// ============================================================================

export interface Staff {
  staffId: StaffId;             // PRIMARY KEY
  vendorId: VendorId;           // FK to vendors.id - REQUIRED
  roleId?: RoleId;              // Optional staff-specific role
  name: string;
  phone: string;
  email?: string;
  designation: string;
  isActive: boolean;
  services: ServiceId[];        // Services this staff can perform
  createdAt: string;
}

// ============================================================================
// SERVICE ENTITY (from service_catalog)
// ============================================================================

export interface ServiceCatalog {
  catalogId: CatalogId;         // PRIMARY KEY from service_catalog.id
  serviceId: ServiceId;         // FK to services.id (base service)
  serviceName: string;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  serviceStyle: ServiceStyle;
  applicableRoles: string[];    // Role names that can offer this service
  basePrice: number;
  duration: number;             // In minutes
  description: string;
  isPackage: boolean;
  isActive: boolean;
}

// ============================================================================
// VENDOR SERVICE (vendor's offering of a catalog service)
// ============================================================================

export interface VendorService {
  vendorServiceId: VendorServiceId; // PRIMARY KEY from vendor_services.id
  vendorId: VendorId;           // FK to vendors.id - REQUIRED
  serviceId: ServiceId;         // FK to services.id - REQUIRED
  catalogId?: CatalogId;        // FK to service_catalog.id (if from catalog)
  roleId: RoleId;               // FK to roles.id - from vendor
  serviceName: string;
  serviceStyle: ServiceStyle;
  customPrice?: number;         // Vendor's custom price (if allowed)
  customDuration?: number;      // Vendor's custom duration (if allowed)
  customDescription?: string;
  isEnabled: boolean;           // Vendor has enabled this service
  isPublished: boolean;         // Service is live for customers
  isCustomService: boolean;     // Created by vendor, not from catalog
  approvalStatus: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

// ============================================================================
// CUSTOMER ENTITY
// ============================================================================

export interface Customer {
  customerId: CustomerId;       // PRIMARY KEY
  phone: string;
  name?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// PET ENTITY
// ============================================================================

export interface Pet {
  petId: PetId;                 // PRIMARY KEY
  customerId: CustomerId;       // FK to customers.id - REQUIRED
  name: string;
  species: 'dog' | 'cat' | 'bird' | 'other';
  breed?: string;
  age?: number;
  weight?: number;
  gender?: 'male' | 'female';
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// BOOKING ENTITY
// ============================================================================

export interface Booking {
  bookingId: BookingId;         // PRIMARY KEY
  customerId: CustomerId;       // FK to customers.id - REQUIRED
  vendorId: VendorId;           // FK to vendors.id - REQUIRED
  serviceId: ServiceId;         // FK to services.id - REQUIRED
  vendorServiceId?: VendorServiceId; // FK to vendor_services.id
  staffId?: StaffId;            // FK to staff.id (if assigned)
  petId?: PetId;                // FK to pets.id (if applicable)
  roleId: RoleId;               // FK to roles.id - from vendor
  
  // Booking details
  bookingDate: string;          // YYYY-MM-DD
  bookingTime: string;          // HH:MM
  serviceType: ServiceStyle;
  status: BookingStatus;
  
  // Pricing (all in smallest currency unit, e.g., paise)
  basePrice: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  
  // Payment
  paymentStatus: PaymentStatus;
  paymentId?: PaymentId;
  
  // Service details
  serviceName: string;
  duration: number;             // In minutes
  
  // Location (for at_home services)
  address?: string;
  location?: {
    lat: number;
    lng: number;
  };
  
  // Notes
  notes?: string;
  specialInstructions?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export type BookingStatus = 
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export type PaymentStatus = 
  | 'pending'
  | 'paid'
  | 'partially_paid'
  | 'refunded'
  | 'failed';

// ============================================================================
// PAYMENT ENTITY
// ============================================================================

export interface Payment {
  paymentId: PaymentId;         // PRIMARY KEY
  bookingId: BookingId;         // FK to bookings.id - REQUIRED
  customerId: CustomerId;       // FK to customers.id - REQUIRED
  vendorId: VendorId;           // FK to vendors.id - REQUIRED
  
  amount: number;               // In smallest currency unit
  currency: string;             // 'INR'
  status: PaymentStatus;
  method: 'razorpay' | 'cash' | 'upi' | 'card' | 'wallet';
  
  // Gateway details
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  
  // Timestamps
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
}

// ============================================================================
// PRESCRIPTION ENTITY
// ============================================================================

export interface Prescription {
  prescriptionId: PrescriptionId; // PRIMARY KEY
  bookingId?: BookingId;        // FK to bookings.id (if linked to booking)
  vendorId: VendorId;           // FK to vendors.id - REQUIRED
  customerId: CustomerId;       // FK to customers.id - REQUIRED
  petId: PetId;                 // FK to pets.id - REQUIRED
  staffId?: StaffId;            // FK to staff.id (prescribing doctor)
  
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
  diagnosis?: string;
  doctorName: string;
  
  createdAt: string;
}

// ============================================================================
// DB TO ENTITY NORMALIZERS
// ============================================================================

/**
 * Normalize database row to Role entity
 */
export function normalizeRole(row: any): Role {
  return {
    roleId: row.id || row.role_id || row.roleId,
    name: row.name,
    displayName: row.display_name || row.displayName || row.name,
    description: row.description || '',
    category: row.category || row.config?.category || 'general',
    icon: row.icon || row.config?.icon,
    isActive: row.is_active !== false,
    isSystemRole: row.is_system_role || false,
    capabilities: row.capabilities || [],
    serviceStyles: row.config?.serviceStyles || row.serviceStyles || [],
    vendorTypes: row.config?.vendorTypes || row.vendorTypes || [],
    pricingControl: row.config?.pricingControl || row.pricingControl || {
      canControlPrice: false,
      canControlDuration: false,
    },
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

/**
 * Normalize database row to Vendor entity
 */
export function normalizeVendor(row: any): Vendor {
  return {
    vendorId: row.id || row.vendor_id || row.vendorId,
    identityId: row.identity_id || row.identityId,
    roleId: row.role_id || row.roleId,
    businessName: row.business_name || row.businessName || row.name || '',
    ownerName: row.owner_name || row.ownerName || row.full_name || row.fullName || '',
    phone: row.phone || '',
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    pincode: row.pincode || row.zip_code,
    location: row.location ? {
      lat: row.location.lat || row.location.latitude,
      lng: row.location.lng || row.location.longitude,
    } : undefined,
    vendorType: row.vendor_type || row.vendorType || 'business',
    status: row.status || row.onboarding_status || 'INIT',
    tier: row.tier,
    rating: parseFloat(row.rating || row.average_rating || '0'),
    reviewCount: parseInt(row.review_count || row.total_reviews || '0', 10),
    isActive: row.is_active !== false,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

/**
 * Normalize database row to Booking entity
 */
export function normalizeBooking(row: any): Booking {
  return {
    bookingId: row.id || row.booking_id || row.bookingId,
    customerId: row.customer_id || row.customerId,
    vendorId: row.vendor_id || row.vendorId,
    serviceId: row.service_id || row.serviceId,
    vendorServiceId: row.vendor_service_id || row.vendorServiceId,
    staffId: row.staff_id || row.staffId,
    petId: row.pet_id || row.petId,
    roleId: row.role_id || row.roleId,
    bookingDate: row.booking_date || row.bookingDate,
    bookingTime: row.booking_time || row.bookingTime,
    serviceType: row.service_type || row.serviceType || 'at_center',
    status: row.status || 'pending',
    basePrice: parseFloat(row.base_price || row.basePrice || '0'),
    taxAmount: parseFloat(row.tax_amount || row.taxAmount || '0'),
    discountAmount: parseFloat(row.discount_amount || row.discountAmount || '0'),
    totalAmount: parseFloat(row.total_amount || row.totalAmount || '0'),
    paymentStatus: row.payment_status || row.paymentStatus || 'pending',
    paymentId: row.payment_id || row.paymentId,
    serviceName: row.service_name || row.serviceName || 'Service',
    duration: parseInt(row.duration || '30', 10),
    address: row.address,
    location: row.location,
    notes: row.notes,
    specialInstructions: row.special_instructions || row.specialInstructions,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    completedAt: row.completed_at || row.completedAt,
    cancelledAt: row.cancelled_at || row.cancelledAt,
  };
}

/**
 * Normalize database row to Payment entity
 */
export function normalizePayment(row: any): Payment {
  return {
    paymentId: row.id || row.payment_id || row.paymentId,
    bookingId: row.booking_id || row.bookingId,
    customerId: row.customer_id || row.customerId,
    vendorId: row.vendor_id || row.vendorId,
    amount: parseFloat(row.amount || '0'),
    currency: row.currency || 'INR',
    status: row.status || 'pending',
    method: row.method || row.payment_method || 'razorpay',
    gatewayOrderId: row.gateway_order_id || row.razorpay_order_id,
    gatewayPaymentId: row.gateway_payment_id || row.razorpay_payment_id,
    gatewaySignature: row.gateway_signature || row.razorpay_signature,
    createdAt: row.created_at || row.createdAt,
    paidAt: row.paid_at || row.paidAt,
    refundedAt: row.refunded_at || row.refundedAt,
  };
}

/**
 * Normalize database row to VendorService entity
 */
export function normalizeVendorService(row: any): VendorService {
  return {
    vendorServiceId: row.id || row.vendor_service_id || row.vendorServiceId,
    vendorId: row.vendor_id || row.vendorId,
    serviceId: row.service_id || row.serviceId,
    catalogId: row.catalog_id || row.catalogId,
    roleId: row.role_id || row.roleId,
    serviceName: row.service_name || row.serviceName || row.name || 'Service',
    serviceStyle: row.service_style || row.serviceStyle || 'at_center',
    customPrice: row.custom_price || row.customPrice,
    customDuration: row.custom_duration || row.customDuration,
    customDescription: row.custom_description || row.customDescription,
    isEnabled: row.is_enabled !== false,
    isPublished: row.is_published || row.publish_status === 'published',
    isCustomService: row.is_custom_service || row.isCustomService || false,
    approvalStatus: row.approval_status || row.approvalStatus || 'approved',
    createdAt: row.created_at || row.createdAt,
  };
}

// ============================================================================
// ENTITY TO DB COLUMN MAPPERS
// ============================================================================

/**
 * Get standard DB column name for entity field
 */
export const DB_COLUMNS = {
  // Role
  roleId: 'role_id',
  roleName: 'name',
  roleDisplayName: 'display_name',
  
  // Vendor
  vendorId: 'vendor_id',
  identityId: 'identity_id',
  businessName: 'business_name',
  ownerName: 'owner_name',
  vendorType: 'vendor_type',
  
  // Service
  serviceId: 'service_id',
  catalogId: 'catalog_id',
  vendorServiceId: 'vendor_service_id',
  serviceName: 'service_name',
  serviceStyle: 'service_style',
  
  // Booking
  bookingId: 'booking_id',
  bookingDate: 'booking_date',
  bookingTime: 'booking_time',
  serviceType: 'service_type',
  
  // Payment
  paymentId: 'payment_id',
  paymentStatus: 'payment_status',
  
  // Customer
  customerId: 'customer_id',
  
  // Pet
  petId: 'pet_id',
  
  // Staff
  staffId: 'staff_id',
  
  // Common
  isActive: 'is_active',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
} as const;

/**
 * Convert camelCase entity object to snake_case for DB insert/update
 */
export function toDbColumns(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    
    // Use mapping if exists, otherwise convert camelCase to snake_case
    const dbColumn = (DB_COLUMNS as any)[key] || 
      key.replace(/([A-Z])/g, '_$1').toLowerCase();
    
    result[dbColumn] = value;
  }
  
  return result;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(id: string | undefined | null): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export function requireValidId(id: string | undefined | null, fieldName: string): string {
  if (!isValidUUID(id)) {
    throw new Error(`Invalid ${fieldName}: ${id}`);
  }
  return id as string;
}
