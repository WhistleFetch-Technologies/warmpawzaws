import React, { useState } from 'react';
import { Tag, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';

/**
 * 🎫 COUPON CODE INPUT COMPONENT
 * 
 * Features:
 * - Coupon code input with validation
 * - Real-time validation feedback
 * - Discount calculation display
 * - Apply/Remove coupon functionality
 * - Error handling and messaging
 */

interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  isActive: boolean;
}

interface CouponCodeInputProps {
  orderAmount: number;
  customerId?: string;
  onCouponApplied?: (discount: number, coupon: Coupon) => void;
  onCouponRemoved?: () => void;
  className?: string;
}

export function CouponCodeInput({
  orderAmount,
  customerId,
  onCouponApplied,
  onCouponRemoved,
  className = ''
}: CouponCodeInputProps) {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const validateCoupon = async () => {
    if (!code.trim()) {
      setError('Please enter a coupon code');
      return;
    }

    try {
      setValidating(true);
      setError(null);

      const response = await fetch(
        `${getApiBaseUrl()}/coupons/validate`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code: code.trim(),
            orderAmount,
            customerId
          })
        }
      );

      const data = await response.json();

      if (data.success && data.valid) {
        // Coupon is valid
        const couponData: Coupon = {
          id: data.couponId,
          code: code.trim().toUpperCase(),
          type: data.discountType,
          value: data.discountValue,
          maxDiscountAmount: data.maxDiscountAmount,
          minOrderAmount: data.minOrderAmount,
          isActive: true
        };

        setAppliedCoupon(couponData);
        setDiscountAmount(data.discountAmount);
        setError(null);

        if (onCouponApplied) {
          onCouponApplied(data.discountAmount, couponData);
        }
      } else {
        // Coupon is invalid
        setError(data.error || 'Invalid coupon code');
        setAppliedCoupon(null);
        setDiscountAmount(0);
      }
    } catch (error) {
      console.error('Error validating coupon:', error);
      setError('Failed to validate coupon. Please try again.');
    } finally {
      setValidating(false);
    }
  };

  const removeCoupon = () => {
    setCode('');
    setAppliedCoupon(null);
    setDiscountAmount(0);
    setError(null);

    if (onCouponRemoved) {
      onCouponRemoved();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !appliedCoupon) {
      validateCoupon();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Coupon Input */}
      {!appliedCoupon ? (
        <div className="space-y-2">
          <label className="text-sm text-gray-700 flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Have a coupon code?
          </label>
          
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="Enter code"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                disabled={validating}
              />
            </div>
            
            <button
              onClick={validateCoupon}
              disabled={validating || !code.trim()}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
            >
              {validating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking
                </>
              ) : (
                'Apply'
              )}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        /* Applied Coupon Display */
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="bg-green-500 rounded-full p-1">
                <Check className="h-4 w-4 text-white" />
              </div>
              <span className="text-green-700">Coupon Applied!</span>
            </div>
            <button
              onClick={removeCoupon}
              className="text-gray-500 hover:text-red-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Code:</span>
              <span className="text-sm bg-white px-3 py-1 rounded border border-green-200">
                {appliedCoupon.code}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Discount:</span>
              <span className="text-lg text-green-600">
                -₹{discountAmount.toFixed(2)}
              </span>
            </div>

            {appliedCoupon.type === 'percentage' && (
              <div className="text-xs text-gray-600 mt-2">
                {appliedCoupon.value}% off
                {appliedCoupon.maxDiscountAmount && ` (max ₹${appliedCoupon.maxDiscountAmount})`}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popular Coupons Suggestions */}
      {!appliedCoupon && !error && (
        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs text-gray-600 mb-2">Popular codes:</p>
          <div className="flex flex-wrap gap-2">
            {['FIRST20', 'SAVE10', 'GROOM50'].map((suggestedCode) => (
              <button
                key={suggestedCode}
                onClick={() => setCode(suggestedCode)}
                className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full hover:bg-orange-100 hover:text-orange-600 transition-colors"
              >
                {suggestedCode}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 💰 DISCOUNT SUMMARY COMPONENT
 * Shows discount breakdown in booking summary
 */

interface DiscountSummaryProps {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  couponCode?: string;
  className?: string;
}

export function DiscountSummary({
  originalAmount,
  discountAmount,
  finalAmount,
  couponCode,
  className = ''
}: DiscountSummaryProps) {
  if (discountAmount === 0) {
    return null;
  }

  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Tag className="h-4 w-4 text-green-600" />
        <span className="text-sm text-green-700">Discount Applied</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Original Amount</span>
          <span className="text-gray-900">₹{originalAmount.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-green-600">Discount {couponCode && `(${couponCode})`}</span>
          <span className="text-green-600">-₹{discountAmount.toFixed(2)}</span>
        </div>

        <div className="border-t border-green-200 pt-2 flex items-center justify-between">
          <span className="text-gray-900">Final Amount</span>
          <span className="text-xl text-gray-900">₹{finalAmount.toFixed(2)}</span>
        </div>

        <div className="bg-white border border-green-200 rounded p-2 text-center">
          <span className="text-green-600">
            You saved ₹{discountAmount.toFixed(2)}!
          </span>
        </div>
      </div>
    </div>
  );
}
