import { useState } from 'react';
import { PackageList } from './PackageList';
import { CreatePackageFlow } from './CreatePackageFlow';

export function PackageManagementContainer({
  vendorId,
  vendorData,
  onBack,
  allowCreate = true
}: {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
  allowCreate?: boolean;
}) {
  const [currentScreen, setCurrentScreen] = useState<'list' | 'create'>('list');

  const handleCreateNew = () => {
    if (!allowCreate) {
      // Training Solo Vendors cannot create standalone packages
      return;
    }
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
      allowCreate={allowCreate}
    />
  );
}
