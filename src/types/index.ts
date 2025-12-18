// User Roles
export type UserRole = 'customer' | 'vendor' | 'admin';

// User Types
export interface User {
  id: string;
  role: UserRole;
  name: string;
  email?: string;
  phone: string;
  status: 'active' | 'inactive' | 'suspended';
  createdAt: string;
}

// Customer Types
export interface Pet {
  id: string;
  name: string;
  type: 'dog' | 'cat' | 'bird' | 'other';
  breed: string;
  age: number;
  weight: number;
  imageUrl?: string;
  medicalHistory?: string[];
}

export interface Customer {
  id: string;
  userId: string;
  pets: Pet[];
  addresses: Address[];
  preferences: {
    favoriteVendors: string[];
    notificationEnabled: boolean;
  };
}

export interface Address {
  id: string;
  label: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
}

// Vendor Types
export type ServiceType =
  | 'walker'
  | 'grooming_home'
  | 'grooming_center'
  | 'vet_home'
  | 'vet_teleconsult'
  | 'vet_clinic'
  | 'trainer_home'
  | 'medicine_delivery'
  | 'food_delivery'
  | 'food_subscription'
  | 'insurance'
  | 'mating_dating'
  | 'pet_cafe';

export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface Vendor {
  id: string;
  userId: string;
  businessName: string;
  businessType: ServiceType[];
  status: VendorStatus;
  documents: VendorDocument[];
  serviceRadius: number; // in kilometers
  rating: number;
  totalBookings: number;
  revenue: number;
  address: Address;
  businessHours: BusinessHours;
  pricing: ServicePricing[];
  promotions: Promotion[];
  certifications: string[];
  experienceYears: number;
  submittedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;
}

export interface VendorDocument {
  id: string;
  type: 'license' | 'certificate' | 'id_proof' | 'insurance' | 'other';
  name: string;
  url: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  uploadedAt: string;
}

export interface BusinessHours {
  monday: TimeSlot[];
  tuesday: TimeSlot[];
  wednesday: TimeSlot[];
  thursday: TimeSlot[];
  friday: TimeSlot[];
  saturday: TimeSlot[];
  sunday: TimeSlot[];
}

export interface TimeSlot {
  open: string; // HH:mm format
  close: string;
}

export interface ServicePricing {
  serviceType: ServiceType;
  basePrice: number;
  currency: string;
  pricePerUnit?: number;
  unit?: 'hour' | 'visit' | 'session' | 'kg' | 'month';
  additionalCharges?: {
    name: string;
    amount: number;
  }[];
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  validFrom: string;
  validUntil: string;
  applicableServices: ServiceType[];
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
}

// Booking Types
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export interface Booking {
  id: string;
  customerId: string;
  vendorId: string;
  serviceType: ServiceType;
  petId: string;
  status: BookingStatus;
  scheduledAt: string;
  completedAt?: string;
  amount: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  rating?: number;
  review?: string;
  cancellationReason?: string;
  location: Address;
  notes?: string;
  createdAt: string;
}

// Admin Types
export interface VendorApplication {
  id: string;
  vendorId: string;
  vendor: Vendor;
  status: VendorStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  adminNotes?: string;
  complianceChecks: ComplianceCheck[];
}

export interface ComplianceCheck {
  id: string;
  type: string;
  status: 'pending' | 'passed' | 'failed';
  checkedBy?: string;
  checkedAt?: string;
  notes?: string;
}

// Subscription Types
export interface FoodSubscription {
  id: string;
  customerId: string;
  petId: string;
  vendorId: string;
  planType: 'weekly' | 'biweekly' | 'monthly';
  mealPacks: MealPack[];
  startDate: string;
  nextDelivery: string;
  status: 'active' | 'paused' | 'cancelled';
  totalAmount: number;
}

export interface MealPack {
  id: string;
  name: string;
  description: string;
  quantity: number;
  price: number;
}

// Insurance Types
export interface InsurancePolicy {
  id: string;
  customerId: string;
  petId: string;
  providerId: string;
  policyNumber: string;
  coverageType: 'basic' | 'premium' | 'comprehensive';
  premium: number;
  coverageAmount: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
}

// Mating & Dating Types
export interface MatingRequest {
  id: string;
  customerId: string;
  petId: string;
  petType: 'dog' | 'cat';
  breed: string;
  gender: 'male' | 'female';
  age: number;
  healthCertificates: string[];
  preferences: {
    breed?: string;
    ageRange?: [number, number];
    location?: string;
  };
  status: 'active' | 'matched' | 'completed' | 'cancelled';
  createdAt: string;
}

// Payment Types
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';
export type PaymentMethod = 'razorpay' | 'wallet' | 'cash' | 'card' | 'upi' | 'netbanking';

export interface Payment {
  id: string;
  bookingId?: string;
  orderId?: string;
  customerId: string;
  vendorId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: PaymentMethod;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  transactionId?: string;
  refundId?: string;
  refundAmount?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  paidAt?: string;
  refundedAt?: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  bookingId?: string;
  orderId?: string;
  amount: number;
  reason: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  razorpayRefundId?: string;
  processedAt?: string;
  createdAt: string;
}

// Service Types (Extended)
export interface Service {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  type: ServiceType;
  category: string;
  price: number;
  duration: number; // in minutes
  isActive: boolean;
  images?: string[];
  features?: string[];
  requirements?: string[];
  availability?: {
    days: string[];
    timeSlots: TimeSlot[];
  };
  createdAt: string;
  updatedAt: string;
}
