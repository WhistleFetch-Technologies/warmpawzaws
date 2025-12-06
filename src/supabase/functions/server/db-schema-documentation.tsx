/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║              WARMPAWZ DATABASE SCHEMA DOCUMENTATION                        ║
 * ║                     KV Store Architecture                                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

export const DB_SCHEMA = {
  
  // ═══════════════════════════════════════════════════════════════════════
  // BOOKING SCHEMA
  // ═══════════════════════════════════════════════════════════════════════
  BOOKING: {
    key: 'booking:{bookingId}',
    description: 'Main booking record for all service types',
    structure: {
      // Core Identifiers
      id: 'string - Unique booking ID (booking_timestamp_randomId)',
      bookingId: 'string - Same as id',
      
      // Customer Information
      customerId: 'string - customer:{phone}',
      customerPhone: 'string - 10-digit phone',
      customerName: 'string',
      
      // Pet Information
      petId: 'string - pet_timestamp_randomId',
      petName: 'string',
      petType: 'string - dog|cat|bird|rabbit|hamster|fish|other',
      petBreed: 'string',
      petAge: 'number',
      petWeight: 'number',
      petGender: 'string - male|female',
      
      // Vendor Information
      vendorId: 'string - vendor_{phone}',
      vendorName: 'string',
      vendorPhone: 'string',
      vendorAddress: 'string',
      vendorLat: 'number',
      vendorLon: 'number',
      
      // Service Information
      serviceId: 'string - service ID from catalog or custom',
      serviceName: 'string',
      serviceType: 'string - tele|clinic|home (for vets) or center|home (for others)',
      serviceStyle: 'string - tele|clinic|home',
      roleId: 'string - veterinarian|groomer|trainer|walker|behaviourist|boarding_center',
      category: 'string - Service category',
      subcategory: 'string - Service subcategory',
      
      // Package Information (optional)
      isPackage: 'boolean',
      packageId: 'string',
      packageName: 'string',
      packageDetails: {
        totalSessions: 'number',
        completedSessions: 'number',
        sessionsRemaining: 'number',
        milestones: 'array'
      },
      
      // Staff Assignment
      doctorId: 'string - staff_timestamp_randomId (for vets)',
      staffId: 'string - staff_timestamp_randomId (for other services)',
      staffName: 'string',
      staffPhone: 'string',
      
      // Scheduling
      scheduledDate: 'string - YYYY-MM-DD',
      scheduledTime: 'string - HH:MM AM/PM',
      duration: 'number - minutes',
      
      // Location (for home services)
      customerLocation: {
        address: 'string',
        city: 'string',
        pincode: 'string',
        lat: 'number',
        lon: 'number',
        instructions: 'string'
      },
      
      // Payment
      amount: 'number - Total amount',
      consultationFee: 'number',
      visitingCharges: 'number',
      platformFee: 'number',
      discount: 'number',
      finalAmount: 'number',
      paymentMethod: 'string - card|upi|wallet|cod',
      paymentStatus: 'string - pending|paid|refunded|partial_refund',
      transactionId: 'string',
      
      // OTP System
      otp: 'string - 4-digit OTP for service completion',
      otpType: 'string - END|START|BOTH',
      startOtp: 'string - For sessions requiring start OTP',
      endOtp: 'string - For all bookings',
      otpVerified: 'boolean',
      otpVerifiedAt: 'string - ISO timestamp',
      
      // Status Tracking
      status: 'string - confirmed|in_progress|completed|cancelled|rescheduled',
      cancellationReason: 'string',
      cancelledBy: 'string - customer|vendor|admin',
      
      // Medical Records (for vets)
      prescriptionId: 'string',
      diagnosis: 'string',
      symptoms: 'array<string>',
      notes: 'string',
      
      // Follow-up
      isFollowUp: 'boolean',
      parentBookingId: 'string - Original booking if this is follow-up',
      followUpBookingId: 'string - Follow-up booking ID if created',
      followUpEligible: 'boolean',
      
      // Timestamps
      createdAt: 'string - ISO timestamp',
      updatedAt: 'string - ISO timestamp',
      completedAt: 'string - ISO timestamp',
      
      // Metadata
      source: 'string - customer_app|vendor_app|admin',
      problemGridId: 'string - ID from problem grid if booked via problem discovery'
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // CUSTOMER SCHEMA
  // ═══════════════════════════════════════════════════════════════════════
  CUSTOMER: {
    key: 'customer:{phone}',
    structure: {
      phone: 'string - 10-digit',
      fullName: 'string',
      email: 'string',
      address: 'string',
      city: 'string',
      pincode: 'string',
      lat: 'number',
      lon: 'number',
      isActive: 'boolean',
      createdAt: 'string',
      lastLoginAt: 'string'
    }
  },
  
  CUSTOMER_BOOKINGS: {
    key: 'customer:bookings:{phone}',
    description: 'Array of booking IDs for a customer',
    structure: 'array<string> - booking IDs sorted by newest first'
  },
  
  CUSTOMER_PETS: {
    key: 'customer:{phone}:pets',
    description: 'Array of pet IDs for a customer',
    structure: 'array<string> - pet IDs'
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // PET SCHEMA
  // ═══════════════════════════════════════════════════════════════════════
  PET: {
    key: 'pet:{petId}',
    structure: {
      id: 'string - pet_timestamp_randomId',
      name: 'string',
      type: 'string - dog|cat|bird|rabbit|hamster|fish|other',
      breed: 'string',
      age: 'number',
      weight: 'number',
      gender: 'string - male|female',
      ownerPhone: 'string',
      ownerId: 'string',
      photo: 'string - URL',
      medicalHistory: 'array',
      vaccinations: 'array',
      allergies: 'array<string>',
      specialNeeds: 'string',
      isActive: 'boolean',
      createdAt: 'string'
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // VENDOR SCHEMA
  // ═══════════════════════════════════════════════════════════════════════
  VENDOR: {
    key: 'vendor:vendor_{phone}',
    structure: {
      id: 'string - vendor_{phone}',
      phone: 'string - 10-digit',
      businessName: 'string',
      roleId: 'string - veterinarian|groomer|trainer|walker|behaviourist|boarding_center',
      
      // Registration
      registrationNumber: 'string',
      gstNumber: 'string',
      
      // Location
      address: 'string',
      city: 'string',
      pincode: 'string',
      lat: 'number',
      lon: 'number',
      
      // Status
      status: 'string - pending|approved|rejected|suspended',
      isActive: 'boolean',
      
      // Rating
      rating: 'number - 0-5',
      totalReviews: 'number',
      
      // Analytics
      totalBookings: 'number',
      completedBookings: 'number',
      revenue: 'number',
      
      // Settings
      serviceRadius: 'number - km',
      acceptsHomeVisits: 'boolean',
      acceptsClinicVisits: 'boolean',
      
      // Timestamps
      createdAt: 'string',
      approvedAt: 'string',
      lastActivityAt: 'string'
    }
  },
  
  VENDOR_BOOKINGS: {
    key: 'vendor:{vendorId}:bookings',
    structure: 'array<string> - booking IDs'
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // STAFF SCHEMA
  // ═══════════════════════════════════════════════════════════════════════
  STAFF: {
    key: 'staff:{staffId}',
    structure: {
      id: 'string - staff_timestamp_randomId',
      vendorId: 'string',
      fullName: 'string',
      phone: 'string',
      email: 'string',
      roleId: 'string',
      
      // Professional
      specializations: 'array<string> - Subcategory IDs',
      yearsOfExperience: 'number',
      qualifications: 'array<string>',
      registrationNumber: 'string',
      
      // Services
      services: 'array<{id, name, category, isActive}>',
      
      // Pricing
      consultationFee: 'number',
      homeVisitFee: 'number',
      
      // Availability
      isAvailable: 'boolean',
      schedule: 'object',
      
      // Status
      isActive: 'boolean',
      
      // Rating
      rating: 'number',
      totalReviews: 'number'
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // PRESCRIPTION SCHEMA
  // ═══════════════════════════════════════════════════════════════════════
  PRESCRIPTION: {
    key: 'prescription:{prescriptionId}',
    structure: {
      id: 'string',
      bookingId: 'string',
      petId: 'string',
      doctorId: 'string',
      diagnosis: 'string',
      symptoms: 'array<string>',
      medicines: 'array<{name, dosage, frequency, duration}>',
      tests: 'array<string>',
      notes: 'string',
      prescriptionUrl: 'string - Storage URL',
      followUpRequired: 'boolean',
      followUpDate: 'string',
      createdAt: 'string'
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // REFUND SCHEMA
  // ═══════════════════════════════════════════════════════════════════════
  REFUND: {
    key: 'refund:{refundId}',
    structure: {
      id: 'string',
      bookingId: 'string',
      customerId: 'string',
      vendorId: 'string',
      
      originalAmount: 'number',
      refundAmount: 'number',
      deductionAmount: 'number',
      refundPercentage: 'number',
      
      reason: 'string',
      refundPolicy: 'string',
      
      status: 'string - pending|approved|rejected|processed',
      processedBy: 'string',
      processedAt: 'string',
      
      paymentMethod: 'string',
      transactionId: 'string',
      refundTransactionId: 'string',
      
      createdAt: 'string'
    }
  },
  
  // ═══════════════════════════════════════════════════════════════════════
  // ADMIN POLICIES
  // ═══════════════════════════════════════════════════════════════════════
  REFUND_POLICIES: {
    key: 'admin:refund_policies',
    structure: {
      enabled: 'boolean',
      rules: 'array<{hoursBeforeStart, refundPercentage, description}>'
    }
  },
  
  BOOKING_RULES: {
    key: 'admin:booking_rules',
    structure: {
      minAdvanceBookingHours: 'number',
      maxAdvanceBookingDays: 'number',
      cancellationWindowHours: 'number',
      rescheduleWindowHours: 'number',
      maxReschedulesPerBooking: 'number'
    }
  }
};

/**
 * DATA CONTRACTS - Type Definitions
 */
export interface BookingRecord {
  // Core
  id: string;
  bookingId: string;
  
  // Customer
  customerId: string;
  customerPhone: string;
  customerName: string;
  
  // Pet
  petId: string;
  petName: string;
  petType: string;
  petBreed?: string;
  petAge?: number;
  petWeight?: number;
  petGender?: string;
  
  // Vendor
  vendorId: string;
  vendorName: string;
  vendorPhone?: string;
  vendorAddress?: string;
  vendorLat?: number;
  vendorLon?: number;
  
  // Service
  serviceId: string;
  serviceName: string;
  serviceType: string;
  serviceStyle?: string;
  roleId: string;
  category?: string;
  subcategory?: string;
  
  // Package (optional)
  isPackage?: boolean;
  packageId?: string;
  packageName?: string;
  packageDetails?: {
    totalSessions: number;
    completedSessions: number;
    sessionsRemaining: number;
    milestones?: any[];
  };
  
  // Staff
  doctorId?: string;
  staffId?: string;
  staffName?: string;
  staffPhone?: string;
  
  // Schedule
  scheduledDate: string;
  scheduledTime: string;
  duration?: number;
  
  // Location (home services)
  customerLocation?: {
    address: string;
    city?: string;
    pincode?: string;
    lat?: number;
    lon?: number;
    instructions?: string;
  };
  
  // Payment
  amount: number;
  consultationFee?: number;
  visitingCharges?: number;
  platformFee?: number;
  discount?: number;
  finalAmount?: number;
  paymentMethod: string;
  paymentStatus: string;
  transactionId?: string;
  
  // OTP
  otp?: string;
  otpType?: string;
  startOtp?: string;
  endOtp?: string;
  otpVerified?: boolean;
  otpVerifiedAt?: string;
  
  // Status
  status: string;
  cancellationReason?: string;
  cancelledBy?: string;
  
  // Medical (vets)
  prescriptionId?: string;
  diagnosis?: string;
  symptoms?: string[];
  notes?: string;
  
  // Follow-up
  isFollowUp?: boolean;
  parentBookingId?: string;
  followUpBookingId?: string;
  followUpEligible?: boolean;
  
  // Timestamps
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
  
  // Metadata
  source?: string;
  problemGridId?: string;
}

export interface RefundCalculation {
  refundAmount: number;
  refundPercentage: number;
  deductionAmount: number;
  refundPolicy: string;
  hoursUntilStart: number;
  canCancel: boolean;
  canReschedule: boolean;
}

export interface CustomerProfile {
  phone: string;
  fullName: string;
  email?: string;
  address?: string;
  city?: string;
  pincode?: string;
  lat?: number;
  lon?: number;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string;
}

export interface PetProfile {
  id: string;
  name: string;
  type: string;
  breed: string;
  age: number;
  weight: number;
  gender: string;
  ownerPhone: string;
  ownerId: string;
  photo?: string;
  medicalHistory?: any[];
  vaccinations?: any[];
  allergies?: string[];
  specialNeeds?: string;
  isActive: boolean;
  createdAt: string;
}
