'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VendorRoleSelection } from './VendorRoleSelection';
import { VendorOnboardingFlow } from './VendorOnboardingFlow';
import { VendorApplicationSubmitted } from './VendorApplicationSubmitted';
import { VendorApplicationUnderReview } from './VendorApplicationUnderReview';
import { VendorApplicationRejected } from './VendorApplicationRejected';
import { VendorClarificationRequested } from './VendorClarificationRequested';
import { VendorCapabilityDashboard } from './VendorCapabilityDashboard';
import { apiClient, isUatMode } from '@/lib/api-client';

interface VendorSession {
  phone: string;
  vendorId?: string;
  vendor?: any;
  sessionToken?: string;
  verified: boolean;
  isStaffLogin?: boolean;
  staff?: any;
}

interface VendorAppProps {
  initialSession: VendorSession;
}

type VendorStatus = 
  | 'new'                    
  | 'profile_incomplete'     
  | 'submitted'              
  | 'pending'                
  | 'approved'               
  | 'rejected'               
  | 'clarification'          
  | 'active';               

export function VendorApp({ initialSession }: VendorAppProps) {
  const router = useRouter();
  const [session, setSession] = useState<VendorSession>(initialSession);
  const [status, setStatus] = useState<VendorStatus>('new');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [applicationData, setApplicationData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Load vendor status on mount
  useEffect(() => {
    checkVendorStatus();
  }, [session]);

  const checkVendorStatus = async () => {
    setIsLoading(true);
    
    try {
      // Fetch onboarding status from API (correct endpoint)
      console.log('📊 [VendorApp] Fetching onboarding status for phone:', session.phone);
      
      const response = await apiClient.get<any>(`/vendor/onboarding/status?phone=${encodeURIComponent(session.phone)}`);
      
      if (response && response.identity) {
        const { identity, application, role } = response;
        
        // Map onboarding status to frontend status
        const onboardingStatus = identity.onboarding_status;
        console.log('📊 [VendorApp] Onboarding status:', onboardingStatus);
        
        // Update localStorage with identity and application data
        const vendorData: any = {
          id: identity.vendor_id || identity.id,
          phone: identity.phone,
          email: identity.email,
          onboarding_status: onboardingStatus,
          role_id: identity.selected_role_id,
          vendor_type: identity.vendor_type,
          application_id: application?.id,
        };
        
        // Add application data if exists
        if (application) {
          vendorData.applicationStatus = application.status;
          vendorData.application = application;
          
          // Map application status
          if (application.status === 'APPROVED') {
            vendorData.status = 'approved';
            vendorData.isActive = true;
          } else if (application.status === 'REJECTED') {
            vendorData.status = 'rejected';
            vendorData.rejectionReason = application.rejection_reason;
          } else if (application.status === 'CLARIFICATION_REQUIRED') {
            vendorData.status = 'clarification';
            vendorData.clarificationNotes = application.admin_comments;
            vendorData.reviewerName = application.reviewed_by;
          }
          
          // Add application payload data
          if (application.application_payload) {
            Object.assign(vendorData, application.application_payload);
          }
        }
        
        // Add role data
        if (role) {
          vendorData.role = role;
          localStorage.setItem('vendorRole', role.id || role.name);
        }
        
        // Map onboarding status to frontend status
        if (onboardingStatus === 'ACTIVATED') {
          setStatus('active');
          vendorData.isActive = true;
          vendorData.status = 'active';
        } else if (onboardingStatus === 'APPROVED') {
          setStatus('approved');
          vendorData.isActive = false; // Not yet activated
          vendorData.status = 'approved';
        } else if (onboardingStatus === 'UNDER_REVIEW') {
          setStatus('pending');
          vendorData.status = 'pending';
          vendorData.applicationStatus = 'under_review';
        } else if (onboardingStatus === 'REJECTED') {
          setStatus('rejected');
          vendorData.status = 'rejected';
          setApplicationData({
            rejectionReason: application?.rejection_reason || 'Your application was not approved.',
            allowResubmit: true
          });
        } else if (onboardingStatus === 'CLARIFICATION_REQUIRED') {
          setStatus('clarification');
          vendorData.status = 'clarification';
          setApplicationData({
            clarificationNotes: application?.admin_comments || 'Please provide additional information.',
            reviewerName: application?.reviewed_by || 'Admin'
          });
        } else if (onboardingStatus === 'FORM_PENDING' || onboardingStatus === 'ROLE_PENDING') {
          // Still in onboarding
          setStatus('new');
          if (identity.selected_role_id && role) {
            setSelectedRole(role.id || role.name);
            setShowOnboarding(true);
          }
        } else {
          // INIT or other
          setStatus('new');
        }
        
        // Store vendor data
        setVendorData(vendorData);
        localStorage.setItem('vendorData', JSON.stringify(vendorData));
        localStorage.setItem('vendorApplicationStatus', onboardingStatus);
        localStorage.setItem('vendorId', vendorData.id || identity.id);
        
        console.log('✅ [VendorApp] Status updated:', {
          onboardingStatus,
          frontendStatus: status,
          vendorId: vendorData.id
        });
      }
    } catch (err: any) {
      console.error('❌ [VendorApp] Error checking vendor status:', err);
      
      // Fallback to stored data on error
      const storedVendor = localStorage.getItem('vendorData');
      if (storedVendor) {
        const vendor = JSON.parse(storedVendor);
        setVendorData(vendor);
        
        const storedStatus = localStorage.getItem('vendorApplicationStatus');
        if (storedStatus) {
          setStatus(storedStatus as VendorStatus);
        } else if (vendor.isActive) {
          setStatus('active');
        } else if (vendor.status === 'approved') {
          setStatus('approved');
        } else if (vendor.status === 'pending' || vendor.status === 'under_review') {
          setStatus('pending');
        } else {
          setStatus('new');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleSelect = (role: string) => {
    console.log('📋 Role selected:', role);
    setSelectedRole(role);
    localStorage.setItem('vendorRole', role);
    setShowOnboarding(true);
  };

  const handleOnboardingComplete = (data: any) => {
    console.log('✅ Onboarding completed:', data);
    setVendorData(data);
    localStorage.setItem('vendorData', JSON.stringify(data));
    localStorage.setItem('vendorApplicationStatus', 'submitted');
    setStatus('submitted');
    setShowOnboarding(false);
  };

  const handleApplicationContinue = () => {
    setStatus('pending');
    localStorage.setItem('vendorApplicationStatus', 'pending');
  };

  const handleCorrectAndResubmit = () => {
    setShowOnboarding(true);
  };

  const handleStartFresh = () => {
    // Clear all vendor data and start fresh
    localStorage.removeItem('vendorData');
    localStorage.removeItem('vendorRole');
    localStorage.removeItem('vendorApplicationStatus');
    setVendorData(null);
    setSelectedRole(null);
    setStatus('new');
  };

  const handleLogout = () => {
    localStorage.removeItem('vendorPhone');
    localStorage.removeItem('authToken');
    localStorage.removeItem('vendorData');
    localStorage.removeItem('vendorRole');
    localStorage.removeItem('vendorApplicationStatus');
    router.push('/auth');
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Application Submitted
  if (status === 'submitted') {
    return (
      <VendorApplicationSubmitted 
        applicationId={vendorData?.applicationId || 'PENDING'}
        onContinue={handleApplicationContinue}
      />
    );
  }

  // Application Under Review
  if (status === 'pending') {
    return (
      <VendorApplicationUnderReview 
        submittedAt={vendorData?.submittedAt || new Date().toISOString()}
        isReapproval={vendorData?.wasApprovedBefore}
        reapprovalReason={vendorData?.reapprovalReason}
      />
    );
  }

  // Application Rejected
  if (status === 'rejected') {
    return (
      <VendorApplicationRejected 
        applicationId={vendorData?.applicationId || 'N/A'}
        rejectionReason={applicationData?.rejectionReason || 'Your application was not approved.'}
        allowResubmit={applicationData?.allowResubmit !== false}
        onResubmit={handleStartFresh}
        onCorrectAndResubmit={handleCorrectAndResubmit}
      />
    );
  }

  // Clarification Requested
  if (status === 'clarification') {
    return (
      <VendorClarificationRequested 
        applicationId={vendorData?.applicationId || 'N/A'}
        clarificationNotes={applicationData?.clarificationNotes || 'Please provide additional information.'}
        reviewerName={applicationData?.reviewerName}
        onCorrectAndResubmit={handleCorrectAndResubmit}
      />
    );
  }

  // Active Vendor - Show Dashboard
  if (status === 'active' || status === 'approved') {
    return (
      <VendorCapabilityDashboard 
        vendorId={vendorData?.id || session.vendorId || ''}
      />
    );
  }

  // Onboarding Flow - VendorOnboardingFlow handles its own state
  if (showOnboarding && selectedRole) {
    // Store role for onboarding flow to read
    localStorage.setItem('vendorSelectedRole', selectedRole);
    return (
      <VendorOnboardingFlow 
        vendorId={vendorData?.id || session.vendorId || ''}
        vendorType={vendorData?.vendorType || 'solo'}
        serviceStyle={vendorData?.serviceStyle || 'both'}
        onComplete={() => setShowOnboarding(false)}
      />
    );
  }

  // New Vendor - Role Selection
  if (status === 'new' && !selectedRole) {
    return <VendorRoleSelection onRoleSelect={handleRoleSelect} />;
  }

  // Default: Show role selection
  return <VendorRoleSelection onRoleSelect={handleRoleSelect} />;
}

