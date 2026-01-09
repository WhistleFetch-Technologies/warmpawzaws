"use client";

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AddVetSummaryModalProps {
  appointmentId: string;
  petName: string;
  vendorId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddVetSummaryModal({ appointmentId, petName, vendorId, onClose, onSuccess }: AddVetSummaryModalProps) {
  // Placeholder component - to be implemented with full vet summary form
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Add Consultation Summary</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-gray-600">Vet summary form coming soon</p>
        </div>
      </div>
    </div>
  );
}

