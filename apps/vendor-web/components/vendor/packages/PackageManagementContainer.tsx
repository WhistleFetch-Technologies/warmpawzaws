import { useState } from 'react';
import { PackageList } from './PackageList';
import { CreatePackageFlow } from './CreatePackageFlow';

export function PackageManagementContainer({
  vendorId,
  vendorData,
  onBack
}: {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
}) {
  const [currentScreen, setCurrentScreen] = useState<'list' | 'create'>('list');

  const handleCreateNew = () => {
    setCurrentScreen('create');
  };

  const handleSuccess = () => {
    setCurrentScreen('list');
  };

  const handleBackToList = () => {
    setCurrentScreen('list');
  };

  if (currentScreen === 'create') {
    return (
      <CreatePackageFlow
        vendorId={vendorId}
        vendorData={vendorData}
        onBack={handleBackToList}
        onSuccess={handleSuccess}
      />
    );
  }

  return (
    <PackageList
      vendorId={vendorId}
      onCreateNew={handleCreateNew}
      onBack={onBack}
    />
  );
}
