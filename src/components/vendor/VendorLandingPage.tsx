/**
 * Vendor Landing Page - Main Entry Point for Vendor Portal
 * Handles all vendor lifecycle states from onboarding to active operations
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { handleVendorError, isVendorNotFound } from './utils/vendor-error-handler';
import { useVendorNotificationService } from './useVendorNotificationService';
import { StaffManagement } from './StaffManagement';
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
import { VendorDashboard } from './VendorDashboard';
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
import { VendorMultiDoctorManagement } from './VendorMultiDoctorManagement'; // ✅ NEW: Multi-doctor management
import { VendorTableManagement } from './VendorTableManagement'; // ✅ NEW: Table management
import { VendorPaxManagement } from './VendorPaxManagement'; // ✅ NEW: Pax management
import { VendorOccupancyTracking } from './VendorOccupancyTracking'; // ✅ NEW: Occupancy tracking
import { VendorNightlyPricing } from './VendorNightlyPricing'; // ✅ NEW: Nightly pricing

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
  const [showPrescriptionVerification, setShowPrescriptionVerification] = useState(false); // ✅ NEW: Prescription verification
  const [showDeliveryManagement, setShowDeliveryManagement] = useState(false); // ✅ NEW: Delivery management
  const [showDietCharts, setShowDietCharts] = useState(false); // ✅ NEW: Diet charts
  const [showCounseling, setShowCounseling] = useState(false); // ✅ NEW: Counseling services
  const [showPolicyManagement, setShowPolicyManagement] = useState(false); // ✅ NEW: Policy management
  const [showDistancePricing, setShowDistancePricing] = useState(false); // ✅ NEW: Distance pricing
  const [showMultiDoctorManagement, setShowMultiDoctorManagement] = useState(false); // ✅ NEW: Multi-doctor management
  const [showTableManagement, setShowTableManagement] = useState(false); // ✅ NEW: Table management
  const [showPaxManagement, setShowPaxManagement] = useState(false); // ✅ NEW: Pax management
  const [showOccupancyTracking, setShowOccupancyTracking] = useState(false); // ✅ NEW: Occupancy tracking
  const [showNightlyPricing, setShowNightlyPricing] = useState(false); // ✅ NEW: Nightly pricing
  
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
  
  useEffect(() => {
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
      setupCompleted: vendor.setupCompleted,
      isActive: vendor.isActive,
      applicationId: vendor.applicationId,
      roleId: vendor.roleId
    });
    
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
        // ✅ PHASE 2 FIX 2.1: Always use database status for routing decisions
        // Remove justSubmitted dependency - routing must be deterministic based on database status only
        // justSubmitted flag is ONLY for immediate UI feedback (toast, animation) - NOT for routing
        // On refresh/logout/re-login, vendor with status='pending' should ALWAYS see "pending" screen
        console.log(`✅ Vendor has pending/submitted application - showing pending screen`);
        console.log(`   Database status: ${vendor.status} (routing based on database, not frontend flag)`);
        setStatus('pending'); // ✅ Always show pending screen when status='pending' in database
        
        // Optional: Show toast/notification if justSubmitted is true (UI feedback only)
        if (justSubmitted) {
          console.log('   📢 Showing submission success notification (UI feedback only)');
          // Toast notification can be shown here if needed
        }
      }
    } else if (vendor.status === 'approved') {
      // ✅ PHASE 2 FIX 2.3: Use setup_completed flag only (setupStage may not be stored in database)
      // Simplified routing logic based on actual database fields
      
      // ✅ FIX: If vendor is approved AND active, show dashboard immediately
      // This handles existing vendors who are already fully onboarded
      if (vendor.isActive === true) {
        console.log('✅ Vendor is APPROVED and ACTIVE - showing dashboard');
        setStatus('active');
      } else if (vendor.setupCompleted === true) {
        // Setup completed but not yet active (shouldn't happen, but handle gracefully)
        console.log('✅ Setup completed but not active - showing completion screen');
        setStatus('setup_completed');
      } else {
        // Approved but setup not complete - show service setup screen
        // Note: setupStage, servicesConfigured, availabilityConfigured may not be in database
        // Use setup_completed flag as the source of truth
        console.log('🎯 Approved but setup not complete - showing service setup');
        setStatus('approved_services');
      }
    } else if (vendor.status === 'rejected') {
      console.log('❌ Vendor application rejected - showing rejection screen');
      setStatus('rejected');
    } else if (vendor.status === 'more_info_required' || vendor.status === 'clarification_requested') {
      // ✅ PHASE 3 FIX 3.2: Standardize status handling (both values map to clarification screen)
      console.log('📝 More info/clarification requested - showing status screen');
      console.log(`   Status: ${vendor.status} (standardized to clarification screen)`);
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
      const profileResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/profile/${vendorId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setVendorData(profileData.vendor);

        // Check if they have an application
        if (profileData.vendor?.applicationId) {
          // Load application status
          const appResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/application/status/${vendorId}`,
            {
              headers: { 'Authorization': `Bearer ${publicAnonKey}` }
            }
          );

          if (appResponse.ok) {
            const appData = await appResponse.json();
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
              // ✅ PHASE 2 FIX 2.1: Always show pending screen (remove justSubmitted dependency)
              setStatus('pending');
            }
          }
        } else if (profileData.vendor?.profileCreated) {
          // Profile exists but no application submitted
          setStatus('profile_incomplete');
        } else {
          setStatus('new');
        }
      } else {
        // No profile found - use standardized error handler
        const errorData = await profileResponse.json().catch(() => ({}));
        const error = { status: profileResponse.status, ...errorData };
        
        handleVendorError(error, vendorId);
        
        if (isVendorNotFound(error)) {
          console.warn(`⚠️ Vendor not found: ${vendorId}. Showing new vendor form.`);
        }
        setStatus('new');
      }
    } catch (error: any) {
      console.error('❌ Error checking vendor status:', error);
      handleVendorError(error, vendorId);
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
      const uploadResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/storage/upload-multiple`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: formData
        }
      );
      
      if (!uploadResponse.ok) {
        const error = await uploadResponse.text();
        console.error('❌ Upload failed:', error);
        toast.error('Failed to upload documents');
        return;
      }
      
      const uploadResult = await uploadResponse.json();
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

      const profileResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/profile/save`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(vendorProfile)
        }
      );

      if (!profileResponse.ok) {
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

      const appResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/application/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify(applicationPayload)
        }
      );

      if (appResponse.ok) {
        const result = await appResponse.json();
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
        const error = await appResponse.json();
        console.error('❌ Failed to submit application:', error);
        toast.error('Failed to submit application. Please try again.');
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
    setStatus('approved');
  };

  const handleSetupComplete = async () => {
    console.log('🎯 [VendorLandingPage] handleSetupComplete called - updating vendor data...');
    
    // Refetch vendor data to get updated status
    try {
      const profileResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/profile/${vendorId}`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
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

  // ✅ PHASE 4 FIX 4.2: Handle resubmission after rejection
  // This clears vendor data and allows them to start fresh application
  const handleResubmit = () => {
    console.log('🔄 Starting fresh application after rejection');
    // Clear vendor data to allow fresh application
    setVendorData(null);
    setApplicationData(null);
    setStatus('new');
    // Note: Vendor will need to go through role selection and onboarding again
  };

  // ✅ NEW: Handler for correcting and resubmitting after rejection or clarification
  const handleCorrectAndResubmit = async (mode: 'correction' | 'clarification') => {
    try {
      console.log(`📝 Starting re-onboarding in ${mode} mode...`);
      setLoading(true);
      
      // Load existing application data
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/application`,
        {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Loaded existing application data:', data.application);
        
        setExistingApplicationData(data.application);
        setReEditMode(mode);
        setIsReEditing(true);
        setLoading(false);
        
        toast.success('Application loaded. Please update the required information.');
      } else {
        const error = await response.json();
        console.error('❌ Failed to load application:', error);
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
      // ✅ PHASE 4 FIX 4.2: Extract rejection reason from vendor data
      // Rejection reason is stored in rejection_reason column (snake_case) or metadata.rejection
      const rejectionReason = vendorData?.rejectionReason || 
                             vendorData?.rejection_reason || 
                             applicationData?.rejectionReason || 
                             (vendorData?.metadata as any)?.rejection?.rejection_reason ||
                             'No reason provided';
      
      return (
        <VendorApplicationRejected
          applicationId={vendorData?.applicationId || applicationData?.id || 'N/A'}
          rejectionReason={rejectionReason}
          allowResubmit={true} // ✅ PHASE 4 FIX 4.2: Always allow resubmit after rejection
          onResubmit={handleResubmit}
          onCorrectAndResubmit={() => handleCorrectAndResubmit('correction')}
        />
      );

    case 'active':
      // ✅ UNIVERSAL DASHBOARD: Use VendorDashboard for ALL vendor types
      // This provides a consistent, full-featured dashboard experience
      // with appointment management, stats, service management, staff management, etc.
      // This dashboard has all integrations with admin panel service catalog, booking flows, etc.
      
      console.log('🎯 Vendor is ACTIVE - showing universal VendorDashboard');
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
            fromStaffManagement={returnToStaffManagement} // ✅ Pass the flag
            onBack={() => {
              setShowServiceManagement(false);
              // ✅ If we came from staff management, return there
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
            vendorData={vendorData}
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
          />
        );
      }
      
      // Show tele consultation screen if requested
      if (showTeleConsultation) {
        return (
          <VendorTeleConsultationFlow
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowTeleConsultation(false)}
          />
        );
      }
      
      // Show facility management screen if requested
      if (showFacilityManagement) {
        return (
          <FacilityManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowFacilityManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Show Center Profile Manager screen if requested
      if (showCenterProfile) {
        return (
          <CenterProfileManager
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowCenterProfile(false)}
          />
        );
      }
      
      // Show staff management screen if requested
      if (showStaffManagement) {
        return (
          <StaffManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowStaffManagement(false)}
            onNavigateToServices={() => {
              setShowStaffManagement(false); // ✅ Close staff management
              setShowServiceManagement(true); // ✅ Open service management
              setReturnToStaffManagement(true); // ✅ NEW: Track that we came from staff management
            }}
          />
        );
      }

      // ✅ NEW: Render VendorBusinessHub
      if (showBusinessHub) {
        return (
          <VendorBusinessHub 
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowBusinessHub(false)}
          />
        );
      }
      
      // ✅ NEW: Vet Specialized Services Manager
      if (showVetSpecialized) {
        return (
          <VetSpecializedServicesManager
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowVetSpecialized(false)}
          />
        );
      }
      
      // ✅ NEW: Nutritionist Meal Manager
      if (showNutritionistMealManager) {
        return (
          <NutritionistMealManager
            vendorId={vendorId}
            vendorName={vendorData?.fullName || vendorData?.businessName || 'Nutritionist'}
            onBack={() => setShowNutritionistMealManager(false)}
          />
        );
      }
      
      // ✅ FIX: Gallery Management
      if (showGallery) {
        return (
          <VendorGalleryManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowGallery(false)}
          />
        );
      }
      
      // ✅ FIX: Portfolio Management
      if (showPortfolio) {
        return (
          <VendorPortfolioManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowPortfolio(false)}
          />
        );
      }
      
      // ✅ FIX: CCTV Access
      if (showCCTV) {
        return (
          <VendorCCTVAccess
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowCCTV(false)}
          />
        );
      }
      
      // ✅ FIX: Controlled Substances Management
      if (showControlledSubstances) {
        return (
          <VendorControlledSubstances
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowControlledSubstances(false)}
          />
        );
      }
      
      // ✅ FIX: Prescription Builder
      if (showPrescription) {
        return (
          <VendorPrescriptionBuilder
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowPrescription(false)}
          />
        );
      }
      
      // ✅ FIX: Progress Tracking Dashboard
      if (showProgressTracking) {
        return (
          <ProgressTrackingDashboard
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowProgressTracking(false)}
          />
        );
      }
      
      // ✅ FIX: Package Management
      if (showPackages) {
        return (
          <PackageManagementContainer
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowPackages(false)}
          />
        );
      }
      
      // ✅ FIX: Custom Service Creation
      if (showCustomServices) {
        // ✅ FIX: Determine serviceStyle from vendorData
        // Custom services are only allowed for center-based vendors (at_center or both)
        let determinedServiceStyle: 'at_center' | 'both' = 'at_center';
        
        // Check service_styles array (from database)
        if (vendorData?.service_styles && Array.isArray(vendorData.service_styles)) {
          if (vendorData.service_styles.includes('at_center') && vendorData.service_styles.includes('at_home')) {
            determinedServiceStyle = 'both';
          } else if (vendorData.service_styles.includes('at_center')) {
            determinedServiceStyle = 'at_center';
          }
        } 
        // Check serviceStyle field (from props or state)
        else if (vendorData?.serviceStyle === 'both' || vendorData?.serviceStyle === 'at_center') {
          determinedServiceStyle = vendorData.serviceStyle;
        }
        // Check vendor_type or roleId to infer
        else if (vendorData?.vendor_type === 'center' || 
                 vendorData?.roleId?.includes('clinic') || 
                 vendorData?.roleId?.includes('salon') ||
                 vendorData?.roleId?.includes('resort')) {
          determinedServiceStyle = 'at_center';
        }
        // Use prop serviceStyle if available
        else if (serviceStyle === 'both' || serviceStyle === 'at_center') {
          determinedServiceStyle = serviceStyle;
        }
        // Default to at_center for custom services (only center-based vendors can create custom services)
        else {
          determinedServiceStyle = 'at_center';
        }
        
        return (
          <VendorCustomServiceCreation
            vendorId={vendorId}
            vendorData={vendorData}
            serviceStyle={determinedServiceStyle}
            onClose={() => setShowCustomServices(false)}
            onServiceCreated={() => {
              // Reload vendor data or refresh services list
              toast.success('Custom service created successfully!');
            }}
          />
        );
      }
      
      // ✅ FIX: Adoption System
      if (showAdoptionSystem) {
        return (
          <ShelterAdoptionSystem
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowAdoptionSystem(false)}
          />
        );
      }
      
      // ✅ FIX: Memorial Services
      if (showMemorialServices) {
        return (
          <VendorMemorialServices
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowMemorialServices(false)}
          />
        );
      }
      
      // ✅ NEW: Expiry Management
      if (showExpiryManagement) {
        return (
          <VendorExpiryManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowExpiryManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Donation Management
      if (showDonationManagement) {
        return (
          <VendorDonationManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowDonationManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Event Management
      if (showEventManagement) {
        return (
          <VendorEventManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowEventManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Patient Monitoring
      if (showPatientMonitoring) {
        return (
          <VendorPatientMonitoring
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowPatientMonitoring(false)}
          />
        );
      }
      
      // ✅ NEW: Cafe Menu Management
      if (showCafeMenuManagement) {
        return (
          <VendorCafeMenuManagement
            vendorId={vendorId}
            vendorData={vendorData}
            onBack={() => setShowCafeMenuManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Prescription Verification
      if (showPrescriptionVerification) {
        return (
          <VendorPrescriptionVerification
            vendorId={vendorId}
            onClose={() => setShowPrescriptionVerification(false)}
          />
        );
      }
      
      // ✅ NEW: Delivery Management
      if (showDeliveryManagement) {
        return (
          <VendorDeliveryManagement
            vendorId={vendorId}
            onClose={() => setShowDeliveryManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Diet Charts
      if (showDietCharts) {
        return (
          <VendorDietCharts
            vendorId={vendorId}
            onClose={() => setShowDietCharts(false)}
          />
        );
      }
      
      // ✅ NEW: Counseling
      if (showCounseling) {
        return (
          <VendorCounseling
            vendorId={vendorId}
            onClose={() => setShowCounseling(false)}
          />
        );
      }
      
      // ✅ NEW: Policy Management
      if (showPolicyManagement) {
        return (
          <VendorPolicyManagement
            vendorId={vendorId}
            onClose={() => setShowPolicyManagement(false)}
          />
        );
      }
      
      // ✅ NEW: Distance Pricing
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
            vendorData={vendorData}
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
            vendorName={vendorData.fullName || vendorData.businessName || 'Nutritionist'}
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
      
      // Default: show universal VendorDashboard (matches vendor 9876543216 experience)
      return (
        <VendorDashboard
          vendorId={vendorId}
          vendorData={vendorData}
          onNavigateToConsultation={() => setShowConsultation(true)}
          onNavigateToServiceManagement={() => setShowServiceManagement(true)}
          onNavigateToBookingManagement={() => setShowBookingManagement(true)}
          onNavigateToTeleConsultation={() => setShowTeleConsultation(true)}
          onNavigateToScheduleManagement={() => setShowScheduleManagement(true)}
          onNavigateToCenterProfile={() => setShowCenterProfile(true)} // ✅ NEW: Navigate to Center Profile
          onNavigateToFacilityManagement={() => setShowFacilityManagement(true)}
          onNavigateToStaffManagement={() => setShowStaffManagement(true)}
          onNavigateToBusinessHub={() => setShowBusinessHub(true)} // ✅ NEW
          onNavigateToLiveTracking={() => setShowBookingManagement(true)} // ✅ Live tracking routes to bookings where active sessions are managed
          onNavigateToSpecializedServices={() => setShowVetSpecialized(true)} // ✅ NEW: Navigate to Vet Specialized Services
          onNavigateToGallery={() => setShowGallery(true)} // ✅ FIX: Gallery navigation
          onNavigateToPortfolio={() => setShowPortfolio(true)} // ✅ FIX: Portfolio navigation
          onNavigateToCCTV={() => setShowCCTV(true)} // ✅ FIX: CCTV navigation
          onNavigateToControlledSubstances={() => setShowControlledSubstances(true)} // ✅ FIX: Controlled substances navigation
          onNavigateToPrescription={() => setShowPrescription(true)} // ✅ FIX: Prescription builder navigation
          onNavigateToProgressTracking={() => setShowProgressTracking(true)} // ✅ FIX: Progress tracking navigation
          onNavigateToPackages={() => setShowPackages(true)} // ✅ FIX: Packages navigation
          onNavigateToCustomServices={() => setShowCustomServices(true)} // ✅ FIX: Custom services navigation
          onNavigateToAdoptionSystem={() => setShowAdoptionSystem(true)} // ✅ FIX: Adoption system navigation
          onNavigateToMemorialServices={() => setShowMemorialServices(true)} // ✅ FIX: Memorial services navigation
          onNavigateToExpiryManagement={() => setShowExpiryManagement(true)} // ✅ NEW: Expiry management navigation
          onNavigateToDonationManagement={() => setShowDonationManagement(true)} // ✅ NEW: Donation management navigation
          onNavigateToEventManagement={() => setShowEventManagement(true)} // ✅ NEW: Event management navigation
          onNavigateToPatientMonitoring={() => setShowPatientMonitoring(true)} // ✅ NEW: Patient monitoring navigation
          onNavigateToCafeMenuManagement={() => setShowCafeMenuManagement(true)} // ✅ NEW: Cafe menu management navigation
          onNavigateToPrescriptionVerification={() => setShowPrescriptionVerification(true)} // ✅ NEW: Prescription verification navigation
          onNavigateToDeliveryManagement={() => setShowDeliveryManagement(true)} // ✅ NEW: Delivery management navigation
          onNavigateToDietCharts={() => setShowDietCharts(true)} // ✅ NEW: Diet charts navigation
          onNavigateToCounseling={() => setShowCounseling(true)} // ✅ NEW: Counseling services navigation
          onNavigateToPolicyManagement={() => setShowPolicyManagement(true)} // ✅ NEW: Policy management navigation
          onNavigateToDistancePricing={() => setShowDistancePricing(true)} // ✅ NEW: Distance pricing navigation
          onNavigateToMultiDoctorManagement={() => setShowMultiDoctorManagement(true)} // ✅ NEW: Multi-doctor management navigation
          onNavigateToTableManagement={() => setShowTableManagement(true)} // ✅ NEW: Table management navigation
          onNavigateToPaxManagement={() => setShowPaxManagement(true)} // ✅ NEW: Pax management navigation
          onNavigateToOccupancyTracking={() => setShowOccupancyTracking(true)} // ✅ NEW: Occupancy tracking navigation
          onNavigateToNightlyPricing={() => setShowNightlyPricing(true)} // ✅ NEW: Nightly pricing navigation
        />
      );

    default:
      return null;
  }
}