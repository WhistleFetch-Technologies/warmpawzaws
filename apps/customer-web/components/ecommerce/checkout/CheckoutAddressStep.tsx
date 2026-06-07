'use client';

import { useState } from 'react';
import { MapPin, Plus, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCheckout } from '@/context/CheckoutProvider';
import { DeliveryAddressPickerSheet } from '@/components/customer/ecommerce/DeliveryAddressPickerSheet';
import { AddAddressModal } from '@/components/customer/shared/AddAddressModal';
import {
  CHECKOUT_SHIPPING_OPTIONS,
} from '@/lib/ecommerce/checkout-shipping-options';
import type { DeliveryAddress } from '@/lib/ecommerce/load-customer-addresses';
import type { CheckoutAddress } from '@/components/customer/ecommerce/useEcommerceCheckout';

export function CheckoutAddressStep() {
  const {
    phone,
    address,
    addresses,
    addressesLoading,
    shippingMethod,
    selectAddress,
    selectShipping,
    goNext,
    refreshAddresses,
  } = useCheckout();

  const [showPicker, setShowPicker] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const openPicker = async () => {
    setShowPicker(true);
    setPickerLoading(true);
    try {
      await refreshAddresses();
    } finally {
      setPickerLoading(false);
    }
  };

  const handleAddSuccess = async (newAddress: CheckoutAddress) => {
    setShowAddModal(false);
    await refreshAddresses();
    if (newAddress?.id) {
      selectAddress(newAddress as DeliveryAddress);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-[#FF8C42]" />
            <h2 className="font-semibold text-slate-900">Delivery address</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-[#FF8C42] hover:text-[#FF7A29]"
            onClick={() => void openPicker()}
          >
            Change
          </Button>
        </div>

        {addressesLoading ? (
          <p className="text-sm text-slate-500">Loading addresses…</p>
        ) : address ? (
          <div className="text-sm text-slate-600 space-y-0.5">
            <p className="font-medium text-slate-900">
              {address.fullName || address.name || 'Delivery address'}
            </p>
            <p>{address.addressLine1 || address.street}</p>
            <p>
              {address.city}, {address.state} {address.pincode}
            </p>
            {address.phone && <p className="text-slate-500">+91 {address.phone.replace(/^\+91/, '')}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">Add an address to continue checkout.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#FF8C42] text-[#FF8C42]"
              onClick={() => setShowAddModal(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add address
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="h-5 w-5 text-[#FF8C42]" />
          <h2 className="font-semibold text-slate-900">Delivery speed</h2>
        </div>
        <div className="space-y-2">
          {CHECKOUT_SHIPPING_OPTIONS.map((option) => {
            const selected = shippingMethod === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectShipping(option.id)}
                className={`w-full rounded-xl border-2 p-3 text-left transition-colors ${
                  selected
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{option.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {option.description} · {option.eta}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-slate-700">{option.feeLabel}</span>
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        selected ? 'border-[#FF8C42]' : 'border-slate-300'
                      }`}
                    >
                      {selected && <div className="h-2.5 w-2.5 rounded-full bg-[#FF8C42]" />}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Button
        type="button"
        onClick={goNext}
        disabled={!address || addressesLoading}
        className="w-full h-12 bg-[#FF8C42] hover:bg-[#FF7A29] text-white font-semibold rounded-xl"
      >
        Continue to payment
      </Button>

      <DeliveryAddressPickerSheet
        open={showPicker}
        onClose={() => setShowPicker(false)}
        addresses={addresses}
        selectedAddress={address}
        onSelect={selectAddress}
        onAddNew={() => {
          setShowPicker(false);
          setShowAddModal(true);
        }}
        onManageAddresses={() => {
          setShowPicker(false);
        }}
        loading={pickerLoading}
        phone={phone}
      />

      <AddAddressModal
        phone={phone}
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleAddSuccess}
        customerName={address?.fullName || address?.name || ''}
      />
    </div>
  );
}
