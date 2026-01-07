'use client';

import { useState } from 'react';
import { PackageList } from './PackageList';
import { CreatePackageFlow } from './CreatePackageFlow';

interface PackageManagementContainerProps {
  vendorId: string;
  onBack: () => void;
}

export function PackageManagementContainer({
  vendorId,
  onBack
}: PackageManagementContainerProps) {
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

