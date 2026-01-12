import { useState } from 'react';
import { InsuranceDashboard } from './InsuranceDashboard';
import { CreatePlanScreen } from './CreatePlanScreen';
import { ClaimsManagement } from './ClaimsManagement';

export function InsuranceVendorContainer({ vendorId }: { vendorId: string }) {
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'create-plan' | 'view-plan' | 'view-claim'>('dashboard');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedClaimId, setSelectedClaimId] = useState<string>('');

  const handleCreatePlan = () => {
    setCurrentScreen('create-plan');
  };

  const handleViewPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setCurrentScreen('view-plan');
  };

  const handleViewClaim = (claimId: string) => {
    setSelectedClaimId(claimId);
    setCurrentScreen('view-claim');
  };

  const handleBack = () => {
    setCurrentScreen('dashboard');
    setSelectedPlanId('');
    setSelectedClaimId('');
  };

  const handleSuccess = () => {
    setCurrentScreen('dashboard');
  };

  if (currentScreen === 'create-plan') {
    return (
      <CreatePlanScreen
        vendorId={vendorId}
        onBack={handleBack}
        onSuccess={handleSuccess}
      />
    );
  }

  if (currentScreen === 'view-claim' && selectedClaimId) {
    return (
      <ClaimsManagement
        vendorId={vendorId}
        claimId={selectedClaimId}
        onBack={handleBack}
      />
    );
  }

  return (
    <InsuranceDashboard
      vendorId={vendorId}
      onCreatePlan={handleCreatePlan}
      onViewPlan={handleViewPlan}
      onViewClaim={handleViewClaim}
    />
  );
}
