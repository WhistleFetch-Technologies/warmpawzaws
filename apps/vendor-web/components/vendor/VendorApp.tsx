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
      // Check stored data first
      const storedVendor = localStorage.getItem('vendorData');
      const storedRole = localStorage.getItem('vendorRole');
      const storedStatus = localStorage.getItem('vendorApplicationStatus');
      
      if (storedVendor) {
        const vendor = JSON.parse(storedVendor);
        setVendorData(vendor);
        
        if (storedRole) setSelectedRole(storedRole);
        if (storedStatus) setStatus(storedStatus as VendorStatus);
        else if (vendor.isActive) setStatus('active');
        else if (vendor.applicationStatus === 'pending') setStatus('pending');
        else if (vendor.applicationStatus === 'approved') setStatus('approved');
        else if (vendor.applicationStatus === 'rejected') setStatus('rejected');
        else if (vendor.applicationStatus === 'clarification') setStatus('clarification');
        else setStatus('profile_incomplete');
      }
      
      // UAT Mode: Skip API call
      if (isUatMode()) {
        console.log('🔧 [UAT Mode] Using local vendor status');
        setIsLoading(false);
        return;
      }

      // Fetch actual vendor status from API
      const response = await apiClient.get<any>(`/vendor/status/${session.phone}`);
      
      if (response.vendor) {
        setVendorData(response.vendor);
        localStorage.setItem('vendorData', JSON.stringify(response.vendor));
        
        const appStatus = response.vendor.applicationStatus || response.vendor.status;
        if (response.vendor.isActive || appStatus === 'active') {
          setStatus('active');
        } else if (appStatus === 'pending' || appStatus === 'under_review') {
          setStatus('pending');
        } else if (appStatus === 'approved') {
          setStatus('approved');
        } else if (appStatus === 'rejected') {
          setStatus('rejected');
          setApplicationData({
            rejectionReason: response.vendor.rejectionReason || 'Your application was not approved.',
            allowResubmit: response.vendor.allowResubmit !== false
          });
        } else if (appStatus === 'clarification') {
          setStatus('clarification');
          setApplicationData({
            clarificationNotes: response.vendor.clarificationNotes || '',
            reviewerName: response.vendor.reviewerName
          });
        }
      }
    } catch (err) {
      console.error('Error checking vendor status:', err);
      // Keep local state on error
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

