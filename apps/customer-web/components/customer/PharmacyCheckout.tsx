"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, CreditCard, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useCart } from '@/context/CartContext';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { calculateTax } from '@/lib/tax-system';
import { cartItemsToTaxableItems } from '@/lib/tax-system/taxCalculatorUtils';

interface PharmacyCheckoutProps {
  phone: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function PharmacyCheckout({ phone, onBack, onSuccess }: PharmacyCheckoutProps) {
  const { cart, clearCart, getTotal } = useCart();
  const [processing, setProcessing] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [prescriptionVerified, setPrescriptionVerified] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(true);

  useEffect(() => {
    loadDefaultAddress();
  }, [phone]);

  const loadDefaultAddress = async () => {
    try {
      setLoadingAddress(true);
      const response = await apiClient.get<any>(`/customer/addresses?phone=${encodeURIComponent(phone)}`);
      if (response.addresses && response.addresses.length > 0) {
        setSelectedAddress(response.addresses.find((a: any) => a.isDefault) || response.addresses[0]);
      }
    } catch (error) {
      console.error('Error loading address:', error);
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
        clearCart();
        toast.success('Order placed successfully!');
        onSuccess();
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
        <div className="bg-white sticky top-0 z-10 border-b border-gray-200 px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Pharmacy Checkout</h1>
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
                    // Reload addresses
                    const response = await apiClient.get<any>(`/customer/addresses?phone=${encodeURIComponent(phone)}`);
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
            {selectedAddress ? (
              <div className="text-sm text-gray-600">
                <p className="font-medium text-gray-900">{selectedAddress.name || 'Default Address'}</p>
                <p>{selectedAddress.street || selectedAddress.addressLine1}</p>
                <p>{selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}</p>
                <p className="mt-1">Phone: {selectedAddress.phone || phone}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Loading address...</p>
            )}
          </Card>

          {/* Order Summary */}
          <Card className="p-4">
            <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
            
            <div className="space-y-3 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-gray-500">Qty: {item.quantity} × ₹{item.price}</p>
                    {item.prescription_required && (
                      <span className="inline-flex items-center gap-1 text-xs text-orange-600 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        Rx Required
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-gray-900">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal</span>
                <span className="text-gray-900">₹{subtotal.toFixed(2)}</span>
              </div>
              {taxResult.byType.map((taxType) => (
                <div key={taxType.taxType} className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {taxType.taxType === 'gst' ? 'GST' : 
                     taxType.taxType === 'service_tax' ? 'Service Tax' :
                     taxType.taxType === 'education_cess' ? 'Education Cess' :
                     taxType.taxType === 'infrastructure_cess' ? 'Infrastructure Cess' :
                     taxType.taxType.toUpperCase()} 
                    {taxType.breakdown.length > 0 && ` (${taxType.breakdown[0].rate}%)`}
                  </span>
                  <span className="text-gray-900">₹{taxType.totalAmount.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                <span className="text-gray-900">Total</span>
                <span className="text-[#FF8C42]">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </Card>

          {/* Payment Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto shadow-lg">
            <Button
              onClick={handlePayment}
              disabled={processing || !selectedAddress || (requiresPrescription && !prescriptionVerified)}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white h-14 text-lg font-semibold shadow-lg shadow-[#FF8C42]/30 disabled:opacity-50"
            >
              {processing ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                <>
                  <CreditCard className="w-5 h-5 mr-2" />
                  Place Order ₹{total.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
