"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { PolicyDisplay } from './shared/PolicyDisplay';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCart } from '@/context/CartContext';
import { apiClient } from '@/lib/api-client';
import { urlCustomerAddressesByPhone } from '@/lib/customer-service-list-urls';
import { toast } from 'sonner';
import { calculateTax } from '@/lib/tax-system';
import { cartItemsToTaxableItems } from '@/lib/tax-system/taxCalculatorUtils';

interface Address {
  id: string;
  type: 'home' | 'office' | 'other';
  label?: string;
  name?: string;
  street?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
  phone?: string;
}

interface PharmacyCheckoutProps {
  phone: string;
  onBack: () => void;
  onSuccess: (orderId?: string) => void;
}

export function PharmacyCheckout({ phone, onBack, onSuccess }: PharmacyCheckoutProps) {
  const { cart, clearCart, getTotal } = useCart();
  const [processing, setProcessing] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [prescriptionVerified, setPrescriptionVerified] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [addressError, setAddressError] = useState<string | null>(null);
  // Note: Terms acceptance moved to payment page - no checkbox needed here

  useEffect(() => {
    loadDefaultAddress();
  }, [phone]);

  const loadDefaultAddress = async () => {
    try {
      setLoadingAddress(true);
      setAddressError(null);
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Address loading timeout')), 10000)
      );
      
      // Try alternative endpoint format if the first one fails
      let response: any;
      try {
        // Try /customer/addresses?phone= first
        const apiPromise = apiClient.get<any>(urlCustomerAddressesByPhone(phone));
        response = await Promise.race([apiPromise, timeoutPromise]) as any;
      } catch (firstError: any) {
        // If 404, try alternative endpoint format
        if (firstError.status === 404 || firstError.message?.includes('404')) {
          console.log('[PharmacyCheckout] Trying alternative address endpoint format...');
          const altApiPromise = apiClient.get<any>(`/customer/${encodeURIComponent(phone)}/addresses`);
          response = await Promise.race([altApiPromise, timeoutPromise]) as any;
        } else {
          throw firstError;
        }
      }
      
      if (response && response.addresses && response.addresses.length > 0) {
        const defaultAddr = response.addresses.find((a: any) => a.isDefault) || response.addresses[0];
        setSelectedAddress(defaultAddr);
        setAddressError(null);
      } else if (response && response.addresses && response.addresses.length === 0) {
        // No addresses found - not an error, just need to add one
        setSelectedAddress(null);
        setAddressError('no_addresses');
      } else {
        // Unexpected response format
        setSelectedAddress(null);
        setAddressError('Failed to load addresses. Please try again.');
      }
    } catch (error: any) {
      console.error('Error loading address:', error);
      setSelectedAddress(null);
      if (error.message?.includes('timeout')) {
        setAddressError('Request timed out. Please check your connection and try again.');
      } else if (error.status === 404 || error.message?.includes('404')) {
        setAddressError('Address endpoint not found. Please contact support.');
      } else {
        setAddressError(error.message || 'Failed to load addresses. Please check your connection.');
      }
    } finally {
      setLoadingAddress(false);
    }
  };

  const requiresPrescription = cart.some(item => item.prescription_required);

  const subtotal = getTotal();
  const taxableItems = cartItemsToTaxableItems(cart);
  const taxResult = calculateTax(taxableItems);
  const taxAmount = taxResult.total;
  const total = subtotal + taxAmount;

  const handlePayment = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (requiresPrescription && !prescriptionVerified) {
      toast.error('Prescription verification required for this order');
      return;
    }

    // Note: Terms acceptance moved to payment page policies

    try {
      setProcessing(true);

      // Create pharmacy order
      const orderData = {
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          prescription_required: item.prescription_required
        })),
        subtotal,
        taxAmount,
        taxBreakdown: taxResult.breakdown,
        taxByType: taxResult.byType,
        total,
        address: selectedAddress,
        phone,
        prescription_verified: prescriptionVerified,
        orderType: 'pharmacy'
      };

      // Create order (payment will be handled separately if needed)
      const orderResponse = await apiClient.post<any>('/customer/pharmacy/orders', orderData);

      if (orderResponse.success || orderResponse.orderId) {
        const orderId = orderResponse.orderId || orderResponse.order?.id || orderResponse.id;
        clearCart();
        toast.success('Order placed successfully! Finding nearby pharmacy...');
        onSuccess(orderId);
      } else {
        throw new Error('Failed to create order');
      }
    } catch (error: any) {
      console.error('Order creation error:', error);
      toast.error(error.message || 'Failed to place order. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 mb-6">Your cart is empty</p>
          <Button
            onClick={onBack}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
          >
            Continue Shopping
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white sticky top-0 z-10 py-4 rounded-b-2xl shadow-md cw-header-safe-top cw-header-safe-x">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-white">Pharmacy Checkout</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Prescription Verification */}
          {requiresPrescription && (
            <Card className="bg-blue-50 border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-blue-900 mb-2">Prescription Required</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    This order contains prescription medicines. Please ensure your prescription is uploaded and verified.
                  </p>
                  {prescriptionVerified ? (
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-sm font-medium">Prescription verified</span>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        toast.info('Prescription verification will be handled by pharmacy');
                        setPrescriptionVerified(true);
                      }}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      Verify Prescription
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Delivery Address */}
          <Card className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF8C42]" />
                <h2 className="font-semibold text-gray-900">Delivery Address</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    // Reload addresses - try both endpoint formats
                    let response: any;
                    try {
                      response = await apiClient.get<any>(urlCustomerAddressesByPhone(phone));
                    } catch (error: any) {
                      if (error.status === 404) {
                        response = await apiClient.get<any>(`/customer/${encodeURIComponent(phone)}/addresses`);
                      } else {
                        throw error;
                      }
                    }
                    
                    const addressList = response.addresses || response || [];
                    
                    if (addressList.length > 1) {
                      const currentIndex = addressList.findIndex((a: any) => a.id === selectedAddress?.id);
                      const nextIndex = (currentIndex + 1) % addressList.length;
                      setSelectedAddress(addressList[nextIndex]);
                      toast.success('Address changed');
                    } else {
                      toast.info('Add more addresses in your account settings');
                    }
                  } catch (error) {
                    console.error('Error changing address:', error);
                    toast.error('Failed to load addresses');
                  }
                }}
                className="text-[#FF8C42] hover:text-[#FF6B9D]"
              >
                Change
              </Button>
            </div>
            {loadingAddress ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#FF8C42]"></div>
                <span>Loading address...</span>
              </div>
            ) : addressError === 'no_addresses' ? (
              <div className="text-sm">
                <p className="text-gray-600 mb-3">No delivery address found. Please add an address to continue.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Navigate to address book or show add address modal
                    toast.info('Please add an address in your account settings');
                  }}
                  className="w-full border-[#FF8C42] text-[#FF8C42] hover:bg-[#FF8C42] hover:text-white"
                >
                  Add Address
                </Button>
              </div>
            ) : addressError ? (
              <div className="text-sm">
                <p className="text-red-600 mb-2">{addressError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadDefaultAddress}
                  className="w-full"
                >
                  Retry
                </Button>
              </div>
            ) : selectedAddress ? (
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900">{selectedAddress.name || selectedAddress.label || 'Default Address'}</p>
                <p>{selectedAddress.street || selectedAddress.addressLine1}</p>
                {selectedAddress.addressLine2 && <p>{selectedAddress.addressLine2}</p>}
                <p>{selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}</p>
                {selectedAddress.landmark && <p className="text-gray-500">Landmark: {selectedAddress.landmark}</p>}
                <p className="mt-1">Phone: {selectedAddress.phone || phone}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No address selected</p>
            )}
          </Card>

          {/* Order Summary - Prices will be set by pharmacy */}
          <Card className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
            
            <div className="space-y-3 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-gray-500">Qty: {item.quantity}</p>
                    {item.prescription_required && (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-600 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        Rx Required
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Info banner about pricing */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900">Pharmacy will provide final quote</p>
                  <p className="text-xs text-blue-700 mt-1">
                    After you place this order, nearby pharmacies will review your prescription and 
                    send you a proforma invoice with the exact prices. You can then approve and pay.
                  </p>
                </div>
              </div>
            </div>

            {/* Pricing breakdown will be added by pharmacy */}
            <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Medicine Cost</span>
                <span className="italic">To be confirmed</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Delivery Charges</span>
                <span className="italic">To be calculated</span>
              </div>
              <div className="flex justify-between text-sm text-gray-500">
                <span>Platform Fee</span>
                <span className="italic">To be added</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-500 italic text-base font-normal">Awaiting pharmacy quote</span>
              </div>
            </div>
          </Card>

          {/* ✅ ENRICHED: Policy Display - Terms acceptance moved to payment page */}
          <PolicyDisplay 
            serviceType="pharmacy" 
            showPolicies={['delivery', 'cancellation', 'refund', 'tax']}
            className="mb-20"
            showTermsCheckbox={false}
          />

          {/* Payment Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto shadow-lg">
            <Button
              onClick={handlePayment}
              disabled={processing || !selectedAddress || (requiresPrescription && !prescriptionVerified)}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white h-14 text-lg font-semibold shadow-lg shadow-[#FF8C42]/30 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                !selectedAddress 
                  ? 'Please select a delivery address'
                  : (requiresPrescription && !prescriptionVerified)
                    ? 'Prescription verification required'
                    : ''
              }
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Finding Nearby Pharmacies...
                </span>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Request Quote from Pharmacies
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
