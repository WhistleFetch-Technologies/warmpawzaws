'use client';

import React from 'react';
import { AmbulanceBookingFlow } from './AmbulanceBookingFlow';
import { DiagnosticsBookingFlow } from './DiagnosticsBookingFlow';
import { MedicineDeliveryFlow } from './MedicineDeliveryFlow';
import { PetCafeBookingFlow } from './PetCafeBookingFlow';
import { PetResortBookingFlow } from './PetResortBookingFlow';
import { PetWalkerBookingFlow } from './PetWalkerBookingFlow';
import { AdoptionListingView } from './AdoptionListingView';

interface SpecializedServiceRouterProps {
  serviceType: string;
  vendorId: string;
  customerPhone: string;
  onSuccess?: (bookingId: string) => void;
  onCancel?: () => void;
}

export function SpecializedServiceRouter({
  serviceType,
  vendorId,
  customerPhone,
  onSuccess,
  onCancel,
}: SpecializedServiceRouterProps) {
  const normalizedType = serviceType.toLowerCase().replace(/[_\s]/g, '_');

  switch (normalizedType) {
    case 'ambulance':
    case 'emergency':
      return (
        <AmbulanceBookingFlow
          vendorId={vendorId}
          customerPhone={customerPhone}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      );

    case 'diagnostics':
    case 'diagnostic':
    case 'lab':
    case 'laboratory':
      return (
        <DiagnosticsBookingFlow
          vendorId={vendorId}
          customerPhone={customerPhone}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      );

    case 'pharmacy':
    case 'medicine':
    case 'medicines':
    case 'medicine_delivery':
      return (
        <MedicineDeliveryFlow
          vendorId={vendorId}
          customerPhone={customerPhone}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      );

    case 'pet_cafe':
    case 'cafe':
      return (
        <PetCafeBookingFlow
          vendorId={vendorId}
          customerPhone={customerPhone}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      );

    case 'pet_resort':
    case 'resort':
    case 'boarding':
      return (
        <PetResortBookingFlow
          vendorId={vendorId}
          customerPhone={customerPhone}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      );

    case 'pet_walker':
    case 'walker':
    case 'walking':
      return (
        <PetWalkerBookingFlow
          vendorId={vendorId}
          customerPhone={customerPhone}
          onSuccess={onSuccess}
          onCancel={onCancel}
        />
      );

    case 'adoption':
    case 'breeder':
    case 'breeding':
      return (
        <AdoptionListingView
          vendorId={vendorId}
          customerPhone={customerPhone}
          onApply={(petId) => {
            // Handle adoption application
            if (onSuccess) {
              onSuccess(petId);
            }
          }}
        />
      );

    default:
      return (
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
            <p className="text-yellow-700">
              Specialized service type "{serviceType}" is not yet supported.
            </p>
            <p className="text-sm text-yellow-600 mt-2">
              Please use the standard booking flow or contact support.
            </p>
          </div>
        </div>
      );
  }
}

