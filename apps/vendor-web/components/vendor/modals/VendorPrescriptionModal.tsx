"use client";

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VendorPrescriptionModalProps {
  bookingId: string;
  petName: string;
  customerName: string;
  vendorId: string;
  vendorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function VendorPrescriptionModal({ bookingId, petName, customerName, vendorId, vendorName, onClose, onSuccess }: VendorPrescriptionModalProps) {
  // Placeholder component - to be implemented with full prescription form
  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Prescription - {petName}</h3>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <p className="text-gray-600">Prescription form coming soon</p>
        </div>
      </div>
    </div>
  );
}

