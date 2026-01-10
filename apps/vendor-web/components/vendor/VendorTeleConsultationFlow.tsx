'use client';

import { useState } from 'react';
import { X, Video, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VendorTeleConsultationFlowProps {
  vendorId: string;
  vendorData?: any;
  bookingData: any;
  onBack: () => void;
}

export function VendorTeleConsultationFlow({ vendorId, vendorData, bookingData, onBack }: VendorTeleConsultationFlowProps) {
  const [consultationType, setConsultationType] = useState<'video' | 'audio' | null>(null);

  // Placeholder component - to be implemented with full teleconsultation functionality
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Teleconsultation with {bookingData?.customerName || 'Customer'}</h2>
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="p-6">
          <p className="text-gray-600 mb-4">Teleconsultation functionality coming soon...</p>
          <div className="flex gap-4">
            <Button onClick={onBack} variant="outline">Back</Button>
            <Button onClick={onBack}>Start Consultation</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

