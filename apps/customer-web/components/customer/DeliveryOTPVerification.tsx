'use client';

/**
 * ============================================================================
 * DELIVERY OTP VERIFICATION COMPONENT
 * ============================================================================
 * 
 * Shows delivery OTP to customer and handles OTP verification for:
 * - Pharmacy orders
 * - Meal plan orders
 * - Any delivery-based orders
 * 
 * Features:
 * - Displays 4-digit OTP prominently for customer to share
 * - OTP verification input for delivery confirmation
 * - Order details display
 * - Success/error states
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Key, Copy, Check, Eye, EyeOff, RefreshCw, 
  AlertCircle, CheckCircle2, X, Loader2,
  Package, Truck, MapPin, Clock, Phone, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface OrderDetails {
  id: string;
  status: string;
  totalAmount?: number;
  items?: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
  deliveryAddress?: string;
  estimatedDelivery?: string;
  partnerName?: string;
  partnerPhone?: string;
  partnerVehicle?: string;
}

interface DeliveryOTPVerificationProps {
  orderId: string;
  orderType: 'pharmacy' | 'meal_plan' | 'product';
  deliveryOtp?: string;
  orderDetails?: OrderDetails;
  partnerName?: string;
  partnerPhone?: string;
  onVerificationSuccess?: () => void;
  onClose?: () => void;
  showOtpInput?: boolean; // For delivery partner to enter OTP
  className?: string;
}

export function DeliveryOTPVerification({
  orderId,
  orderType,
  deliveryOtp: initialOtp,
  orderDetails,
  partnerName,
  partnerPhone,
  onVerificationSuccess,
  onClose,
  showOtpInput = false,
  className = '',
}: DeliveryOTPVerificationProps) {
  const [loading, setLoading] = useState(!initialOtp);
  const [deliveryOtp, setDeliveryOtp] = useState<string>(initialOtp || '');
  const [showOTP, setShowOTP] = useState(false);
  const [copied, setCopied] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [order, setOrder] = useState<OrderDetails | null>(orderDetails || null);
  
  // OTP Input state (for delivery partner verification flow)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!initialOtp) {
      loadDeliveryOTP();
    }
  }, [orderId, initialOtp]);

  const loadDeliveryOTP = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>(`/delivery/${orderId}/status`);
      if (res.success || res.delivery_otp || res.deliveryOtp || res.otp) {
        setDeliveryOtp(res.delivery_otp || res.deliveryOtp || res.otp || '');
        setOtpVerified(res.otp_verified || res.otpVerified || false);
        
        // Load order details if not provided
        if (!orderDetails && res.order) {
          setOrder({
            id: orderId,
            status: res.status || res.delivery_status || 'pending',
            totalAmount: res.order?.total_amount || res.order?.totalAmount,
            items: res.order?.items,
            deliveryAddress: res.destination?.address || res.delivery_address,
            partnerName: res.partner_name || res.partnerName,
            partnerPhone: res.partner_phone || res.partnerPhone,
          });
        }
      }
    } catch (error) {
      console.error('Error loading delivery OTP:', error);
      toast.error('Failed to load delivery details');
    } finally {
      setLoading(false);
    }
  };

  const generateNewOTP = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post<any>(`/delivery/${orderId}/generate-otp`);
      if (res.success && res.otp) {
        setDeliveryOtp(res.otp);
        toast.success('New OTP generated');
      } else {
        toast.error(res.message || 'Failed to generate OTP');
      }
    } catch (error: any) {
      console.error('Error generating OTP:', error);
      toast.error(error.message || 'Failed to generate OTP');
    } finally {
      setLoading(false);
    }
  };

  const copyOTP = () => {
    if (deliveryOtp) {
      navigator.clipboard.writeText(deliveryOtp);
      setCopied(true);
      toast.success('OTP copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle OTP digit input
  const handleOtpChange = (index: number, value: string) => {
    // Only allow single digit
    if (!/^\d*$/.test(value)) return;
    
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1); // Take last character if multiple
    setOtpDigits(newDigits);
    setVerificationError(null);
    
    // Auto-focus next input
    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (/^\d{4}$/.test(pastedData)) {
      const digits = pastedData.split('');
      setOtpDigits(digits);
      inputRefs.current[3]?.focus();
    }
  };

  const verifyOTP = async () => {
    const enteredOtp = otpDigits.join('');
    
    if (enteredOtp.length !== 4) {
      setVerificationError('Please enter complete 4-digit OTP');
      return;
    }

    setVerifying(true);
    setVerificationError(null);
    
    try {
      const res = await apiClient.post<any>(`/delivery/${orderId}/verify-otp`, {
        otp: enteredOtp,
      });

      if (res.success) {
        setOtpVerified(true);
        toast.success('Delivery confirmed successfully!');
        onVerificationSuccess?.();
      } else {
        setVerificationError(res.message || res.error || 'Invalid OTP');
        toast.error('Invalid OTP. Please check and try again.');
        // Clear inputs on error
        setOtpDigits(['', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      setVerificationError(error.message || 'Verification failed');
      toast.error(error.message || 'Failed to verify OTP');
    } finally {
      setVerifying(false);
    }
  };

  const getOrderTypeLabel = () => {
    switch (orderType) {
      case 'pharmacy': return 'Medicine Delivery';
      case 'meal_plan': return 'Meal Plan Delivery';
      case 'product': return 'Product Delivery';
      default: return 'Delivery';
    }
  };

  if (loading) {
    return (
      <Card className={`bg-white rounded-2xl p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
        </div>
      </Card>
    );
  }

  // Already verified state
  if (otpVerified) {
    return (
      <Card className={`bg-white rounded-2xl overflow-hidden ${className}`}>
        <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white text-center">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Delivery Confirmed!</h2>
          <p className="text-white/80">Your order has been delivered successfully</p>
        </div>
        <div className="p-6">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-green-700 font-medium">
              Thank you for ordering with Warmpawz!
            </p>
            <p className="text-green-600 text-sm mt-1">
              We hope you and your pet enjoyed our service.
            </p>
          </div>
          {onClose && (
            <Button 
              onClick={onClose} 
              className="w-full mt-4 bg-green-500 hover:bg-green-600"
            >
              Done
            </Button>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className={`bg-white rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF7029] p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              {orderType === 'pharmacy' ? (
                <Package className="w-5 h-5" />
              ) : orderType === 'meal_plan' ? (
                <Package className="w-5 h-5" />
              ) : (
                <Truck className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="font-bold text-lg">{getOrderTypeLabel()}</h2>
              <p className="text-white/80 text-sm">Order #{orderId.slice(0, 8)}</p>
            </div>
          </div>
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Delivery Partner Info */}
      {(partnerName || order?.partnerName) && (
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{partnerName || order?.partnerName}</p>
                <p className="text-sm text-gray-500">Delivery Partner</p>
              </div>
            </div>
            {(partnerPhone || order?.partnerPhone) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = `tel:${partnerPhone || order?.partnerPhone}`}
              >
                <Phone className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main OTP Display Section - For Customer */}
      {deliveryOtp && !showOtpInput && (
        <div className="p-6">
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border-2 border-orange-200">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Key className="w-5 h-5 text-orange-600" />
              <h3 className="font-bold text-orange-800 text-lg">Your Delivery OTP</h3>
            </div>
            
            {/* Large OTP Display */}
            <div className="relative">
              <div className="flex justify-center gap-3 mb-4">
                {deliveryOtp.split('').map((digit, idx) => (
                  <div
                    key={idx}
                    className="w-14 h-16 bg-white rounded-xl shadow-sm border-2 border-orange-300 flex items-center justify-center"
                  >
                    <span className="text-3xl font-bold text-orange-600">
                      {showOTP ? digit : '•'}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Toggle & Copy Buttons */}
              <div className="flex justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowOTP(!showOTP)}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  {showOTP ? (
                    <>
                      <EyeOff className="w-4 h-4 mr-2" />
                      Hide OTP
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Show OTP
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyOTP}
                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy OTP
                    </>
                  )}
                </Button>
              </div>
            </div>
            
            {/* Instructions */}
            <div className="mt-4 text-center">
              <p className="text-orange-700 text-sm font-medium">
                Share this OTP with the delivery partner to confirm delivery
              </p>
            </div>
          </div>

          {/* Refresh OTP */}
          <div className="mt-4 text-center">
            <button
              onClick={generateNewOTP}
              disabled={loading}
              className="text-gray-500 text-sm hover:text-gray-700 flex items-center justify-center gap-2 mx-auto"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Generate New OTP
            </button>
          </div>
        </div>
      )}

      {/* OTP Input Section - For Verification (if needed) */}
      {showOtpInput && (
        <div className="p-6">
          <div className="text-center mb-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Enter Delivery OTP</h3>
            <p className="text-gray-600 text-sm">
              Ask the customer for the 4-digit OTP to confirm delivery
            </p>
          </div>

          {/* OTP Input Fields */}
          <div className="flex justify-center gap-3 mb-4">
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                className={`w-14 h-16 text-center text-2xl font-bold rounded-xl border-2 
                  ${verificationError 
                    ? 'border-red-300 bg-red-50 text-red-600' 
                    : 'border-gray-200 focus:border-[#FF8C42] focus:ring-2 focus:ring-orange-200'
                  }
                  outline-none transition`}
              />
            ))}
          </div>

          {/* Error Message */}
          {verificationError && (
            <div className="flex items-center justify-center gap-2 text-red-600 text-sm mb-4">
              <AlertCircle className="w-4 h-4" />
              <span>{verificationError}</span>
            </div>
          )}

          {/* Verify Button */}
          <Button
            onClick={verifyOTP}
            disabled={verifying || otpDigits.some(d => !d)}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7029] h-12 text-lg"
          >
            {verifying ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Verify & Confirm Delivery
              </>
            )}
          </Button>
        </div>
      )}

      {/* Order Details Summary */}
      {order && (
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <h4 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">
            Order Details
          </h4>
          
          {order.deliveryAddress && (
            <div className="flex items-start gap-2 mb-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
              <span className="text-sm text-gray-600">{order.deliveryAddress}</span>
            </div>
          )}
          
          {order.totalAmount && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
              <span className="font-medium text-gray-700">Total Amount</span>
              <span className="font-bold text-gray-900">₹{order.totalAmount}</span>
            </div>
          )}
        </div>
      )}

      {/* Safety Info */}
      <div className="p-4 bg-blue-50 border-t border-blue-100">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Important</p>
            <p>Only share the OTP after receiving your order. This confirms delivery and releases payment.</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default DeliveryOTPVerification;
