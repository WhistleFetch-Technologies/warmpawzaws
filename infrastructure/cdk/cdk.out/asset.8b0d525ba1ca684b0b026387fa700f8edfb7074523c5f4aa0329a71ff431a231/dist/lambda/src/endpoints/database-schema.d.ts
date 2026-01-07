/**
 * DATABASE SCHEMA & UTILITY FUNCTIONS
 *
 * Common types and utility functions used across the backend
 */
/**
 * Generate a unique ID with a prefix
 * ✅ FIX: For 'user' prefix, generate UUID format (required by database)
 */
export declare function generateId(prefix: string): string;
/**
 * Create a session token
 */
export declare function createSession(userId: string, role: 'customer' | 'vendor' | 'staff' | 'admin'): string;
export interface User {
    userId: string;
    phone: string;
    role: 'customer' | 'vendor' | 'admin';
    name?: string;
    email?: string;
    isActive: boolean;
    isVerified: boolean;
    createdAt: string;
    lastLoginAt: string;
    updatedAt?: string;
}
export interface Session {
    sessionId: string;
    userId: string;
    phone: string;
    role: 'customer' | 'vendor' | 'staff' | 'admin';
    token?: string;
    createdAt: string;
    expiresAt: string;
}
export interface VendorProfile {
    id: string;
    vendorId?: string;
    userId?: string;
    phone: string;
    ownerName?: string;
    businessName?: string;
    email?: string;
    status: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive' | 'suspended' | 'pending_approval' | 'under_review' | 'onboarding' | 'new';
    approvalStatus?: string;
    setupCompleted?: boolean;
    applicationStatus?: string;
    isActive?: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface CustomerProfile {
    id: string;
    customerId?: string;
    userId: string;
    phone: string;
    name?: string;
    email?: string;
    addresses?: Address[];
    createdAt: string;
    updatedAt: string;
}
export interface AdminProfile {
    id: string;
    userId: string;
    phone: string;
    name: string;
    email?: string;
    role: 'super_admin' | 'admin' | 'moderator';
    permissions?: string[];
    createdAt: string;
    updatedAt: string;
}
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
    label: string;
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
    duration: number;
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
    rating: number;
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
    appointmentId?: string;
    recordType: 'upload' | 'prescription' | 'vet_summary' | 'lab_report' | 'vaccination' | 'xray' | 'other';
    title: string;
    description?: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    uploadedBy: string;
    uploaderRole: 'customer' | 'staff' | 'vendor';
    uploadDate: string;
    metadata?: {
        diagnosis?: string;
        medications?: string;
        dosage?: string;
        duration?: string;
        doctorName?: string;
        clinicName?: string;
        symptoms?: string[];
        vitalSigns?: {
            temperature?: number;
            heartRate?: number;
            weight?: number;
        };
        treatmentPlan?: string;
        followUpDate?: string;
        followUpInstructions?: string;
        vaccineName?: string;
        vaccineDate?: string;
        nextDueDate?: string;
        administeredBy?: string;
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
//# sourceMappingURL=database-schema.d.ts.map