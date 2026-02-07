import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { CreditCard, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

const BASE_URL = `${getApiBaseUrl()}`;

interface RazorpayPaymentProps {
  amount: number;
  orderId?: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description: string;
  onSuccess: (paymentId: string, orderId: string, signature: string) => void;
  onFailure?: (error: any) => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function RazorpayPayment({
  amount,
  orderId,
  bookingId,
  customerId,
  customerName,
  customerEmail,
  customerPhone,
  description,
  onSuccess,
  onFailure
}: RazorpayPaymentProps) {
  const [loading, setLoading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const createRazorpayOrder = async () => {
    setCreatingOrder(true);
    try {
      const response = await fetch(`${BASE_URL}/payment/razorpay/create-order`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount,
          currency: 'INR',
          receipt: bookingId,
          notes: {
            bookingId,
            customerId,
            description
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.orderId;
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create order');
      }
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw error;
    } finally {
      setCreatingOrder(false);
    }
  };

  const handlePayment = async () => {
    if (!razorpayLoaded) {
      toast.error('Payment gateway not loaded. Please refresh.');
      return;
    }

    setLoading(true);

    try {
      // Create Razorpay order if not provided
      let razorpayOrderId = orderId;
      if (!razorpayOrderId) {
        razorpayOrderId = await createRazorpayOrder();
      }

      // Razorpay options
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 
             (typeof window !== 'undefined' ? (window as any).RAZORPAY_KEY_ID : ''),
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        name: 'Warmpawz',
        description,
        order_id: razorpayOrderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone
        },
        theme: {
          color: '#FF6B35'
        },
        handler: async function (response: any) {
          try {
            // Verify payment on backend
            const verifyResponse = await fetch(`${BASE_URL}/payment/razorpay/verify`, {
              method: 'POST',
              headers: {
                ...getAuthHeaders(),
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                bookingId,
                customerId,
                amount
              })
            });

            if (verifyResponse.ok) {
              toast.success('Payment successful!');
              onSuccess(
                response.razorpay_payment_id,
                response.razorpay_order_id,
                response.razorpay_signature
              );
            } else {
              const error = await verifyResponse.json();
              toast.error(error.error || 'Payment verification failed');
              onFailure?.(error);
            }
          } catch (error) {
            console.error('Payment verification error:', error);
            toast.error('Payment verification failed');
            onFailure?.(error);
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
            toast.info('Payment cancelled');
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      
      razorpay.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        toast.error(response.error.description || 'Payment failed');
        onFailure?.(response.error);
        setLoading(false);
      });

      razorpay.open();

    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Error initiating payment');
      onFailure?.(error);
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
      {/* Payment Summary */}
      <div className="mb-6">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-orange-600" />
          Payment Summary
        </h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Service</span>
            <span className="font-medium text-gray-900">{description}</span>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <span className="text-gray-600">Booking ID</span>
            <span className="font-mono text-sm text-gray-900">{bookingId}</span>
          </div>

          <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border-2 border-orange-200">
            <span className="font-medium text-gray-900">Total Amount</span>
            <span className="text-2xl font-bold text-orange-600">
              ₹{amount.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      {/* Security Info */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-blue-900 mb-1">Secure Payment</h4>
            <p className="text-sm text-blue-700">
              Your payment is processed securely through Razorpay. We never store your card details.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Methods */}
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-3">We accept:</p>
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 border border-gray-200 rounded-lg text-center">
            <p className="text-xs font-medium text-gray-700">Cards</p>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg text-center">
            <p className="text-xs font-medium text-gray-700">UPI</p>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg text-center">
            <p className="text-xs font-medium text-gray-700">Wallet</p>
          </div>
          <div className="p-3 border border-gray-200 rounded-lg text-center">
            <p className="text-xs font-medium text-gray-700">Net Banking</p>
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <Button
        onClick={handlePayment}
        disabled={loading || creatingOrder || !razorpayLoaded}
        className="w-full bg-orange-600 hover:bg-orange-700"
        size="lg"
      >
        {creatingOrder ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Creating Order...
          </>
        ) : loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : !razorpayLoaded ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading Payment Gateway...
          </>
        ) : (
          <>
            <Lock className="w-5 h-5 mr-2" />
            Pay ₹{amount.toLocaleString('en-IN')}
          </>
        )}
      </Button>

      {/* Terms */}
      <p className="text-xs text-gray-500 text-center mt-4">
        By proceeding, you agree to our Terms & Conditions and Privacy Policy
      </p>
    </div>
  );
}
