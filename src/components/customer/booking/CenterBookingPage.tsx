import React from 'react';
import { CenterBookingFlowEnhanced } from '../CenterBookingFlowEnhanced';

interface CenterBookingPageProps {
  phone: string;
  vendorId?: string;
  vendorName?: string;
  customerId?: string; // Derived from phone or auth
  petId?: string;
  onBack: () => void;
  onSuccess: (bookingId: string) => void;
}

export function CenterBookingPage({ 
  phone, 
  vendorId, 
  vendorName, 
  customerId, 
  petId, 
  onBack, 
  onSuccess 
}: CenterBookingPageProps) {
  
  if (!vendorId) {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-50 p-6">
            <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900">Vendor Not Selected</h3>
                <p className="text-gray-500 mt-2">Please select a center first.</p>
                <button 
                    onClick={onBack}
                    className="mt-4 px-4 py-2 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300"
                >
                    Go Back
                </button>
            </div>
        </div>
    );
  }

  // In a real app, customerId and petId might come from context or be selected here if not passed
  // For now we assume they are passed or we use defaults/mocks for the demo if missing
  const activeCustomerId = customerId || `cust_${phone}`;
  const activePetId = petId || 'pet_default';

  return (
    <CenterBookingFlowEnhanced
      vendorId={vendorId}
      vendorName={vendorName || 'Service Center'}
      customerId={activeCustomerId}
      petId={activePetId}
      onBack={onBack}
      onSuccess={onSuccess}
    />
  );
}
