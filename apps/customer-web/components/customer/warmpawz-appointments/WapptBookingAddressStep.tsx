'use client';

import { CheckCircle2, MapPin, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type WapptBookingAddress = {
  id: string;
  label?: string;
  addressLine1?: string;
  address?: string;
  addressLine2?: string;
  address_line2?: string;
  city?: string;
  pincode?: string;
  isDefault?: boolean;
};

type WapptBookingAddressStepProps = {
  addresses: WapptBookingAddress[];
  selectedAddress: WapptBookingAddress | null;
  onSelect: (address: WapptBookingAddress) => void;
  onAddAddress: () => void;
  onContinue: () => void;
  hint?: string;
};

export function WapptBookingAddressStep({
  addresses,
  selectedAddress,
  onSelect,
  onAddAddress,
  onContinue,
  hint = 'An address is required for home visit.',
}: WapptBookingAddressStepProps) {
  return (
    <div className="space-y-4 cw-scroll-pad-tabbar">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Select Your Address</h2>
        <button
          type="button"
          onClick={onAddAddress}
          className="flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-200"
        >
          <Plus className="h-4 w-4" />
          Add Address
        </button>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
        <MapPin className="h-4 w-4 flex-shrink-0 text-blue-600" />
        <p className="text-sm text-blue-800">{hint}</p>
      </div>
      <div className="space-y-3">
        {addresses.length > 0 ? (
          addresses.map((addr) => (
            <button
              key={addr.id}
              type="button"
              onClick={() => onSelect(addr)}
              className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                selectedAddress?.id === addr.id
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-orange-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{addr.label || 'Address'}</h3>
                    {addr.isDefault ? (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-[#FF7A35]">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-600">{addr.addressLine1 || addr.address}</p>
                  <p className="text-sm text-gray-500">
                    {addr.city}
                    {addr.pincode ? ` - ${addr.pincode}` : ''}
                  </p>
                </div>
                {selectedAddress?.id === addr.id ? (
                  <CheckCircle2 className="h-6 w-6 text-[#FF8C42]" />
                ) : null}
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <MapPin className="h-8 w-8 text-gray-400" />
            </div>
            <p className="mb-2 font-medium text-gray-600">No addresses saved</p>
            <p className="mb-4 text-sm text-gray-500">Add an address to continue with the booking</p>
            <button
              type="button"
              onClick={onAddAddress}
              className="rounded-xl bg-blue-500 px-6 py-3 font-medium text-white transition hover:bg-blue-600"
            >
              + Add Your Address
            </button>
          </div>
        )}
      </div>
      {selectedAddress && addresses.length > 0 ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
          <p className="text-sm font-medium text-[#FF6B35]">
            ✓ Home visit at: {selectedAddress.label || 'Selected Address'}
          </p>
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-xs sm:max-w-sm">
        <Button
          type="button"
          onClick={onContinue}
          className="min-h-12 w-full rounded-full bg-orange-500 hover:bg-orange-600"
          disabled={!selectedAddress}
        >
          {selectedAddress ? 'Continue' : 'Select an Address to Continue'}
        </Button>
      </div>
    </div>
  );
}
