import { useState, useEffect } from 'react';
// Brand color: #FF8C42
import { VendorApplicationSubmitted } from './VendorApplicationSubmitted';
import { VendorApplicationStatus } from './VendorApplicationStatus';
import { VendorApprovalSuccessNew } from './VendorApprovalSuccessNew';
import { VendorApplicationRejected } from './VendorApplicationRejected';
import { VendorClarificationRequested } from './VendorClarificationRequested';
import { VendorDetailsFormNew } from './VendorDetailsFormNew';

interface VendorOnboardingFlowProps {
  vendorId: string;
  vendorType: string;
  serviceStyle: 'at_home' | 'at_center' | 'both';
  onComplete: () => void;
}

type OnboardingStep = 
  | 'profile'           // Creating profile
  | 'submitted'         // Application submitted
  | 'under_review'      // Under admin review
  | 'clarification'     // Clarification requested
  | 'approved'          // Approved, setting up services
  | 'rejected'          // Rejected
  | 'completed';        // Setup complete

export function VendorOnboardingFlow({ 
  vendorId, 
  vendorType, 
  serviceStyle, 
  onComplete 
}: VendorOnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('profile');
  const [applicationId, setApplicationId] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [clarificationNotes, setClarificationNotes] = useState('');
  const [reviewerName, setReviewerName] = useState('Admin');

  // Check initial status
  useEffect(() => {
    checkApplicationStatus();
  }, [vendorId]);

  const checkApplicationStatus = async () => {
    // This would check the vendor's current application status
    // and set the appropriate step
    // For now, we'll start at 'profile'
  };

  const handleProfileSubmit = async (profileData: any) => {
    // Submit the application
    // The VendorDetailsFormNew should call this after profile creation
    // For now, we'll just move to submitted
    setApplicationId(`APP${Date.now()}`);
    setCurrentStep('submitted');
  };

  const handleContinueFromSubmitted = () => {
    setCurrentStep('under_review');
  };

  const handleApproved = () => {
    setCurrentStep('approved');
  };
  
  const handleClarificationRequested = (notes: string) => {
    setClarificationNotes(notes);
    setCurrentStep('clarification');
  };

  const handleSetupComplete = () => {
    setCurrentStep('completed');
    setTimeout(() => onComplete(), 1000);
  };

  const handleResubmit = () => {
    setCurrentStep('profile');
  };

  // Render appropriate screen based on step
  switch (currentStep) {
    case 'profile':
      return (
        <VendorDetailsFormNew
          vendorId={vendorId}
          onSubmit={handleProfileSubmit}
        />
      );

    case 'submitted':
      return (
        <VendorApplicationSubmitted
          applicationId={applicationId}
          onContinue={handleContinueFromSubmitted}
        />
      );

    case 'under_review':
      return (
        <VendorApplicationStatus
          vendorId={vendorId}
          onApproved={handleApproved}
          onClarificationRequested={handleClarificationRequested}
        />
      );

    case 'clarification':
      return (
        <VendorClarificationRequested
          applicationId={applicationId}
          clarificationNotes={clarificationNotes}
          reviewerName={reviewerName}
          onCorrectAndResubmit={handleResubmit}
        />
      );

    case 'approved':
      return (
        <VendorApprovalSuccessNew
          vendorId={vendorId}
          vendorType={vendorType}
          serviceStyle={serviceStyle}
          onSetupComplete={handleSetupComplete}
        />
      );

    case 'rejected':
      return (
        <VendorApplicationRejected
          applicationId={applicationId}
          rejectionReason={rejectionReason}
          allowResubmit={true}
          onResubmit={handleResubmit}
          onCorrectAndResubmit={handleResubmit}
        />
      );

    case 'completed':
      return (
        <div className="min-h-screen bg-white w-full max-w-[430px] mx-auto flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-gray-900 font-semibold">Setup Complete!</p>
            <p className="text-sm text-gray-600 mt-2">Redirecting to dashboard...</p>
          </div>
        </div>
      );

    default:
      return null;
  }
}