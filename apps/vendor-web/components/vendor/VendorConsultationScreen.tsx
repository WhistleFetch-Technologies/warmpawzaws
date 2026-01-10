'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface VendorConsultationScreenProps {
  vendorId: string;
  vendorData?: any;
  bookingId?: string;
  onBack?: () => void;
}

export function VendorConsultationScreen({ vendorId, vendorData, bookingId, onBack }: VendorConsultationScreenProps) {
  // Placeholder component - to be implemented with full consultation functionality
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Consultation Screen</h1>
          {onBack && (
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              ← Back
            </button>
          )}
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-gray-600">Consultation screen coming soon for booking {bookingId || 'N/A'}...</p>
        </div>
      </div>
    </div>
  );
}

