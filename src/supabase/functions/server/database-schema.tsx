/**
 * WARMPAWZ DATABASE SCHEMA
 * 
 * Complete database schema for user state management across all three portals:
 * - Customer App
 * - Vendor Portal  
 * - Platform Admin
 * 
 * Uses Supabase KV Store with the following structure:
 */

// ============================================
// USERS TABLE
// ============================================
// Key: user:{phone}
// Stores: Core user identity and role information
export interface User {
  userId: string;              // Unique: user_1234567890_abc
  phone: string;               // Primary identifier: 9611377119
  role: 'customer' | 'vendor' | 'admin';  // User role
  email?: string;              // Optional email
  name?: string;               // Full name
  isActive: boolean;           // Account active status
  isVerified: boolean;         // Phone verified
  createdAt: string;           // ISO timestamp
  lastLoginAt: string;         // ISO timestamp
  metadata?: Record<string, any>;  // Additional data
}

// Index: user:phone:{phone} → userId
// Index: user:id:{userId} → User object

// ============================================
// SESSIONS TABLE
// ============================================
// Key: session:{sessionId}
// Stores: Active user sessions
export interface Session {
  sessionId: string;           // Unique: sess_1234567890_abc
  userId: string;              // Links to User
  phone: string;               // Quick lookup
  role: 'customer' | 'vendor' | 'admin';
  createdAt: string;           // ISO timestamp
  expiresAt: string;           // ISO timestamp (30 days)
  lastActivityAt: string;      // ISO timestamp
  deviceInfo?: string;         // Optional device details
}

// Index: session:user:{userId} → sessionId
// Index: session:phone:{phone} → sessionId

// ============================================
// VENDOR PROFILES TABLE
// ============================================
// Key: vendor:{vendorId}
// Stores: Complete vendor business profile
export interface VendorProfile {
  vendorId: string;            // Unique: vendor_1234567890_abc
  userId: string;              // Links to User
  phone: string;               // Same as user phone
  
  // Business Information
  fullName: string;
  businessName?: string;
  vendorType: string;          // grooming, veterinary, etc.
  serviceStyle: 'at_home' | 'at_center' | 'both';
  
  // Contact & Location
  email?: string;
  address: string;
  location?: {
    lat: number;
    lng: number;
  };
  
  // Legal Documents
  aadhaarNumber: string;
  panNumber: string;
  gstNumber?: string;
  experience?: string;
  
  // Bank Details
  bankDetails?: {
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  };
  
  // Application & Setup Status
  applicationId?: string;      // Links to Application
  applicationStatus?: 'pending' | 'approved' | 'rejected' | 'clarification_requested';
  profileCreated: boolean;     // Profile form completed
  setupCompleted: boolean;     // Service setup completed
  isActive: boolean;           // Can receive bookings
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
}

// Index: vendor:user:{userId} → vendorId
// Index: vendor:phone:{phone} → vendorId
// Index: vendor:type:{vendorType} → [vendorIds]
// Index: vendor:active → [vendorIds]

// ============================================
// VENDOR APPLICATIONS TABLE
// ============================================
// Key: application:{applicationId}
// Stores: Vendor onboarding applications
export interface VendorApplication {
  applicationId: string;       // Unique: APP1234567890ABC
  vendorId: string;            // Links to VendorProfile
  userId: string;              // Links to User
  
  // Application Data
  fullName: string;
  businessName?: string;
  vendorType: string;
  serviceStyle: string;
  email: string;
  phone: string;
  address: string;
  location?: {
    lat: number;
    lng: number;
  };
  
  // Documents
  documents: Array<{
    name: string;
    type: string;
    url?: string;
  }>;
  
  // Additional Information
  additionalInfo?: Record<string, any>;
  
  // Status & Workflow
  status: 'pending' | 'under_review' | 'approved' | 'rejected' | 'clarification_requested';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;         // Admin userId
  
  // Admin Actions
  approvalNotes?: string;
  rejectionReason?: string;
  clarificationNotes?: string;
  allowResubmit?: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Index: application:vendor:{vendorId} → applicationId
// Index: application:status:pending → [applicationIds]
// Index: application:status:approved → [applicationIds]
// Index: application:status:rejected → [applicationIds]

// ============================================
// CUSTOMER PROFILES TABLE
// ============================================
// Key: customer:{customerId}
// Stores: Customer information
export interface CustomerProfile {
  customerId: string;          // Unique: customer_1234567890_abc
  userId: string;              // Links to User
  phone: string;
  
  // Personal Info
  name?: string;
  email?: string;
  
  // Pet Information
  pets?: Array<{
    petId: string;
    name: string;
    species: string;
    breed?: string;
    age?: number;
    weight?: number;
  }>;
  
  // Preferences
  preferences?: {
    favoriteVendors?: string[];
    savedAddresses?: Array<{
      label: string;
      address: string;
      location: { lat: number; lng: number };
    }>;
  };
  
