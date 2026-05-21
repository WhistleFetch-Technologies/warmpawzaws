'use client';

import { CheckCircle2, MapPin, Plus, X } from 'lucide-react';
import type { DeliveryAddress } from '@/lib/ecommerce/load-customer-addresses';
import {
  deliveryAddressKey,
  deliveryAddressTitle,
  formatDeliveryAddressLine,
} from '@/lib/ecommerce/delivery-address-display';

export { deliveryAddressTitle, formatDeliveryAddressLine } from '@/lib/ecommerce/delivery-address-display';

export interface DeliveryAddressPickerSheetProps {
  open: boolean;
  onClose: () => void;
  addresses: DeliveryAddress[];
  selectedAddress: DeliveryAddress | null;
  onSelect: (address: DeliveryAddress) => void;
  onAddNew: () => void;
  onManageAddresses?: () => void;
  loading?: boolean;
  phone?: string;
}

export function DeliveryAddressPickerSheet({
  open,
  onClose,
  addresses,
  selectedAddress,
  onSelect,
  onAddNew,
  onManageAddresses,
  loading = false,
  phone,
}: DeliveryAddressPickerSheetProps) {
  if (!open) return null;

  const isSelected = (addr: DeliveryAddress) => {
    if (!selectedAddress) return false;
    if (selectedAddress.id && addr.id) return selectedAddress.id === addr.id;
    return (
      (selectedAddress.addressLine1 || selectedAddress.street) ===
        (addr.addressLine1 || addr.street) && selectedAddress.pincode === addr.pincode
    );
  };

  const handleSelect = (addr: DeliveryAddress) => {
    onSelect(addr);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-address-picker-title"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close address picker"
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-customer rounded-t-3xl bg-white shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white p-4">
          <h3 id="delivery-address-picker-title" className="text-lg font-bold text-gray-900">
            Select delivery address
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100">
            <X className="h-6 w-6 text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF8C42] border-t-transparent" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="py-8 text-center">
              <MapPin className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="mb-1 font-medium text-gray-900">No saved addresses</p>
              <p className="mb-4 text-sm text-gray-500">Add a delivery address to continue checkout.</p>
              <button
                type="button"
                onClick={onAddNew}
                className="rounded-xl bg-[#FF8C42] px-4 py-2 text-sm font-semibold text-white hover:bg-[#FF7029]"
              >
                Add address
              </button>
              {onManageAddresses && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onManageAddresses();
                  }}
                  className="mt-3 block w-full text-sm font-medium text-[#FF8C42] hover:underline"
                >
                  Manage addresses in profile
                </button>
              )}
            </div>
          ) : (
            <>
              {addresses.map((addr, index) => (
                <button
                  key={deliveryAddressKey(addr, index)}
                  type="button"
                  onClick={() => handleSelect(addr)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition ${
                    isSelected(addr)
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 hover:border-[#FF8C42]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900">{deliveryAddressTitle(addr)}</p>
                      <p className="mt-1 text-sm text-gray-600">{formatDeliveryAddressLine(addr)}</p>
                      {(addr.phone || phone) && (
                        <p className="mt-1 text-sm text-gray-500">Phone: {addr.phone || phone}</p>
                      )}
                      {addr.isDefault && (
                        <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Default
                        </span>
                      )}
                    </div>
                    {isSelected(addr) && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[#FF8C42]" />
                    )}
                  </div>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onAddNew();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 p-4 font-medium text-[#FF8C42] transition hover:border-[#FF8C42]"
              >
                <Plus className="h-5 w-5" />
                Add new address
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
