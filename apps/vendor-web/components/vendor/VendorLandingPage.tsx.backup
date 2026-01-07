'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { EnhancedVendorOnboarding } from './onboarding/EnhancedVendorOnboarding';
import { VendorApplicationSubmitted } from './VendorApplicationSubmitted';
import { VendorApplicationUnderReview } from './VendorApplicationUnderReview';
import { VendorClarificationRequested } from './VendorClarificationRequested';
import { VendorApprovedSetup } from './VendorApprovedSetup';
import { VendorAvailabilitySetup } from './VendorAvailabilitySetup';
import { VendorSetupCompleted } from './VendorSetupCompleted';
import { VendorApplicationRejected } from './VendorApplicationRejected';
import { VendorDashboard } from './VendorDashboard';
import { VendorServiceSelection } from './VendorServiceSelection';
import { VendorServiceConfigurationScreen } from './VendorServiceConfigurationScreen';
import { Loader2 } from 'lucide-react';

interface VendorLandingPageProps {
  vendorId: string;
  phone: string;
  vendorType?: string;
  serviceStyle?: 'at_home' | 'at_center' | 'both';
  initialVendorData?: any;
  onComplete?: () => void;
  justSubmitted?: boolean;
}

type VendorStatus = 
  | 'new'
  | 'profile_incomplete'
  | 'submitted'
  | 'pending'
  | 'approved_services'
  | 'approved_availability'
  | 'setup_completed'
  | 'rejected'
  | 'clarification'
  | 'active';

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
  const [vendorData, setVendorData] = useState<any>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  useEffect(() => {
    if (initialVendorData) {
      processVendorData(initialVendorData);
      setLoading(false);
    } else {
      checkVendorStatus();
    }
  }, [vendorId, phone, initialVendorData]);

  const checkVendorStatus = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<any>(`/vendor/status/${vendorId}`);
      if (response.success && response.vendor) {
        processVendorData(response.vendor);
      }
    } catch (error) {
      console.error('Error checking vendor status:', error);
    } finally {
      setLoading(false);
    }
  };

  const processVendorData = (vendor: any) => {
    setVendorData(vendor);
    
    if (vendor.status === 'submitted' || vendor.status === 'pending') {
      setStatus(justSubmitted ? 'submitted' : 'pending');
    } else if (vendor.status === 'approved') {
      if (vendor.isActive) {
        setStatus('active');
      } else if (vendor.setupCompleted) {
        setStatus('setup_completed');
      } else if (vendor.servicesConfigured) {
        setStatus('approved_availability');
      } else {
        setStatus('approved_services');
      }
    } else if (vendor.status === 'rejected') {
      setStatus('rejected');
    } else if (vendor.status === 'clarification_requested') {
      setStatus('clarification');
    } else {
      setStatus('new');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-orange-600" />
      </div>
    );
  }

  switch (status) {
    case 'new':
    case 'profile_incomplete':
      return (
        <EnhancedVendorOnboarding
          roleId={vendorData?.roleId || ''}
          onComplete={() => checkVendorStatus()}
        />
      );

    case 'submitted':
      return (
        <VendorApplicationSubmitted 
          applicationId={vendorData?.applicationId || vendorId}
          onContinue={() => checkVendorStatus()}
        />
      );

    case 'pending':
      return (
        <VendorApplicationUnderReview 
          submittedAt={vendorData?.submittedAt}
          isReapproval={vendorData?.wasApprovedBefore}
          reapprovalReason={vendorData?.reapprovalReason}
        />
      );

    case 'clarification':
      return (
        <VendorClarificationRequested
          applicationId={vendorData?.applicationId || vendorId}
          clarificationNotes={vendorData?.clarificationNotes || 'Please provide additional information.'}
          reviewerName={vendorData?.reviewerName}
          onCorrectAndResubmit={() => checkVendorStatus()}
        />
      );

    case 'rejected':
      return (
        <VendorApplicationRejected 
          applicationId={vendorData?.applicationId || vendorId}
          rejectionReason={vendorData?.rejectionReason || 'Application did not meet requirements.'}
          allowResubmit={vendorData?.allowResubmit !== false}
          onResubmit={() => checkVendorStatus()}
          onCorrectAndResubmit={() => checkVendorStatus()}
        />
      );

    case 'approved_services':
      return (
        <VendorServiceSelection
          vendorId={vendorId}
          roleId={vendorData?.roleId}
          onComplete={() => {
            setSelectedServices([]);
            checkVendorStatus();
          }}
        />
      );

    case 'approved_availability':
      return (
        <VendorAvailabilitySetup
          vendorId={vendorId}
          onComplete={() => checkVendorStatus()}
        />
      );

    case 'setup_completed':
      return (
        <VendorSetupCompleted
          onContinue={() => {
            setStatus('active');
            if (onComplete) onComplete();
          }}
        />
      );

    case 'active':
      return (
        <VendorDashboard
          vendorId={vendorId}
          phone={phone}
          vendorType={vendorType}
          serviceStyle={serviceStyle}
        />
      );

    default:
      return (
        <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center p-4">
          <p className="text-gray-600">Unknown status: {status}</p>
        </div>
      );
  }
}

