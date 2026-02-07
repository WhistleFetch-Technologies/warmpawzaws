/**
 * ============================================================================
 * SHARED ENTITY TYPES - FRONTEND & BACKEND COMMON
 * ============================================================================
 * 
 * This file defines the canonical types used across:
 * - Frontend (vendor-web, customer-web, admin-web)
 * - Backend (Lambda API)
 * - API Contracts
 * 
 * ALL field names use camelCase.
 * Backend converts from snake_case to camelCase before sending to frontend.
 * 
 * ============================================================================
 */

// ============================================================================
// PRIMARY KEY TYPES (All UUIDs as strings)
// ============================================================================

export type RoleId = string;
export type VendorId = string;
export type ServiceId = string;
export type CatalogId = string;
export type VendorServiceId = string;
export type StaffId = string;
export type CustomerId = string;
export type PetId = string;
export type BookingId = string;
export type PaymentId = string;
export type PrescriptionId = string;
export type IdentityId = string;

// ============================================================================
// ENUMS
// ============================================================================

export type ServiceStyle = 'at_center' | 'at_home' | 'tele';

export type VendorType = 'solo_provider' | 'center' | 'organization' | 'seller' | 'business';

export type VendorStatus = 
  | 'INIT'
  | 'FORM_PENDING'
  | 'ROLE_PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ACTIVATED'
  | 'REJECTED'
  | 'SUSPENDED';

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

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

// ============================================================================
// ROLE
// ============================================================================

export interface Role {
  roleId: RoleId;
  name: string;               // Code: 'veterinarian'
  displayName: string;        // Human: 'Veterinarian'
  description: string;
  category: string;
  icon?: string;
  isActive: boolean;
  isSystemRole: boolean;
  capabilities: string[];
  serviceStyles: ServiceStyle[];
  vendorTypes: VendorType[];
  pricingControl: {
    canControlPrice: boolean;
    canControlDuration: boolean;
  };
  createdAt: string;
  updatedAt?: string;
}

// ============================================================================
// VENDOR
// ============================================================================

export interface Vendor {
  vendorId: VendorId;
  identityId?: IdentityId;
  roleId: RoleId;
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

// ============================================================================
// STAFF
// ============================================================================

export interface Staff {
  staffId: StaffId;
  vendorId: VendorId;
  roleId?: RoleId;
  name: string;
  phone: string;
  email?: string;
  designation: string;
  isActive: boolean;
  services: ServiceId[];
  createdAt: string;
}

// ============================================================================
// SERVICE CATALOG
// ============================================================================

export interface ServiceCatalog {
  catalogId: CatalogId;
  serviceId: ServiceId;
  serviceName: string;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  serviceStyle: ServiceStyle;
  applicableRoles: string[];
  basePrice: number;
  duration: number;
  description: string;
  isPackage: boolean;
  isActive: boolean;
}

// ============================================================================
// VENDOR SERVICE
// ============================================================================

export interface VendorService {
  vendorServiceId: VendorServiceId;
  vendorId: VendorId;
  serviceId: ServiceId;
  catalogId?: CatalogId;
  roleId: RoleId;
  serviceName: string;
  serviceStyle: ServiceStyle;
  customPrice?: number;
  customDuration?: number;
  customDescription?: string;
  isEnabled: boolean;
  isPublished: boolean;
  isCustomService: boolean;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

// ============================================================================
// CUSTOMER
// ============================================================================

export interface Customer {
  customerId: CustomerId;
  phone: string;
  name?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
}

// ============================================================================
// PET
// ============================================================================

export interface Pet {
  petId: PetId;
  customerId: CustomerId;
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
// BOOKING
// ============================================================================

export interface Booking {
  bookingId: BookingId;
  customerId: CustomerId;
  vendorId: VendorId;
  serviceId: ServiceId;
  vendorServiceId?: VendorServiceId;
  staffId?: StaffId;
  petId?: PetId;
  roleId?: RoleId;
  bookingDate: string;
  bookingTime: string;
  serviceType: ServiceStyle;
  status: BookingStatus;
  basePrice: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentStatus: PaymentStatus;
  paymentId?: PaymentId;
  serviceName: string;
  vendorName?: string;
  customerName?: string;
  petName?: string;
  duration: number;
  address?: string;
  location?: {
    lat: number;
    lng: number;
  };
  notes?: string;
  specialInstructions?: string;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

// ============================================================================
// PAYMENT
// ============================================================================

export interface Payment {
  paymentId: PaymentId;
  bookingId: BookingId;
  customerId: CustomerId;
  vendorId: VendorId;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: 'razorpay' | 'cash' | 'upi' | 'card' | 'wallet';
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySignature?: string;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
}

// ============================================================================
// PRESCRIPTION
// ============================================================================

export interface Prescription {
  prescriptionId: PrescriptionId;
  bookingId?: BookingId;
  vendorId: VendorId;
  customerId: CustomerId;
  petId: PetId;
  staffId?: StaffId;
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
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// FLOW CONTEXT - Used to pass entity IDs through a transaction
// ============================================================================

export interface FlowContext {
  roleId?: RoleId;
  vendorId?: VendorId;
  serviceId?: ServiceId;
  vendorServiceId?: VendorServiceId;
  customerId?: CustomerId;
  petId?: PetId;
  bookingId?: BookingId;
  paymentId?: PaymentId;
  staffId?: StaffId;
  
  // Resolved entities
  role?: Role;
  vendor?: Vendor;
  service?: VendorService;
  customer?: Customer;
  booking?: Booking;
  payment?: Payment;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type EntityId = 
  | RoleId 
  | VendorId 
  | ServiceId 
  | CustomerId 
  | BookingId 
  | PaymentId;

export type EntityType = 
  | 'role' 
  | 'vendor' 
  | 'service' 
  | 'customer' 
  | 'booking' 
  | 'payment' 
  | 'staff' 
  | 'pet';
