"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, CreditCard, Edit2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/context/CartContext';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { calculateTax } from '@/lib/tax-system';
import { cartItemsToTaxableItems } from '@/lib/tax-system/taxCalculatorUtils';

interface CheckoutViewProps {
  phone: string;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

export function CheckoutView({ phone, onBack, onSuccess }: CheckoutViewProps) {
  const { cart, getTotal, clearCart } = useCart();
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('online');

  useEffect(() => {
    loadAddresses();
  }, [phone]);

  const loadAddresses = async () => {
    try {
      const data = await apiClient.get<{ addresses?: any[] }>(`/customer/addresses?phone=${encodeURIComponent(phone)}`);
      const addressList = data.addresses || [];
      setAddresses(addressList);
      
      // Select default address or first address
      const defaultAddr = addressList.find((a: any) => a.isDefault) || addressList[0];
      setSelectedAddress(defaultAddr);
    } catch (error) {
      console.error('Error loading addresses:', error);
    }
  };

  // Calculate pricing breakdown using tax system
  const subtotal = getTotal();
  const taxableItems = cartItemsToTaxableItems(cart);
  const taxResult = calculateTax(taxableItems);
  const taxAmount = taxResult.total;
  const total = subtotal + taxAmount;
  
  // Get primary tax type and rate for display
  const primaryTax = taxResult.byType[0];
  const taxRate = primaryTax ? primaryTax.breakdown[0]?.rate || 18 : 18;
  const taxTypeLabel = primaryTax?.taxType === 'gst' ? 'GST' : 
                       primaryTax?.taxType === 'service_tax' ? 'Service Tax' :
                       primaryTax?.taxType || 'Tax';

  const handleAddressChange = async () => {
    try {
      // Reload addresses to get latest
      await loadAddresses();
      
      // Show address selection - in a real implementation, this would open a modal
      // For now, we'll just reload and let user see updated addresses
      if (addresses.length > 1) {
        // Cycle through addresses or show selection
        const currentIndex = addresses.findIndex(a => a.id === selectedAddress?.id);
        const nextIndex = (currentIndex + 1) % addresses.length;
        setSelectedAddress(addresses[nextIndex]);
        toast.success('Address changed');
      } else {
        toast.info('Add more addresses in your account settings');
      }
    } catch (error) {
      console.error('Error changing address:', error);
      toast.error('Failed to load addresses');
    }
  };

  const handlePayment = async () => {
    if (!selectedAddress) {
      toast.error('Please select a delivery address');
      return;
    }

    if (cart.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    try {
      setProcessing(true);

      // Handle COD (Cash on Delivery) - direct order creation
      if (paymentMethod === 'cod') {
        try {
          const orderData = await apiClient.post<any>('/customer/orders', {
            items: cart.map(item => ({
              productId: item.id,
              quantity: item.quantity,
              price: item.price,
            })),
            subtotal,
            taxAmount,
            taxBreakdown: taxResult.breakdown,
            taxByType: taxResult.byType,
            total,
            address: selectedAddress,
            shippingAddress: selectedAddress, // PHASE 1.3 FIX: Support both naming conventions
            paymentMethod: 'cod',
            customerPhone: phone, // PHASE 1.3 FIX: Include customer phone
          });

          clearCart();
          toast.success('Order placed successfully! Pay on delivery.');
          onSuccess(orderData.orderId || `order_${Date.now()}`);
        } catch (error: any) {
          console.error('Order creation error:', error);
          toast.error('Order creation failed. Please try again.');
        } finally {
          setProcessing(false);
        }
        return;
      }

      // Online payment (Razorpay) flow
      const paymentOptions = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY || 'rzp_test_key',
        amount: total * 100, // Convert to paise
        currency: 'INR',
        name: 'Warmpawz',
        description: `Order for ${cart.length} item(s)`,
        handler: async (response: any) => {
          try {
            // Verify payment and create order
            const orderData = await apiClient.post<any>('/customer/orders', {
              items: cart.map(item => ({
                productId: item.id,
                quantity: item.quantity,
                price: item.price,
              })),
              subtotal,
              taxAmount,
              taxBreakdown: taxResult.breakdown,
              taxByType: taxResult.byType,
              total,
              address: selectedAddress,
              shippingAddress: selectedAddress, // PHASE 1.3 FIX: Support both naming conventions
              paymentId: response.razorpay_payment_id,
              paymentMethod: 'razorpay',
              customerPhone: phone, // PHASE 1.3 FIX: Include customer phone
            });

            clearCart();
            toast.success('Order placed successfully!');
            onSuccess(orderData.orderId || `order_${Date.now()}`);
          } catch (error: any) {
            console.error('Order creation error:', error);
            toast.error('Order creation failed. Payment will be refunded.');
          } finally {
            setProcessing(false);
          }
        },
        prefill: {
          contact: phone.replace(/[^0-9]/g, ''),
        },
        theme: {
          color: '#FF8C42',
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
            toast.info('Payment cancelled');
          },
        },
      };

      // Load Razorpay script and open checkout
      if (typeof window !== 'undefined' && (window as any).Razorpay) {
        const razorpay = new (window as any).Razorpay(paymentOptions);
        razorpay.open();
      } else {
        // Mock payment success for development
        console.log('Razorpay not available - using mock payment');
        const mockResponse = {
          razorpay_payment_id: `pay_mock_${Date.now()}`,
          razorpay_order_id: `order_mock_${Date.now()}`,
          razorpay_signature: 'mock_signature',
        };
        paymentOptions.handler(mockResponse);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Payment failed');
      setProcessing(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Checkout</h1>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-gray-600 mb-6">Your cart is empty</p>
            <Button
              onClick={onBack}
              className="w-full bg-gradient-to-r from-[#FF8C42] to-[#FF6B9D] hover:from-[#FF7A29] hover:to-[#FF5A8D] text-white"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
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
            <h1 className="text-xl font-semibold text-white">Checkout</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Delivery Address */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#FF8C42]" />
                <h2 className="font-semibold text-gray-900">Delivery Address</h2>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleAddressChange}
                className="text-[#FF8C42] hover:text-[#FF6B9D]"
              >
                <Edit2 className="w-4 h-4 mr-1" />
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
              <p className="text-sm text-gray-500">No address selected</p>
            )}
          </div>

          {/* Order Summary */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Order Summary</h2>
            
            <div className="space-y-3 mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-gray-500">Qty: {item.quantity} × ₹{item.price}</p>
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
          </div>

          {/* Payment Method Selection */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Payment Method</h2>
            <div className="space-y-3">
              <button
                onClick={() => setPaymentMethod('online')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'online'
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    paymentMethod === 'online' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">Online Payment</h3>
                    <p className="text-sm text-gray-500">Pay securely via Razorpay</p>
                  </div>
                  {paymentMethod === 'online' && (
                    <div className="w-6 h-6 rounded-full bg-[#FF8C42] flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>

              <button
                onClick={() => setPaymentMethod('cod')}
                className={`w-full p-4 rounded-xl border-2 transition-all ${
                  paymentMethod === 'cod'
                    ? 'border-[#FF8C42] bg-orange-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    paymentMethod === 'cod' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Wallet className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="font-semibold text-gray-900">Cash on Delivery (COD)</h3>
                    <p className="text-sm text-gray-500">Pay when you receive your order</p>
                  </div>
                  {paymentMethod === 'cod' && (
                    <div className="w-6 h-6 rounded-full bg-[#FF8C42] flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-white"></div>
                    </div>
                  )}
                </div>
              </button>
            </div>
          </div>

          {/* Payment Button */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-md mx-auto shadow-lg">
            <Button
              onClick={handlePayment}
              disabled={processing || !selectedAddress}
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
                  {paymentMethod === 'cod' ? (
                    <>
                      <Wallet className="w-5 h-5 mr-2" />
                      Place Order (COD) ₹{total.toFixed(2)}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      Pay ₹{total.toFixed(2)}
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}