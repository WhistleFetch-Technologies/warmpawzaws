'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';

interface VendorPolicyManagementProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
  onClose?: () => void; // Alias for onBack for compatibility
}

export function VendorPolicyManagement({ vendorId, vendorData, onBack, onClose }: VendorPolicyManagementProps) {
  const handleBack = onBack || onClose;
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Policy Management</h1>
          {handleBack && <button onClick={handleBack} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">← Back</button>}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Policy management coming soon...</p>
        </div>
      </div>
    </div>
  );
}
