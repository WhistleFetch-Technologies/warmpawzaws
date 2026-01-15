'use client';

/**
 * Vendor Landing Page - Main Entry Point for Vendor Portal
 * Handles all vendor lifecycle states from onboarding to active operations
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
// ✅ AWS Serverless: Removed Supabase dependencies - using apiClient with Cognito auth
import { useVendorNotificationService } from './useVendorNotificationService';
import { useVendorCapabilities } from './hooks/useVendorCapabilities';
import { VendorStaffPage } from './VendorStaffPage';
import { DoctorManagement } from './clinic/DoctorManagement'; // ✅ FIX: Use actual Figma UI for doctor management
import { VendorBusinessHub } from './business/VendorBusinessHub'; // ✅ NEW
import { VetSpecializedServicesManager } from './clinic/VetSpecializedServicesManager'; // ✅ NEW: Vet-specific services
import { ResortManagementDashboard } from './resort/ResortManagementDashboard'; // ✅ NEW: Pet resort management
import { NutritionistMealManager } from './NutritionistMealManager'; // ✅ NEW: Nutritionist meal plans
import { EnhancedVendorOnboarding } from './onboarding/EnhancedVendorOnboarding';
import { VendorApplicationSubmitted } from './VendorApplicationSubmitted';
import { VendorApplicationUnderReview } from './VendorApplicationUnderReview';
import { VendorClarificationRequested } from './VendorClarificationRequested';
import { VendorApprovedSetup } from './VendorApprovedSetup';
import { VendorAvailabilitySetup } from './VendorAvailabilitySetup';
import { VendorSetupCompleted } from './VendorSetupCompleted';
import { VendorApplicationRejected } from './VendorApplicationRejected';
import { VendorDashboard } from './VendorDashboard'; // ✅ FIX: Use actual Figma UI component, not the placeholder VendorDashboardScreen
import { VendorScheduleManagement } from './VendorScheduleManagement';
import { VendorServiceManagementComplete } from './VendorServiceManagementComplete';
import { VendorConsultationScreen } from './VendorConsultationScreen';
import { VendorBookingManagement } from './VendorBookingManagement';
import { VendorTeleConsultationFlow } from './VendorTeleConsultationFlow';
import { FacilityManagement } from './FacilityManagement';
import { CenterProfileManager } from './CenterProfileManager'; // ✅ NEW: Center Profile with timing
import { CafeVendorDashboard } from './cafe/CafeVendorDashboard';
import { SunsetServicesVendorDashboard } from './sunset/SunsetServicesVendorDashboard';
import { InsuranceVendorContainer } from './insurance/InsuranceVendorContainer';
import { VendorGalleryManagement } from './VendorGalleryManagement'; // ✅ FIX: Gallery component
import { VendorPortfolioManagement } from './VendorPortfolioManagement'; // ✅ FIX: Portfolio component
import { VendorCCTVAccess } from './VendorCCTVAccess'; // ✅ FIX: CCTV component
import { VendorControlledSubstances } from './VendorControlledSubstances'; // ✅ FIX: Controlled substances component
import { VendorPrescriptionBuilder } from './VendorPrescriptionBuilder'; // ✅ FIX: Prescription builder
import { ProgressTrackingDashboard } from './ProgressTrackingDashboard'; // ✅ FIX: Progress tracking - CORRECTED PATH
import { PackageManagementContainer } from './packages/PackageManagementContainer'; // ✅ FIX: Package management
import { VendorCustomServiceCreation } from './VendorCustomServiceCreation'; // ✅ FIX: Custom services
import { ShelterAdoptionSystem } from './ShelterAdoptionSystem'; // ✅ FIX: Adoption management
import { VendorMemorialServices } from './VendorMemorialServices'; // ✅ FIX: Memorial services
import { VendorExpiryManagement } from './VendorExpiryManagement'; // ✅ NEW: Expiry management
import { VendorDonationManagement } from './VendorDonationManagement'; // ✅ NEW: Donation management
import { VendorEventManagement } from './VendorEventManagement'; // ✅ NEW: Event management
import { VendorPatientMonitoring } from './VendorPatientMonitoring'; // ✅ NEW: Patient monitoring
import { VendorCafeMenuManagement } from './VendorCafeMenuManagement'; // ✅ NEW: Cafe menu management
import { VendorPrescriptionVerification } from './VendorPrescriptionVerification'; // ✅ NEW: Prescription verification
import { VendorDeliveryManagement } from './VendorDeliveryManagement'; // ✅ NEW: Delivery management
import { VendorDietCharts } from './VendorDietCharts'; // ✅ NEW: Diet charts
import { VendorCounseling } from './VendorCounseling'; // ✅ NEW: Counseling services
import { VendorPolicyManagement } from './VendorPolicyManagement'; // ✅ NEW: Policy management
import { VendorDistancePricing } from './VendorDistancePricing'; // ✅ NEW: Distance pricing
import { VendorSupportDashboard } from './VendorSupportDashboard'; // ✅ NEW: Support tickets

interface VendorLandingPageProps {
  vendorId: string;
  phone: string;
  vendorType?: string;
  serviceStyle?: 'at_home' | 'at_center' | 'both';
  initialVendorData?: any;
  onComplete?: () => void;
  justSubmitted?: boolean; // ✅ NEW: Flag to indicate fresh submission
}

type VendorStatus = 
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

interface VendorData {
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
  roleId?: string; // ✅ Add roleId to VendorData
  submittedAt?: string; // Application submission timestamp
  createdAt?: string; // Record creation timestamp
  infoRequestMessage?: string; // Clarification/info request message
  rejectionReason?: string; // Rejection reason if application was rejected
  fullName?: string; // Vendor full name
  businessName?: string; // Business name
}

interface ApplicationData {
  id: string;
  status: string;
  rejectionReason?: string;
  allowResubmit?: boolean;
  clarificationNotes?: string;
}

export function VendorLandingPage({ 
  vendorId, 
  phone,
  vendorType,
  serviceStyle,
  initialVendorData,
  onComplete,
  justSubmitted
}: VendorLandingPageProps) {
  const router = useRouter();
  const [status, setStatus] = useState<VendorStatus>('new');
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<VendorData | null>(null);
  const [applicationData, setApplicationData] = useState<ApplicationData | null>(null);
  const [showConsultation, setShowConsultation] = useState(false);
  const [showServiceManagement, setShowServiceManagement] = useState(false);
  const [showBookingManagement, setShowBookingManagement] = useState(false);
  const [showTeleConsultation, setShowTeleConsultation] = useState(false);
  const [showScheduleManagement, setShowScheduleManagement] = useState(false);
  const [showFacilityManagement, setShowFacilityManagement] = useState(false);
  const [showCenterProfile, setShowCenterProfile] = useState(false); // ✅ NEW: Center Profile Manager
  const [showStaffManagement, setShowStaffManagement] = useState(false);
  const [showBusinessHub, setShowBusinessHub] = useState(false); // ✅ NEW
  const [showSupportDashboard, setShowSupportDashboard] = useState(false); // ✅ NEW: Support tickets
  
  // ✅ NEW: Specialized vendor-specific screens
  const [showVetSpecialized, setShowVetSpecialized] = useState(false); // Vet-specific services
  const [showResortManagement, setShowResortManagement] = useState(false); // Pet resort management
  const [showNutritionistMealManager, setShowNutritionistMealManager] = useState(false); // Nutritionist meal plans
  
  // ✅ FIX: Additional capability screens (Gallery, Portfolio, CCTV, Controlled Substances)
  const [showGallery, setShowGallery] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showCCTV, setShowCCTV] = useState(false);
  const [showControlledSubstances, setShowControlledSubstances] = useState(false);
  const [showPrescription, setShowPrescription] = useState(false);
  const [showProgressTracking, setShowProgressTracking] = useState(false);
  const [showPackages, setShowPackages] = useState(false);
  const [showCustomServices, setShowCustomServices] = useState(false);
  const [showAdoptionSystem, setShowAdoptionSystem] = useState(false);
  const [showMemorialServices, setShowMemorialServices] = useState(false);
  const [showExpiryManagement, setShowExpiryManagement] = useState(false); // ✅ NEW: Expiry management
  const [showDonationManagement, setShowDonationManagement] = useState(false); // ✅ NEW: Donation management
  const [showEventManagement, setShowEventManagement] = useState(false); // ✅ NEW: Event management
  const [showPatientMonitoring, setShowPatientMonitoring] = useState(false); // ✅ NEW: Patient monitoring
  const [showCafeMenuManagement, setShowCafeMenuManagement] = useState(false); // ✅ NEW: Cafe menu management
  const [showCafeTables, setShowCafeTables] = useState(false); // ✅ NEW: Cafe tables management
  const [showPrescriptionVerification, setShowPrescriptionVerification] = useState(false); // ✅ NEW: Prescription verification
  const [showDeliveryManagement, setShowDeliveryManagement] = useState(false); // ✅ NEW: Delivery management
  const [showDietCharts, setShowDietCharts] = useState(false); // ✅ NEW: Diet charts
  const [showCounseling, setShowCounseling] = useState(false); // ✅ NEW: Counseling services
  const [showPolicyManagement, setShowPolicyManagement] = useState(false); // ✅ NEW: Policy management
  const [showDistancePricing, setShowDistancePricing] = useState(false); // ✅ NEW: Distance pricing
  const [showLiveTracking, setShowLiveTracking] = useState(false); // ✅ FIX: Live tracking
  const [showSpecializedServices, setShowSpecializedServices] = useState(false); // ✅ FIX: Specialized services
  
  // ✅ NEW: Track navigation context for better UX flow
  const [returnToStaffManagement, setReturnToStaffManagement] = useState(false);
  
  // ✅ NEW: Re-onboarding state
  const [isReEditing, setIsReEditing] = useState(false);
  const [existingApplicationData, setExistingApplicationData] = useState<any>(null);
  const [reEditMode, setReEditMode] = useState<'correction' | 'clarification' | null>(null);

  // 🔔 Enable vendor notification service - works throughout the landing page
  useVendorNotificationService({
    vendorId: vendorId,
    enabled: !!vendorId, // ✅ Enable whenever we have vendorId (not just when active)
    onNewNotification: (notification) => {
      console.log('📬 [VENDOR-LANDING] Notification received:', notification);
      // Toast and sound will be shown automatically by the service
    }
  });

  // 🔒 Get vendor capabilities from role configuration
  const { capabilities } = useVendorCapabilities(vendorData?.roleId);
  
  useEffect(() => {
    // 🔒 Fast-path: if localStorage already knows we're approved/activated, show dashboard immediately
    if (typeof window !== 'undefined') {
      const storedStatus = localStorage.getItem('vendorApplicationStatus');
      const storedVendor = localStorage.getItem('vendorData');
      if (storedStatus && ['APPROVED', 'ACTIVATED'].includes(storedStatus)) {
        console.log('✅ [VendorLandingPage] Fast-path: APPROVED/ACTIVATED vendor detected, showing dashboard');
        setStatus('active');
        if (storedVendor) {
          try {
            const vendor = JSON.parse(storedVendor);
            setVendorData(vendor);
            // Ensure vendor data has active status
            if (!vendor.status || vendor.status !== 'active') {
              vendor.status = 'active';
              vendor.isActive = true;
            }
          } catch {
            // ignore parse errors
          }
        }
        setLoading(false);
        return; // ✅ Return early to skip onboarding flow
      }
    }

    // If we have initial vendor data, use it instead of fetching
    if (initialVendorData) {
      console.log('📦 Using initial vendor data:', initialVendorData);
      console.log('🔍 Initial vendor STATUS:', initialVendorData.status);
      console.log('🔍 Initial vendor SETUP COMPLETED:', initialVendorData.setupCompleted);
      processVendorData(initialVendorData);
      setLoading(false);
    } else {
      checkVendorStatus();
    }
  }, [vendorId, phone, initialVendorData]);
  
  const processVendorData = (vendor: any) => {
    setVendorData(vendor);
    
    console.log('🔍 Processing vendor data:', {
      id: vendor.id,
      status: vendor.status,
      setupStage: vendor.setupStage,
      servicesConfigured: vendor.servicesConfigured,
      availabilityConfigured: vendor.availabilityConfigured,
      setupCompleted: vendor.setupCompleted,
      isActive: vendor.isActive,
      applicationId: vendor.applicationId
    });
    
    // ✅ FIX: Check for active status FIRST (before other status checks)
    // VendorApp sets status='active' for APPROVED vendors, so we need to catch this
    if (vendor.status === 'active' || vendor.isActive === true) {
      console.log('✅ Vendor is ACTIVE - showing dashboard');
      setStatus('active');
      return; // Don't continue processing
    }
    
    // Map vendor status to UI status
    // NEW WORKFLOW: Status values are 'pending', 'approved', 'rejected', 'more_info_required', 'resubmitted'
    if (vendor.status === 'submitted' || vendor.status === 'pending' || vendor.status === 'resubmitted' || vendor.status === 'under_review' || vendor.status === 'pending_approval') {
      // Show pending screen ONLY if this is their first login OR they just submitted
      // If they're logging in again and already have pending status, it means they haven't been approved yet
      // But if they were previously approved and made changes, we need to distinguish that
      const wasApprovedBefore = vendor.previousStatus === 'approved' || vendor.wasApprovedBefore;
      
      if (wasApprovedBefore) {
        // They were approved, made changes, and are now pending re-approval
        // Show them a different message
        console.log(`⚠️ Vendor was approved before, now pending re-approval after profile changes`);
        setStatus('pending');
      } else {
        // First time pending OR just submitted
        const finalStatus = justSubmitted || vendor.status === 'submitted' ? 'submitted' : 'pending';
        console.log(`✅ Vendor has pending/submitted application - showing ${finalStatus} screen`);
        setStatus(finalStatus);
      }
    } else if (vendor.status === 'approved') {
      // Check setup stage to determine which screen to show
      const setupStage = vendor.setupStage || 'services_pending';
      
      console.log(`📊 Setup stage: ${setupStage}`);
      
      // ✅ FIX: If vendor is approved AND active, show dashboard immediately
      // This handles existing vendors who are already fully onboarded
      if (vendor.isActive === true) {
        console.log('✅ Vendor is APPROVED and ACTIVE - showing dashboard');
        setStatus('active');
      } else if (setupStage === 'completed' && vendor.setupCompleted) {
        console.log('✅ Setup just completed - showing completion screen');
        setStatus('setup_completed');
      } else if (setupStage === 'availability_pending' || vendor.servicesConfigured) {
        console.log('📅 Services configured - showing availability setup');
        setStatus('approved_availability');
      } else {
        console.log('🎯 Approved - showing service setup');
        setStatus('approved_services');
      }
    } else if (vendor.status === 'rejected') {
      console.log('❌ Vendor application rejected - showing rejection screen');
      setStatus('rejected');
    } else if (vendor.status === 'more_info_required' || vendor.status === 'clarification_requested') {
      console.log('📝 More info/clarification requested - showing status screen');
      setStatus('clarification');
    } else if (vendor.status === 'documents_required') {
      console.log('📄 Documents required - showing resubmit form');
      setStatus('documents_required');
    } else {
      console.log('🆕 No application found - showing new vendor form');
      setStatus('new');
    }
  };

  const checkVendorStatus = async () => {
    try {
      setLoading(true);
      
      // Try to load vendor profile
      const profileData = await apiClient.get(`/vendor/profile`) as any;

      if (profileData && profileData.vendor) {
        setVendorData(profileData.vendor);
        
        console.log('📊 [VendorLandingPage] Profile loaded:', {
          isActive: profileData.vendor.isActive,
          status: profileData.vendor.status,
          applicationId: profileData.vendor.applicationId,
        });

        // ✅ FIX: Check if vendor is already active (approved + setup complete)
        if (profileData.vendor.isActive === true || profileData.vendor.status === 'active') {
          console.log('✅ [VendorLandingPage] Vendor is active - showing dashboard');
          setStatus('active');
          return; // Don't continue checking, vendor is fully active
        }

        // Check if they have an application
        if (profileData.vendor?.applicationId) {
          // Load application status
          const appData = await apiClient.get(`/vendor/application/status/${profileData.vendor.applicationId}`) as any;

          if (appData && appData.application) {
            setApplicationData(appData.application);

            // Determine status based on application status
            if (appData.application.status === 'approved') {
              if (profileData.vendor.setupCompleted) {
                setStatus('active');
              } else if (profileData.vendor.availabilitySetupCompleted) {
                setStatus('setup_completed');
              } else if (profileData.vendor.servicesSetupCompleted) {
                setStatus('approved_availability');
              } else {
                setStatus('approved_services');
              }
            } else if (appData.application.status === 'rejected') {
              setStatus('rejected');
            } else if (appData.application.status === 'clarification_requested') {
              setStatus('clarification');
            } else if (appData.application.status === 'pending' || appData.application.status === 'under_review') {
              setStatus(justSubmitted ? 'submitted' : 'pending');
            }
          }
        } else if (profileData.vendor?.profileCreated) {
          // Profile exists but no application submitted
          setStatus('profile_incomplete');
        } else if (profileData.vendor?.status === 'approved') {
          // Vendor approved but no application - show approved status
          setStatus('approved_services');
        } else {
          setStatus('new');
        }
      } else {
        // No profile found
        setStatus('new');
      }
    } catch (error) {
      console.error('Error checking vendor status:', error);
      setStatus('new');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (profileData: any) => {
    try {
      console.log('📤 [handleProfileSubmit] Called with data:', profileData);
      console.log('📤 [handleProfileSubmit] Checking conditions:', {
        hasSuccess: !!profileData.success,
        hasStatus: !!profileData.status,
        statusValue: profileData.status,
        conditionMet: profileData.success && profileData.status === 'submitted'
      });
      
      // ✅ FIX: Check if this is the new dynamic form submission
      if (profileData.success && profileData.status === 'submitted') {
        console.log('✅ [handleProfileSubmit] Dynamic form submission detected - updating status to submitted');
        console.log('✅ [handleProfileSubmit] Application ID:', profileData.applicationId);
        console.log('✅ [handleProfileSubmit] Vendor ID:', profileData.vendorId);
        
        // Update local state with application data
        setApplicationData({
          id: profileData.applicationId,
          status: 'pending'
        });
        
        // Show submitted screen
        setStatus('submitted');
        toast.success('Application submitted successfully!');
        return;
      }
      
      console.log('⚠️ [handleProfileSubmit] Not a dynamic form submission - running legacy code');
      
      // ✅ LEGACY CODE BELOW - Only runs for old onboarding flow (if any)
      console.log('📤 Starting profile submission with document upload...');
      
      // STEP 1: Upload all documents to Supabase Storage
      const formData = new FormData();
      formData.append('vendorId', vendorId);
      
      const documents: any[] = [];
      
      // Add Aadhaar front
      if (profileData.aadhaarFiles?.front) {
        formData.append('aadhaar_front', profileData.aadhaarFiles.front);
        console.log('📎 Added Aadhaar Front');
      }
      
      // Add Aadhaar back
      if (profileData.aadhaarFiles?.back) {
        formData.append('aadhaar_back', profileData.aadhaarFiles.back);
        console.log('📎 Added Aadhaar Back');
      }
      
      // Add GST certificate
      if (profileData.gstCertificate) {
        formData.append('gst_certificate', profileData.gstCertificate);
        console.log('📎 Added GST Certificate');
      }
      
      // Add Police Verification
      if (profileData.policeVerification) {
        formData.append('police_verification', profileData.policeVerification);
        console.log('📎 Added Police Verification');
      }
      
      // Add Cancelled Cheque
      if (profileData.bankDetails?.cancelledCheque) {
        formData.append('cancelled_cheque', profileData.bankDetails.cancelledCheque);
        console.log('📎 Added Cancelled Cheque');
      }
      
      // Upload all documents
      console.log('☁️ Uploading documents to storage...');
      const uploadResponse = await apiClient.post('/storage/upload-multiple', formData) as any;
      
      if (!uploadResponse || !uploadResponse.success) {
        console.error('❌ Upload failed:', uploadResponse?.error);
        toast.error('Failed to upload documents');
        return;
      }
      
      const uploadResult = uploadResponse;
      console.log('✅ Documents uploaded:', uploadResult);
      
      // Map upload results to documents array
      const documentTypeMap: Record<string, string> = {
        'aadhaar_front': 'Aadhaar Front',
        'aadhaar_back': 'Aadhaar Back',
        'gst_certificate': 'GST Certificate',
        'police_verification': 'Police Verification Certificate',
        'cancelled_cheque': 'Cancelled Cheque'
      };
      
      if (uploadResult.uploads) {
        uploadResult.uploads.forEach((upload: any) => {
          if (upload.success) {
            documents.push({
              name: upload.originalName || documentTypeMap[upload.documentType],
              category: documentTypeMap[upload.documentType],
              type: upload.type,
              url: upload.url,
              fileName: upload.fileName
            });
          }
        });
      }
      
      console.log('📋 Prepared documents array:', documents);
      
      // STEP 2: Save the profile
      const vendorProfile = {
        id: vendorId,
        phone: phone,
        fullName: profileData.fullName,
        businessName: profileData.businessName,
        vendorType: vendorType,
        serviceStyle: serviceStyle,
        address: profileData.address,
        location: profileData.coordinates,
        aadhaarNumber: profileData.aadhaarNumber,
        panNumber: profileData.panNumber,
        gstNumber: profileData.gstNumber,
        experience: profileData.experience,
        bankDetails: profileData.bankDetails,
        profileCreated: true,
        createdAt: new Date().toISOString()
      };

      const profileResponse = await apiClient.post('/vendor/profile/save', vendorProfile) as any;

      if (!profileResponse || !profileResponse.success) {
        toast.error('Failed to save profile');
        return;
      }

      // STEP 3: Submit the application with document URLs
      const applicationPayload = {
        vendorId: vendorId,
        fullName: profileData.fullName,
        businessName: profileData.businessName || '',
        vendorType: vendorType,
        serviceStyle: serviceStyle,
        email: profileData.email || `${phone}@warmpawz.com`, // Fallback email
        phone: phone,
        location: profileData.coordinates,
        address: profileData.address,
        city: profileData.city || '',
        state: profileData.state || '',
        pincode: profileData.pincode || '',
        gstNumber: profileData.gstNumber || '',
        panNumber: profileData.panNumber || '',
        licenseNumber: profileData.licenseNumber || '',
        licenseExpiryDate: profileData.licenseExpiryDate || '',
        documents: documents, // Now includes URLs!
        additionalInfo: {
          aadhaarNumber: profileData.aadhaarNumber,
          panNumber: profileData.panNumber,
          gstNumber: profileData.gstNumber,
          experience: profileData.experience,
          bankDetails: profileData.bankDetails
        }
      };

      console.log('📤 Application payload being sent:', {
        vendorId: applicationPayload.vendorId,
        documentsCount: applicationPayload.documents.length,
        documents: applicationPayload.documents
      });

      const result = await apiClient.post('/vendor/application/submit', applicationPayload) as any;

      if (result && result.success) {
        console.log('✅ Application submitted successfully:', result.applicationId);
        
        // Update local state
        setApplicationData({
          id: result.applicationId,
          status: 'pending'
        });
        
        // Show submitted screen
        setStatus('submitted');
        toast.success('Application submitted successfully!');
      } else {
        console.error('❌ Failed to submit application:', result);
        toast.error(result?.error || 'Failed to submit application. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting profile and application:', error);
      toast.error('An error occurred. Please try again.');
    }
  };

  const handleContinueFromSubmitted = () => {
    setStatus('pending');
  };

  const handleApproved = () => {
    setStatus('approved_services'); // Approved status means services setup is needed
  };

  const handleSetupComplete = async () => {
    console.log('🎯 [VendorLandingPage] handleSetupComplete called - updating vendor data...');
    
    // Refetch vendor data to get updated status
    try {
      const profileData = await apiClient.get(`/vendor/profile`) as any;

      if (profileData && profileData.vendor) {
        const vendor = profileData.vendorProfile || profileData.vendor;
        console.log('✅ [VendorLandingPage] Vendor data refreshed:', {
          setupCompleted: vendor?.setupCompleted,
          setupStage: vendor?.setupStage,
          isActive: vendor?.isActive
        });
        setVendorData(vendor);
      }
    } catch (error) {
      console.error('❌ [VendorLandingPage] Error refreshing vendor data:', error);
    }
    
    // Update status to active
    setStatus('active');
    if (onComplete) {
      onComplete();
    }
  };

  const handleResubmit = () => {
    setStatus('new');
  };

  // ✅ NEW: Handler for correcting and resubmitting after rejection or clarification
  const handleCorrectAndResubmit = async (mode: 'correction' | 'clarification') => {
    try {
      console.log(`📝 Starting re-onboarding in ${mode} mode...`);
      setLoading(true);
      
      // Load existing application data
      const data = await apiClient.get(`/make-server-3dd53475/vendor/application`) as any;
      
      if (data && data.success) {
        // data already available
        console.log('✅ Loaded existing application data:', data.application);
        
        setExistingApplicationData(data.application);
        setReEditMode(mode);
        setIsReEditing(true);
        setLoading(false);
        
        toast.success('Application loaded. Please update the required information.');
      } else {
        console.error('❌ Failed to load application:', data?.error);
        toast.error('Failed to load application data. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading application:', error);
      toast.error('An error occurred. Please try again.');
      setLoading(false);
    }
  };
  
  // ✅ NEW: Handler for completing re-onboarding
  const handleResubmitComplete = (data: any) => {
    console.log('✅ Resubmission complete:', data);
    
    // Reset re-editing state
    setIsReEditing(false);
    setExistingApplicationData(null);
    setReEditMode(null);
    
    // Reload vendor status
    if (initialVendorData) {
      processVendorData(initialVendorData);
    } else {
      checkVendorStatus();
    }
    
    toast.success('Application resubmitted successfully!');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ✅ NEW: Show re-onboarding screen if in edit mode
  if (isReEditing && existingApplicationData && vendorData) {
    console.log('📝 Rendering re-onboarding screen with mode:', reEditMode);
    
    // For re-submissions, use the regular VendorOnboarding flow
    // The vendor will need to go through service selection and form again
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-[430px] mx-auto p-4 bg-blue-50 border-b-2 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm">!</span>
            </div>
            <div>
              <h3 className="font-medium text-blue-900 mb-1">
                {reEditMode === 'correction' ? 'Correction Required' : 'Update Your Application'}
              </h3>
              <p className="text-sm text-blue-800">
                Please review and update your application details below.
              </p>
            </div>
          </div>
        </div>
        
        <EnhancedVendorOnboarding
          phone={phone}
          roleId={vendorData?.roleId} // ✅ Pass roleId for re-submissions
          onComplete={handleResubmitComplete}
          initialData={existingApplicationData} // ✅ Pass existing data for pre-filling
        />
      </div>
    );
  }

  // Log which screen we're about to render
  console.log('📺 RENDERING SCREEN FOR STATUS:', status);
  console.log('📺 Vendor Data:', vendorData);

  // Route to appropriate screen based on status
  switch (status) {
    case 'new':
    case 'profile_incomplete':
    case 'documents_required':
      return (
        <div className="min-h-screen bg-gray-50">
          {/* Show warning banner if documents are required */}
          {status === 'documents_required' && (
            <div className="w-full max-w-[430px] mx-auto p-4 bg-orange-50 border-b-2 border-orange-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm">!</span>
                </div>
                <div>
                  <h3 className="font-medium text-orange-900 mb-1">Documents Required</h3>
                  <p className="text-sm text-orange-800">
                    {vendorData?.documentNotes || 'Please re-upload your documents. Some documents are missing or need to be updated.'}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <EnhancedVendorOnboarding
            phone={phone}
            roleId={vendorData?.roleId} // ✅ Pass roleId even for new vendors
            onComplete={handleProfileSubmit}
          />
        </div>
      );

    case 'submitted':
      return (
        <VendorApplicationSubmitted
          applicationId={applicationData?.id || 'N/A'}
          onContinue={handleContinueFromSubmitted}
        />
      );

    case 'pending':
      return (
        <VendorApplicationUnderReview
          submittedAt={vendorData?.submittedAt || vendorData?.createdAt || new Date().toISOString()}
          isReapproval={vendorData?.wasApprovedBefore || vendorData?.previousStatus === 'approved'}
          reapprovalReason={vendorData?.reapprovalReason}
        />
      );
    
    case 'clarification':
      return (
        <VendorClarificationRequested
          applicationId={vendorData?.applicationId || applicationData?.id || 'N/A'}
          clarificationNotes={vendorData?.infoRequestMessage || applicationData?.clarificationNotes || 'Please update your application.'}
          reviewerName="Admin"
          onCorrectAndResubmit={() => handleCorrectAndResubmit('clarification')}
        />
      );

    case 'approved_services':
      return (
        <VendorApprovedSetup
          vendorId={vendorId}
          roleId={vendorData?.roleId}
          onComplete={handleSetupComplete}
        />
      );

    case 'approved_availability':
      return (
        <VendorAvailabilitySetup
          vendorId={vendorId}
          onComplete={handleSetupComplete}
        />
      );

    case 'setup_completed':
      return (
        <VendorSetupCompleted
          onContinue={handleSetupComplete}
        />
      );

    case 'rejected':
      return (
        <VendorApplicationRejected
          applicationId={vendorData?.applicationId || applicationData?.id || 'N/A'}
          rejectionReason={vendorData?.rejectionReason || applicationData?.rejectionReason || 'No reason provided'}
          allowResubmit={applicationData?.allowResubmit !== false}
          onResubmit={handleResubmit}
          onCorrectAndResubmit={() => handleCorrectAndResubmit('correction')}
        />
      );

    case 'active':
      // ✅ DASHBOARD: Use VendorDashboardScreen (copied from React Native app)
      // This provides a clean dashboard experience with stats, schedule, and quick actions
      
      console.log('🎯 Vendor is ACTIVE - showing VendorDashboardScreen');
      console.log('   Vendor Role:', vendorData?.roleId);
      console.log('   Vendor Type:', vendorData?.vendorType);
      
      // Show schedule management screen if requested
      if (showScheduleManagement) {
        return (
          <VendorScheduleManagement
            vendorId={vendorId}
            onBack={() => setShowScheduleManagement(false)}
          />
        );
      }
      
      // Show service management screen if requested
      if (showServiceManagement) {
        return (
          <VendorServiceManagementComplete
            vendorId={vendorId}
            vendorData={vendorData}
            fromStaffManagement={returnToStaffManagement}
            onBack={() => {
              setShowServiceManagement(false);
              if (returnToStaffManagement) {
                setReturnToStaffManagement(false);
                setShowStaffManagement(true);
              }
            }}
          />
        );
      }
      
      // Show consultation screen if requested
      if (showConsultation) {
        return (
          <VendorConsultationScreen
            vendorId={vendorId}
            
            onBack={() => setShowConsultation(false)}
          />
        );
      }
      
      // Show booking management screen if requested
      if (showBookingManagement) {
        return (
          <VendorBookingManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowBookingManagement(false)}
            chatEnabled={!!capabilities?.chat}
            vendorPhone={vendorData?.phone}
            vendorName={vendorData?.fullName || vendorData?.businessName}
          />
        );
      }
      
      // Show tele consultation screen if requested
      if (showTeleConsultation) {
        return (
          <VendorTeleConsultationFlow
            vendorId={vendorId}
            
            onBack={() => setShowTeleConsultation(false)}
          />
        );
      }
      
      // Show facility management screen if requested
      if (showFacilityManagement) {
        return (
          <FacilityManagement
            vendorId={vendorId}
            
            onBack={() => setShowFacilityManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Show Center Profile Manager screen if requested
      if (showCenterProfile) {
        return (
          <CenterProfileManager
            vendorId={vendorId}
            
            onBack={() => setShowCenterProfile(false)}
          />
        );
      }
      
      // Show staff management screen if requested
      // ✅ FIX: Use DoctorManagement for clinic/vet roles (full Figma UI)
      if (showStaffManagement) {
        // Check roleId or role_id fields
        const roleIdValue = vendorData?.roleId || (vendorData as any)?.role_id || '';
        const isClinicRoleId = ['veterinary_clinic', 'pet_clinic', 'veterinarian'].includes(roleIdValue);
        
        // Fallback: Detect clinic from business_name if roleId is not set
        const businessName = (vendorData?.businessName || (vendorData as any)?.business_name || '').toLowerCase();
        const isClinicByName = businessName.includes('veterinary') || 
                               businessName.includes('clinic') || 
                               businessName.includes('hospital') ||
                               businessName.includes('vet ');
        
        const isClinicRole = isClinicRoleId || isClinicByName;
        
        if (isClinicRole) {
          return (
            <DoctorManagement
              clinicId={vendorId}
              clinicData={vendorData}
              onBack={() => setShowStaffManagement(false)}
            />
          );
        }
        
        // Non-clinic vendors use VendorStaffPage
        return (
          <div className="min-h-screen bg-gray-50">
            <VendorStaffPage
              vendorId={vendorId}
            />
            <div className="fixed bottom-4 left-4">
              <button
                onClick={() => setShowStaffManagement(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ← Back
              </button>
            </div>
          </div>
        );
      }

      // ✅ NEW: Render VendorBusinessHub
      if (showBusinessHub) {
        return (
          <VendorBusinessHub 
            vendorId={vendorId}
            
            onBack={() => setShowBusinessHub(false)}
          />
        );
      }
      
      // ✅ NEW: Support Tickets Dashboard
      if (showSupportDashboard) {
        return <VendorSupportDashboard vendorId={vendorId} />;
      }
      
      // ✅ NEW: Vet Specialized Services Manager
      if (showVetSpecialized) {
        return (
          <VetSpecializedServicesManager
            vendorId={vendorId}
            
            onBack={() => setShowVetSpecialized(false)}
          />
        );
      }
      
      // ✅ NEW: Nutritionist Meal Manager
      if (showNutritionistMealManager) {
        return (
          <NutritionistMealManager
            vendorId={vendorId}
            
            onBack={() => setShowNutritionistMealManager(false)}
          />
        );
      }
      
      // ✅ FIX: Gallery Management
      if (showGallery) {
        return (
          <VendorGalleryManagement
            vendorId={vendorId}
            
            onBack={() => setShowGallery(false)}
          />
        );
      }
      
      // ✅ FIX: Portfolio Management
      if (showPortfolio) {
        return (
          <VendorPortfolioManagement
            vendorId={vendorId}
            
            onBack={() => setShowPortfolio(false)}
          />
        );
      }
      
      // ✅ FIX: CCTV Access
      if (showCCTV) {
        return (
          <VendorCCTVAccess
            vendorId={vendorId}
            
            onBack={() => setShowCCTV(false)}
          />
        );
      }
      
      // ✅ FIX: Controlled Substances Management
      if (showControlledSubstances) {
        return (
          <VendorControlledSubstances
            vendorId={vendorId}
            
            onBack={() => setShowControlledSubstances(false)}
          />
        );
      }
      
      // ✅ FIX: Prescription Builder
      if (showPrescription) {
        return (
          <VendorPrescriptionBuilder
            vendorId={vendorId}
            
            onBack={() => setShowPrescription(false)}
          />
        );
      }
      
      // ✅ FIX: Progress Tracking Dashboard
      if (showProgressTracking) {
        return (
          <ProgressTrackingDashboard
            vendorId={vendorId}
            
            onBack={() => setShowProgressTracking(false)}
          />
        );
      }
      
      // ✅ FIX: Package Management
      if (showPackages) {
        return (
          <PackageManagementContainer
            vendorId={vendorId}
            
            onBack={() => setShowPackages(false)}
          />
        );
      }
      
      // ✅ FIX: Custom Service Creation
      if (showCustomServices) {
        return (
          <VendorCustomServiceCreation
            vendorId={vendorId}
            
            serviceStyle={vendorData?.serviceStyle === 'both' ? 'both' : 'at_center'}
            onClose={() => setShowCustomServices(false)}
            onServiceCreated={() => {
              setShowCustomServices(false);
              // Refresh services if needed
            }}
          />
        );
      }
      
      // ✅ FIX: Adoption System
      if (showAdoptionSystem) {
        return (
          <ShelterAdoptionSystem
            vendorId={vendorId}
            
            onBack={() => setShowAdoptionSystem(false)}
          />
        );
      }
      
      // ✅ FIX: Memorial Services
      if (showMemorialServices) {
        return (
          <VendorMemorialServices
            vendorId={vendorId}
            
            onBack={() => setShowMemorialServices(false)}
          />
        );
      }
      
      // ✅ NEW: Expiry Management
      if (showExpiryManagement) {
        return (
          <VendorExpiryManagement
            vendorId={vendorId}
            
            onBack={() => setShowExpiryManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Donation Management
      if (showDonationManagement) {
        return (
          <VendorDonationManagement
            vendorId={vendorId}
            
            onBack={() => setShowDonationManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Event Management
      if (showEventManagement) {
        return (
          <VendorEventManagement
            vendorId={vendorId}
            
            onBack={() => setShowEventManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Patient Monitoring
      if (showPatientMonitoring) {
        return (
          <VendorPatientMonitoring
            vendorId={vendorId}
            
            onBack={() => setShowPatientMonitoring(false)}
          />
        );
      }
      
      // ✅ NEW: Cafe Menu Management
      if (showCafeMenuManagement) {
        return (
          <VendorCafeMenuManagement
            vendorId={vendorId}
            
            onBack={() => setShowCafeMenuManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Prescription Verification
      if (showPrescriptionVerification) {
        return (
          <VendorPrescriptionVerification
            vendorId={vendorId}
            
            onBack={() => setShowPrescriptionVerification(false)}
          />
        );
      }
      
      // ✅ NEW: Delivery Management
      if (showDeliveryManagement) {
        return (
          <VendorDeliveryManagement
            vendorId={vendorId}
            
            onBack={() => setShowDeliveryManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Diet Charts
      if (showDietCharts) {
        return (
          <VendorDietCharts
            vendorId={vendorId}
            
            onBack={() => setShowDietCharts(false)}
          />
        );
      }
      
      // ✅ NEW: Counseling
      if (showCounseling) {
        return (
          <VendorCounseling
            vendorId={vendorId}
            
            onBack={() => setShowCounseling(false)}
          />
        );
      }
      
      // ✅ NEW: Policy Management
      if (showPolicyManagement) {
        return (
          <VendorPolicyManagement
            vendorId={vendorId}
            
            onBack={() => setShowPolicyManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Distance Pricing (uses onClose)
      if (showDistancePricing) {
        return (
          <VendorDistancePricing
            vendorId={vendorId}
            onClose={() => setShowDistancePricing(false)}
          />
        );
      }
      
      // ⚡️ ROLE-SPECIFIC DASHBOARDS
      // Some roles have specialized dashboards with unique capabilities outside the universal config
      
      // 1. Veterinary Clinic - NOW USES VendorDashboard for comprehensive features
      // VendorDashboard includes: Quick Actions, Center Profile, Vet Services (Pharmacy/Diagnostics/Ambulance)
      // Removed ClinicDashboard as it was too limited and missing key vet features

      // 2. Pet Cafe
      if (vendorData?.roleId === 'pet_cafe') {
        console.log('☕ Rendering CafeVendorDashboard');
        return (
          <CafeVendorDashboard
            vendorId={vendorId}
          />
        );
      }

      // 3. Pet Resort
      if (vendorData?.roleId === 'pet_resort') {
        console.log('🏨 Rendering ResortManagementDashboard');
        return (
          <ResortManagementDashboard
            vendorId={vendorId}
            
            onBack={() => {
              // Handle logout or settings
            }}
          />
        );
      }

      // 4. Nutritionist
      if (vendorData?.roleId === 'nutritionist') {
        console.log('🥗 Rendering NutritionistMealManager');
        return (
          <NutritionistMealManager
            vendorId={vendorId}
            
            onBack={() => {
              // Handle logout
            }}
          />
        );
      }

      // 5. Sunset Services (Memorial/Cremation)
      if (vendorData?.roleId === 'sunset_services') {
        console.log('🌅 Rendering SunsetServicesVendorDashboard');
        return (
          <SunsetServicesVendorDashboard
            vendorId={vendorId}
          />
        );
      }

      // 6. Insurance Provider
      if (vendorData?.roleId === 'insurance') {
        console.log('🛡️ Rendering InsuranceVendorContainer');
        return (
          <InsuranceVendorContainer
            vendorId={vendorId}
          />
        );
      }

      // 7. Pet Products Store / Retailer - Redirect to Seller Hub (E-Commerce Dashboard)
      // Check role by name OR by UUID (pet_products_store UUID = 5056756d-3b05-457a-9725-3f922800b520)
      const roleId = vendorData?.roleId || (vendorData as any)?.role_id || (vendorData as any)?.selected_role_id;
      const roleName = (vendorData as any)?.roleName || (vendorData as any)?.role_name || '';
      const PET_PRODUCTS_STORE_UUID = '5056756d-3b05-457a-9725-3f922800b520';
      const PET_PHARMACY_UUID = ''; // Add if known
      const isRetailVendor = roleId === 'pet_products_store' || roleId === 'product_seller' || 
                             roleId === 'pet_pharmacy' || roleId === PET_PRODUCTS_STORE_UUID ||
                             roleName === 'pet_products_store' || roleName === 'Pet Store / Retailer' ||
                             roleId?.includes('retail') || roleId?.includes('store') ||
                             (vendorData as any)?.vendor_type === 'seller';
      if (isRetailVendor) {
        console.log('🏪 Pet Products Store detected - redirecting to Seller Hub. RoleId:', roleId, 'RoleName:', roleName);
        router.push('/seller');
        return (
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading Seller Hub...</p>
            </div>
          </div>
        );
      }
      
      // ✅ FIX: Use VendorDashboard (actual Figma UI) instead of VendorDashboardScreen (placeholder)
      // VendorDashboard is the comprehensive 1200+ line component with all capabilities
      console.log('🎯 Rendering VendorDashboard (Figma UI) for vendor:', vendorId);
      
      return (
        <VendorDashboard
          vendorId={vendorId}
          
          onNavigateToConsultation={() => setShowConsultation(true)}
          onNavigateToServiceManagement={() => {
            // Check if this is a retail/product vendor
            const roleId = vendorData?.roleId || (vendorData as any)?.role_id;
            const isRetail = roleId?.includes('product') || roleId?.includes('retail') || roleId?.includes('pharmacy') || roleId?.includes('store');
            if (isRetail) {
              // Navigate to products catalog page for retail vendors
              router.push('/products');
            } else {
              setShowServiceManagement(true);
            }
          }}
          onNavigateToBookingManagement={() => setShowBookingManagement(true)}
          onNavigateToTeleConsultation={() => setShowTeleConsultation(true)}
          onNavigateToScheduleManagement={() => setShowScheduleManagement(true)}
          onNavigateToCenterProfile={() => setShowCenterProfile(true)}
          onNavigateToFacilityManagement={() => setShowFacilityManagement(true)}
          onNavigateToStaffManagement={() => setShowStaffManagement(true)}
          onNavigateToBusinessHub={() => setShowBusinessHub(true)}
          onNavigateToSupport={() => setShowSupportDashboard(true)}
          onNavigateToLiveTracking={() => setShowLiveTracking(true)}
          onNavigateToSpecializedServices={() => setShowSpecializedServices(true)}
          onNavigateToGallery={() => setShowGallery(true)}
          onNavigateToPortfolio={() => setShowPortfolio(true)}
          onNavigateToCCTV={() => setShowCCTV(true)}
          onNavigateToControlledSubstances={() => setShowControlledSubstances(true)}
          onNavigateToPrescription={() => setShowPrescription(true)}
          onNavigateToProgressTracking={() => setShowProgressTracking(true)}
          onNavigateToPackages={() => setShowPackages(true)}
          onNavigateToCustomServices={() => setShowCustomServices(true)}
          onNavigateToAdoptionSystem={() => setShowAdoptionSystem(true)}
          onNavigateToMemorialServices={() => setShowMemorialServices(true)}
          onNavigateToExpiryManagement={() => setShowExpiryManagement(true)}
          onNavigateToDonationManagement={() => setShowDonationManagement(true)}
          onNavigateToEventManagement={() => setShowEventManagement(true)}
          onNavigateToPatientMonitoring={() => setShowPatientMonitoring(true)}
          onNavigateToCafeMenuManagement={() => setShowCafeMenuManagement(true)}
          onNavigateToCafeTables={() => router.push('/cafe/tables')}
          onNavigateToPrescriptionVerification={() => setShowPrescriptionVerification(true)}
          onNavigateToDeliveryManagement={() => setShowDeliveryManagement(true)}
          onNavigateToDietCharts={() => setShowDietCharts(true)}
          onNavigateToCounseling={() => setShowCounseling(true)}
          onNavigateToDistancePricing={() => setShowDistancePricing(true)}
          onNavigateToPolicyManagement={() => setShowPolicyManagement(true)}
        />
      );

    default:
      return null;
  }
}