'use client';

import React, { useState, useEffect } from 'react';
import { 
  Tag, ChevronDown, ChevronUp, Check, X, Loader2, 
  Sparkles, Clock, Percent, Gift, Zap, Copy, ArrowRight
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  validateCouponCode,
  couponValidateOrderTypeForCheckout,
  type AppliedCheckoutCoupon,
} from '@/lib/pricing/coupon-validation';

interface Promotion {
  id: string;
  name: string;
  description?: string;
  code?: string;
  promotion_type: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value?: number;
  min_booking_value?: number;
  max_discount_amount?: number;
  end_date: string;
  promo_category?: 'product' | 'service' | 'platform';
}

export type AppliedCoupon = AppliedCheckoutCoupon;

interface CouponSectionProps {
  vendorId?: string;
  customerId?: string;
  orderAmount: number;
  /** booking = service, order = product, meal = service validation */
  orderType: 'booking' | 'order' | 'meal';
  appliedCoupon: AppliedCoupon | null;
  onApplyCoupon: (coupon: AppliedCoupon) => void;
  onRemoveCoupon: () => void;
  className?: string;
}

export function CouponSection({
  vendorId,
  customerId,
  orderAmount,
  orderType,
  appliedCoupon,
  onApplyCoupon,
  onRemoveCoupon,
  className = '',
}: CouponSectionProps) {
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [availablePromotions, setAvailablePromotions] = useState<Promotion[]>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(false);

  // Fetch available promotions for the vendor
  useEffect(() => {
    if (vendorId && expanded) {
      fetchAvailablePromotions();
    }
  }, [vendorId, expanded]);

  const fetchAvailablePromotions = async () => {
    if (!vendorId) return;
    
    setLoadingPromotions(true);
    try {
      const res = await apiClient.get<any>(`/vendors/${vendorId}/active-promotions?type=${orderType === 'booking' ? 'service' : 'product'}`);
      setAvailablePromotions((res as any)?.promotions || []);
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setLoadingPromotions(false);
    }
  };

  const checkoutKind =
    orderType === 'order' ? 'product_order' : orderType === 'meal' ? 'meal' : 'service_booking';

  const validateCoupon = async (code: string) => {
    setLoading(true);
    try {
      const result = await validateCouponCode({
        code,
        vendorId,
        customerId,
        orderType: couponValidateOrderTypeForCheckout(checkoutKind),
        amount: orderAmount,
      });

      if (result.ok) {
        onApplyCoupon(result.coupon);
        toast.success(`Coupon applied! You save ₹${result.coupon.discountAmount.toFixed(0)}`);
        setCouponCode('');
        setExpanded(false);
      } else {
        toast.error(result.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const applyPromotion = async (promo: Promotion) => {
    if (promo.code) {
      await validateCoupon(promo.code);
    } else {
      // Auto-apply promotion without code
      let discountAmount = 0;
      if (promo.discount_type === 'percentage') {
        discountAmount = (orderAmount * promo.discount_value) / 100;
        if (promo.max_discount_amount) {
          discountAmount = Math.min(discountAmount, promo.max_discount_amount);
        }
      } else {
        discountAmount = promo.discount_value;
      }

      onApplyCoupon({
        code: promo.name,
        discountType: promo.discount_type,
        discountValue: promo.discount_value,
        discountAmount,
        promotionId: promo.id,
        promoCategory: promo.promo_category
      });
      toast.success(`Offer applied! You save ₹${discountAmount.toFixed(0)}`);
      setExpanded(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied!');
  };

  const getPromoTypeIcon = (type: string) => {
    switch (type) {
      case 'flash_sale': return <Zap className="w-4 h-4" />;
      case 'seasonal': return <Clock className="w-4 h-4" />;
      case 'first_order':
      case 'first_booking': return <Sparkles className="w-4 h-4" />;
      default: return <Gift className="w-4 h-4" />;
    }
  };

  const getPromoTypeGradient = (type: string) => {
    switch (type) {
      case 'flash_sale': return 'from-rose-500 to-pink-500';
      case 'seasonal': return 'from-amber-500 to-orange-500';
      case 'first_order':
      case 'first_booking': return 'from-blue-500 to-cyan-500';
      case 'combo':
      case 'bundle': return 'from-teal-500 to-emerald-500';
      default: return 'from-purple-500 to-indigo-500';
    }
  };

  // If coupon is applied, show applied state
  if (appliedCoupon) {
    return (
      <div className={`bg-emerald-50 border border-emerald-200 rounded-xl p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
              <Check className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-emerald-800">{appliedCoupon.code}</p>
              <p className="text-xs text-emerald-600">
                You save ₹{appliedCoupon.discountAmount.toFixed(0)}
              </p>
            </div>
          </div>
          <button 
            onClick={onRemoveCoupon}
            className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-emerald-700" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
      {/* Collapsed Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
            <Tag className="w-4 h-4 text-orange-600" />
          </div>
          <span className="font-medium text-slate-700">Apply Coupon</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-100 p-3 space-y-4">
          {/* Manual Input */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg font-mono uppercase focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              />
            </div>
            <button
              onClick={() => validateCoupon(couponCode)}
              disabled={loading || !couponCode.trim()}
              className="px-4 py-2.5 bg-orange-500 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Apply'
              )}
            </button>
          </div>

          {/* Available Promotions */}
          {loadingPromotions ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
            </div>
          ) : availablePromotions.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Available Offers
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availablePromotions.map((promo) => {
                  const minValue = promo.min_order_value || promo.min_booking_value || 0;
                  const isEligible = orderAmount >= minValue;
                  
                  return (
                    <div 
                      key={promo.id}
                      className={`border rounded-xl overflow-hidden ${
                        isEligible ? 'border-slate-200' : 'border-slate-100 opacity-60'
                      }`}
                    >
                      {/* Promo Header */}
                      <div className={`p-2 bg-gradient-to-r ${getPromoTypeGradient(promo.promotion_type)} text-white flex items-center justify-between`}>
                        <div className="flex items-center gap-1.5">
                          {getPromoTypeIcon(promo.promotion_type)}
                          <span className="font-bold text-sm">
                            {promo.discount_value}{promo.discount_type === 'percentage' ? '%' : '₹'} OFF
                          </span>
                        </div>
                        {promo.end_date && (
                          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
                            Ends {new Date(promo.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      
                      {/* Promo Content */}
                      <div className="p-3">
                        <p className="font-medium text-slate-900 text-sm">{promo.name}</p>
                        {promo.description && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{promo.description}</p>
                        )}
                        
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2">
                            {promo.code && (
                              <button
                                onClick={() => copyCode(promo.code!)}
                                className="flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs font-mono"
                              >
                                {promo.code}
                                <Copy className="w-3 h-3 text-slate-400" />
                              </button>
                            )}
                            {minValue > 0 && (
                              <span className="text-[10px] text-slate-400">
                                Min ₹{minValue}
                              </span>
                            )}
                          </div>
                          
                          <button
                            onClick={() => applyPromotion(promo)}
                            disabled={!isEligible || loading}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                              isEligible
                                ? 'bg-orange-500 text-white hover:bg-orange-600'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {isEligible ? 'Apply' : `Add ₹${minValue - orderAmount} more`}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : vendorId ? (
            <div className="text-center py-4">
              <p className="text-sm text-slate-500">No promotions available</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// Mini coupon input for inline use
export function MiniCouponInput({
  onApply,
  loading = false,
  className = ''
}: {
  onApply: (code: string) => void;
  loading?: boolean;
  className?: string;
}) {
  const [code, setCode] = useState('');

  return (
    <div className={`flex gap-2 ${className}`}>
      <div className="flex-1 relative">
        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Enter code"
          className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg font-mono uppercase text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
        />
      </div>
      <button
        onClick={() => {
          if (code.trim()) {
            onApply(code);
          }
        }}
        disabled={loading || !code.trim()}
        className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium text-sm disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
      </button>
    </div>
  );
}

export default CouponSection;
