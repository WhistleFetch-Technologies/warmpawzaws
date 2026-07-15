'use client';

import { hasEffectivePriceReduction } from '@warmpawz/shared-types';
import { 
  Zap, Calendar, Gift, Package, Users, Tag, 
  Percent, Clock, Sparkles, Timer
} from 'lucide-react';

interface PromotionBadgeProps {
  type: 'flash_sale' | 'seasonal' | 'buy_x_get_y' | 'bundle' | 'first_order' | 'category_discount' | 'first_booking' | 'combo' | 'loyalty' | 'service_specific' | string;
  discountValue?: number;
  discountType?: 'percentage' | 'fixed';
  buyQuantity?: number;
  getQuantity?: number;
  getDiscountPercent?: number;
  endDate?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'badge' | 'tag' | 'banner' | 'corner';
  className?: string;
}

const TYPE_CONFIG: Record<string, { icon: any; gradient: string; label: string }> = {
  flash_sale: { icon: Zap, gradient: 'from-rose-500 to-pink-500', label: 'Flash Sale' },
  seasonal: { icon: Calendar, gradient: 'from-amber-500 to-orange-500', label: 'Sale' },
  buy_x_get_y: { icon: Gift, gradient: 'from-purple-500 to-indigo-500', label: 'BOGO' },
  bundle: { icon: Package, gradient: 'from-teal-500 to-emerald-500', label: 'Combo' },
  first_order: { icon: Users, gradient: 'from-blue-500 to-cyan-500', label: 'First Order' },
  first_booking: { icon: Users, gradient: 'from-blue-500 to-cyan-500', label: 'First Booking' },
  category_discount: { icon: Tag, gradient: 'from-slate-500 to-zinc-600', label: 'Discount' },
  combo: { icon: Package, gradient: 'from-teal-500 to-emerald-500', label: 'Combo Deal' },
  loyalty: { icon: Gift, gradient: 'from-purple-500 to-violet-500', label: 'Loyalty' },
  service_specific: { icon: Tag, gradient: 'from-orange-500 to-amber-500', label: 'Special' },
};