  // Status
  isActive: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Index: customer:user:{userId} → customerId
// Index: customer:phone:{phone} → customerId

// ============================================
// ADMIN PROFILES TABLE
// ============================================
// Key: admin:{adminId}
// Stores: Platform admin information
export interface AdminProfile {
  adminId: string;             // Unique: admin_1234567890_abc
  userId: string;              // Links to User
  phone: string;
  
  // Admin Info
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'moderator';
  
  // Permissions
  permissions: string[];       // ['approve_vendors', 'manage_users', etc.]
  
  // Status
  isActive: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

// Index: admin:user:{userId} → adminId

// ============================================
// VENDOR SERVICES TABLE
// ============================================
// Key: vendor:services:{vendorId}
// Stores: Services offered by vendor
export interface VendorServices {
  vendorId: string;
  services: Array<{
    serviceId: string;
    name: string;
    category: string;
    description?: string;
    price: number;
    duration?: number;
    isActive: boolean;
  }>;
  updatedAt: string;
}

// ============================================
// NOTIFICATIONS TABLE
// ============================================
// Key: notification:{notificationId}
// Stores: System notifications
export interface Notification {
  notificationId: string;
  recipientId: string;         // userId
  recipientType: 'customer' | 'vendor' | 'admin';
  
  type: 'sms' | 'email' | 'push' | 'in_app';
  subject?: string;
  message: string;
  
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
  error?: string;
  
  createdAt: string;
}

// Index: notification:user:{userId} → [notificationIds]
// Index: notification:status:pending → [notificationIds]

// ============================================
// BOOKINGS TABLE
// ============================================
// Key: booking:{bookingId}
// Stores: Customer bookings for vendor services
export interface Booking {
  id: string;
  customerId: string;
  vendorId: string;
  petId?: string;
  serviceId: string;
  serviceName: string;
  serviceType: string;
  bookingDate: string;           // YYYY-MM-DD
  bookingTime: string;           // HH:MM format
  duration: number;              // minutes
  price: number;
  
  // Status tracking
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'refunded';
  paymentMethod: string;
  
  // Customer details
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  
  // Pet details
  petName?: string;
  petBreed?: string;
  petAge?: number;
  
  // Additional info
  specialInstructions?: string;
  metadata?: Record<string, any>; // For specialized verticals (Resort guests, Cafe pax, etc.)
  meetingLink?: string;           // For tele-consultations
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  
  // Tracking
  statusHistory: Array<{
    status: string;
    timestamp: string;
    note?: string;
    updatedBy?: string;
    action?: string;
  }>;
}

// Index: customer:{customerId}:bookings → [bookingIds]
// Index: vendor:{vendorId}:bookings → [bookingIds]
// Index: pet:{petId}:bookings → [bookingIds]

// ============================================
// PAYOUTS TABLE
// ============================================
// Key: payout:{payoutId}
// Stores: Vendor payout requests and settlements
export interface Payout {
  payoutId: string;
  vendorId: string;
  amount: number;
  bookingIds: string[];          // Bookings included in this payout
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Bank details
  bankDetails?: {
    accountNumber: string;
    bankName: string;
    ifscCode: string;
  };
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  requestedAt: string;
  approvedAt?: string;
  processedAt?: string;
  completedAt?: string;
  failedAt?: string;
  
  // Admin actions
  approvedBy?: string;
  completedBy?: string;
  rejectedBy?: string;
  transactionId?: string;
  adminNotes?: string;
  failureReason?: string;
}

// Index: vendor:{vendorId}:payouts → [payoutIds]
// Index: admin:payouts:pending → [payoutIds]
// Index: admin:payouts:processing → [payoutIds]
// Index: admin:payouts:completed → [payoutIds]
// Index: admin:payouts:failed → [payoutIds]

// ============================================
// WATCHLIST TABLE
// ============================================
// Key: watchlist:{watchlistId}
// Stores: Patients requiring follow-up monitoring
export interface WatchlistItem {
  watchlistId: string;
  vendorId: string;
  customerId: string;
  petId?: string;
  petName: string;
  customerName: string;
  issue: string;
  notes?: string;
  bookingId?: string;
  isActive: boolean;
  createdAt: string;
  lastUpdated: string;
}

// Index: vendor:{vendorId}:watchlist → [watchlistIds]

// ============================================
// HELPER FUNCTIONS
// ============================================

export const generateId = (prefix: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}_${random}`;
};

export const cleanPhone = (phone: string): string => {
  return phone.replace(/[^0-9]/g, '');
};

export const createSession = (userId: string, phone: string, role: string): Session => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  return {
    sessionId: generateId('sess'),
    userId,
    phone,
    role: role as any,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    lastActivityAt: now.toISOString()
  };
};