/**
 * DATABASE SCHEMA & UTILITY FUNCTIONS
 * 
 * Common types and utility functions used across the backend
 */

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate a unique ID with a prefix
 */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

/**
 * Create a session token
 */
export function createSession(userId: string, role: 'customer' | 'vendor' | 'staff' | 'admin'): string {
  const sessionId = generateId('session');
  const token = `${sessionId}_${userId}_${role}_${Date.now()}`;
  return btoa(token); // Base64 encode
}

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface Customer {
  id: string;
  phone: string;
  name: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
  addresses?: Address[];
  pets?: Pet[];
}

export interface Address {
  id: string;
  customerId: string;
  label: string; // "Home", "Work", etc.
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  isDefault?: boolean;
  createdAt: string;
}

export interface Pet {
  id: string;
  customerId: string;
  name: string;
  species: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  breed?: string;
  age?: number;
  weight?: number;
  gender?: 'male' | 'female';
  medicalNotes?: string;
  profilePhoto?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  customerId: string;
  vendorId: string;
  staffId?: string;
  serviceId: string;
  serviceName: string;
  petIds: string[];
  status: 'pending' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled';
  scheduledDate: string;
  scheduledTime: string;
  duration: number; // in minutes
  basePrice: number;
  totalPrice: number;
  address?: Address;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  senderRole: 'customer' | 'vendor' | 'staff';
  message: string;
  timestamp: string;
  read: boolean;
}

export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  vendorId: string;
  staffId?: string;
  rating: number; // 1-5
  comment?: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  userRole: 'customer' | 'vendor' | 'staff' | 'admin';
  type: 'booking' | 'message' | 'reminder' | 'promotion' | 'system';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export interface Vendor {
  id: string;
  businessName: string;
  phone: string;
  email?: string;
  vendorRole: string;
  status: 'active' | 'inactive' | 'suspended';
  addresses?: Address[];
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: string;
  vendorId: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  status: 'active' | 'inactive';
  specializations?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MedicalRecord {
  id: string;
  petId: string;
  appointmentId?: string; // Optional - user uploads may not be tied to appointments
  recordType: 'upload' | 'prescription' | 'vet_summary' | 'lab_report' | 'vaccination' | 'xray' | 'other';
  title: string;
  description?: string;
  fileUrl?: string; // Signed URL from Supabase Storage
  fileName?: string;
  fileType?: string; // 'pdf' | 'image' | 'document'
  uploadedBy: string; // customerId or staffId or vendorId
  uploaderRole: 'customer' | 'staff' | 'vendor';
  uploadDate: string;
  metadata?: {
    // For prescriptions
    diagnosis?: string;
    medications?: string;
    dosage?: string;
    duration?: string;
    doctorName?: string;
    clinicName?: string;
    
    // For vet summaries
    symptoms?: string[];
    vitalSigns?: {
      temperature?: number;
      heartRate?: number;
      weight?: number;
    };
    treatmentPlan?: string;
    followUpDate?: string;
    followUpInstructions?: string;
    
    // For vaccinations
    vaccineName?: string;
    vaccineDate?: string;
    nextDueDate?: string;
    administeredBy?: string;
    
    // General
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  petId: string;
  customerId: string;
  vendorId: string;
  staffId?: string;
  diagnosis: string;
  medications: string;
  dosage: string;
  duration: string;
  instructions?: string;
  doctorName?: string;
  clinicName?: string;
  pdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}