export function PromotionBadge({
  type,
  discountValue,
  discountType = 'percentage',
  buyQuantity,
  getQuantity,
  getDiscountPercent,
  endDate,
  size = 'md',
  variant = 'badge',
  className = ''
}: PromotionBadgeProps) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.seasonal;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-xs px-2 py-1',
    lg: 'text-sm px-3 py-1.5'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4'
  };

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 24) return `${hours}h left`;
    const days = Math.floor(hours / 24);
    return `${days}d left`;
  };

  const timeRemaining = getTimeRemaining();

  // Format discount display
  const getDiscountDisplay = () => {
    if (type === 'buy_x_get_y' && buyQuantity && getQuantity) {
      if (getDiscountPercent === 100) {
        return `Buy ${buyQuantity} Get ${getQuantity} FREE`;
      }
      return `Buy ${buyQuantity} Get ${getQuantity} @ ${getDiscountPercent}% OFF`;
    }
    if (discountValue) {
      return discountType === 'percentage' 
        ? `${discountValue}% OFF` 
        : `₹${discountValue} OFF`;
    }
    return config.label;
  };

  // Corner ribbon variant
  if (variant === 'corner') {
    return (
      <div className={`absolute -right-2 -top-2 z-10 ${className}`}>
        <div className={`bg-gradient-to-r ${config.gradient} text-white rounded-full px-2 py-0.5 text-[10px] font-bold shadow-lg flex items-center gap-1`}>
          <Icon className="w-3 h-3" />
          {discountValue && (
            <span>{discountValue}{discountType === 'percentage' ? '%' : '₹'}</span>
          )}
        </div>
      </div>
    );
  }

  // Banner variant (full width)
  if (variant === 'banner') {
    return (
      <div className={`bg-gradient-to-r ${config.gradient} text-white p-2 flex items-center justify-between ${className}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="font-semibold text-sm">{getDiscountDisplay()}</span>
        </div>
        {timeRemaining && (
          <div className="flex items-center gap-1 bg-white/20 rounded-full px-2 py-0.5 text-xs">
            <Timer className="w-3 h-3" />
            {timeRemaining}
          </div>
        )}
      </div>
    );
  }

  // Tag variant
  if (variant === 'tag') {
    return (
      <div className={`inline-flex items-center gap-1 bg-gradient-to-r ${config.gradient} text-white rounded-r-full pl-1 pr-2 ${sizeClasses[size]} font-medium shadow-sm ${className}`}>
        <div className="w-4 h-4 bg-white rounded-full flex items-center justify-center">
          <Icon className={`${iconSizes.sm} text-${config.gradient.split('-')[1]}-500`} style={{ color: 'inherit' }} />
        </div>
        <span>{getDiscountDisplay()}</span>
      </div>
    );
  }

  // Default badge variant
  return (
    <div className={`inline-flex items-center gap-1 bg-gradient-to-r ${config.gradient} text-white rounded-full ${sizeClasses[size]} font-medium shadow-sm ${className}`}>
      <Icon className={iconSizes[size]} />
      <span>{getDiscountDisplay()}</span>
      {timeRemaining && type === 'flash_sale' && size !== 'sm' && (
        <span className="ml-1 bg-white/20 rounded-full px-1.5 text-[10px]">{timeRemaining}</span>
      )}
    </div>
  );
}

// Strike-through price component
export function SalePrice({
  originalPrice,
  salePrice,
  discountPercent,
  size = 'md',
  className = ''
}: {
  originalPrice: number;
  salePrice: number;
  discountPercent?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const showReduction = hasEffectivePriceReduction(originalPrice, salePrice);
  const actualDiscount = showReduction
    ? discountPercent || Math.round(((originalPrice - salePrice) / originalPrice) * 100)
    : 0;

  const textSizes = {
    sm: { sale: 'text-sm', original: 'text-xs', badge: 'text-[10px]' },
    md: { sale: 'text-lg', original: 'text-sm', badge: 'text-xs' },
    lg: { sale: 'text-xl', original: 'text-base', badge: 'text-sm' }
  };

  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className={`font-bold text-slate-900 ${textSizes[size].sale}`}>₹{salePrice.toLocaleString()}</span>
      {showReduction && (
        <>
          <span className={`text-slate-400 cw-price-strike ${textSizes[size].original}`}>₹{originalPrice.toLocaleString()}</span>
          <span className={`bg-emerald-100 text-emerald-700 font-semibold px-1.5 py-0.5 rounded ${textSizes[size].badge}`}>
            {actualDiscount}% off
          </span>
        </>
      )}
    </div>
  );
}

// Coupon code display
export function CouponCode({
  code,
  discount,
  discountType = 'percentage',
  onApply,
  applied = false,
  size = 'md',
  className = ''
}: {
  code: string;
  discount?: number;
  discountType?: 'percentage' | 'fixed';
  onApply?: () => void;
  applied?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2 p-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg ${className}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Tag className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-orange-500`} />
          <code className={`font-mono font-bold text-orange-700 ${size === 'sm' ? 'text-sm' : 'text-base'}`}>{code}</code>
        </div>
        {discount && (
          <p className={`text-orange-600 ${size === 'sm' ? 'text-[10px]' : 'text-xs'} mt-0.5`}>
            Get {discount}{discountType === 'percentage' ? '%' : '₹'} off
          </p>
        )}
      </div>
      {onApply && (
        <button
          onClick={onApply}
          disabled={applied}
          className={`px-3 py-1.5 rounded-lg font-semibold text-sm transition-all ${
            applied 
              ? 'bg-emerald-500 text-white' 
              : 'bg-orange-500 text-white hover:bg-orange-600'
          }`}
        >
          {applied ? 'Applied' : 'Apply'}
        </button>
      )}
    </div>
  );
}

// Promo offers section for product/service detail page
export function PromoOffersSection({
  promotions,
  onApplyCoupon,
  appliedCode,
  className = ''
}: {
  promotions: Array<{
    id: string;
    name: string;
    code?: string;
    promotion_type: string;
    discount_value?: number;
    discount_type?: 'percentage' | 'fixed';
    description?: string;
    end_date?: string;
  }>;
  onApplyCoupon?: (code: string) => void;
  appliedCode?: string;
  className?: string;
}) {
  if (!promotions || promotions.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      <h4 className="font-semibold text-slate-900 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-orange-500" />
        Available Offers
      </h4>
      <div className="space-y-2">
        {promotions.map((promo) => (
          <div key={promo.id} className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <PromotionBadge 
                    type={promo.promotion_type} 
                    discountValue={promo.discount_value}
                    discountType={promo.discount_type}
                    size="sm"
                  />
                  {promo.end_date && (
                    <span className="text-[10px] text-orange-600 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      Ends {new Date(promo.end_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-700 font-medium">{promo.name}</p>
                {promo.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{promo.description}</p>
                )}
              </div>
              {promo.code && onApplyCoupon && (
                <button
                  onClick={() => onApplyCoupon(promo.code!)}
                  disabled={appliedCode === promo.code}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
                    appliedCode === promo.code
                      ? 'bg-emerald-500 text-white'
                      : 'bg-orange-500 text-white hover:bg-orange-600'
                  }`}
                >
                  {appliedCode === promo.code ? 'Applied' : promo.code}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default PromotionBadge;
