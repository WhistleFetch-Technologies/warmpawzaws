export interface VendorSession {
  phone: string;
  vendorId?: string;
  vendor?: any;
  sessionToken?: string;
  verified: boolean;
}

export interface VendorAppProps {
  initialSession: VendorSession;
}




export interface VendorLandingPageProps {
  vendorId: string;
  phone: string;
  vendorType?: string;
  serviceStyle?: 'at_home' | 'at_center' | 'both';
  initialVendorData?: any;
  onComplete?: () => void;
  justSubmitted?: boolean; // ✅ NEW: Flag to indicate fresh submission
}

export type VendorStatus =
  | 'new'                    // No profile created yet
  | 'profile_incomplete'     // Profile created but not submitted
  | 'submitted'              // Just submitted, show success
  | 'pending'                // Under admin review
  | 'approved_services'      // Approved, needs service setup (Stage 1)
  | 'approved_availability'  // Services done, needs availability (Stage 2)
  | 'setup_completed'        // All done, show completion screen (Stage 3)
  | 'rejected'               // Rejected
  | 'clarification'          // Clarification requested
  | 'documents_required'     // Documents need to be re-uploaded
  | 'active';                // Setup complete, active

export interface VendorData {
  id: string;
  phone: string;
  vendorType?: string;
  serviceStyle?: string;
  applicationId?: string;
  applicationStatus?: string;
  profileCreated?: boolean;
  setupCompleted?: boolean;
  isActive?: boolean;
  documentNotes?: string;
  setupStage?: 'services_pending' | 'availability_pending' | 'completed';
  servicesConfigured?: boolean;
  availabilityConfigured?: boolean;
  previousStatus?: string;
  wasApprovedBefore?: boolean;
  reapprovalReason?: string;
  roleId?: string; // ✅ Role UUID
  roleName?: string; // ✅ Role name (e.g., 'veterinary_clinic', 'groomer_center')
  submittedAt?: string; // Application submission timestamp
  createdAt?: string; // Record creation timestamp
  infoRequestMessage?: string; // Clarification/info request message
  rejectionReason?: string; // Rejection reason if application was rejected
  fullName?: string; // Vendor full name
  businessName?: string; // Business name
}

export interface ApplicationData {
  id: string;
  status: string;
  rejectionReason?: string;
  allowResubmit?: boolean;
  clarificationNotes?: string;
}