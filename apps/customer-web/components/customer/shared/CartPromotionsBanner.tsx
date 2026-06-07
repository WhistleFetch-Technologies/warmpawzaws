'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  Tag, Gift, Zap, Percent, ChevronDown, ChevronUp, 
  CheckCircle2, Sparkles, ShoppingBag, AlertCircle, X 
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { 
  CartPromotionResult, 
  AppliedPromotion, 
  Promotion,
  formatSavings,
  getPromotionBadgeText 
} from '@/lib/promotions-engine';

interface CartItem {
  id: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  vendorId?: string;
  category?: string;
  categoryId?: string;
}

interface CartPromotionsBannerProps {
  items: CartItem[];
  vendorId?: string;
  customerId?: string;
  onPromotionApplied?: (result: CartPromotionResult) => void;
  compact?: boolean;
}

/**
 * CartPromotionsBanner - Shows applied promotions, BOGO indicators, and savings
 */
export function CartPromotionsBanner({
  items,
  vendorId,
  customerId,
  onPromotionApplied,
  compact = false,
}: CartPromotionsBannerProps) {
  const [promotionResult, setPromotionResult] = useState<CartPromotionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAppliedKeyRef = useRef<string | null>(null);

  /** Stable key so inline `items={[...]}` from parents does not retrigger the effect every render. */
  const itemsKey = useMemo(
    () =>
      items
        .map(
          (i) =>
            `${i.id ?? i.productId}:${i.quantity}:${i.price}:${i.vendorId ?? ''}:${i.categoryId ?? ''}`
        )
        .join('|'),
    [items]
  );

  const calculatePromotions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.post<any>('/promotions/calculate-cart', {
        items,
        vendorId,
        customerId,
      });

      if (res.success) {
        const result: CartPromotionResult = {
          originalTotal: res.originalTotal,
          discountedTotal: res.discountedTotal,
          totalSavings: res.totalSavings,
          appliedPromotions: res.bestPromotion
            ? [
                {
                  promotion: res.bestPromotion,
                  discountAmount: res.bestPromotion.calculatedDiscount,
                  affectedItems: [],
                  type: res.bestPromotion.type,
                  description: res.bestPromotion.description,
                },
              ]
            : [],
          suggestedPromotions: (res.allPromotions || []).slice(1),
          freeItemsAdded: [],
        };
        const resultKey = `${itemsKey}:${result.totalSavings}:${result.appliedPromotions[0]?.promotion?.id ?? 'none'}`;
        setPromotionResult(result);
        if (lastAppliedKeyRef.current !== resultKey) {
          lastAppliedKeyRef.current = resultKey;
          onPromotionApplied?.(result);
        }
      }
    } catch (err: unknown) {
      console.error('Error calculating promotions:', err);
      setError('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  }, [items, itemsKey, vendorId, customerId, onPromotionApplied]);

  useEffect(() => {
    if (items.length === 0) {
      setPromotionResult(null);
      lastAppliedKeyRef.current = null;
      return;
    }
    void calculatePromotions();
    // itemsKey gates re-fetch; calculatePromotions omitted to avoid unstable callback loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, vendorId, customerId, items.length]);

  if (loading) {
    return (
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-orange-200 rounded" />
          <div className="h-4 w-32 bg-orange-200 rounded" />
        </div>
      </div>
    );
  }

  if (!promotionResult || promotionResult.appliedPromotions.length === 0) {
    return null;
  }

  const { totalSavings, appliedPromotions, freeItemsAdded } = promotionResult;
  const mainPromo = appliedPromotions[0];

  if (compact) {
    return (
      <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-green-800">
            {mainPromo.description}
          </span>
        </div>
        <Badge className="bg-green-500 text-white">
          Save {formatSavings(totalSavings)}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden border-2 border-green-200 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Main Banner */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
              {mainPromo.type === 'bogo' ? (
                <Gift className="w-6 h-6 text-white" />
              ) : mainPromo.type === 'percentage' ? (
                <Percent className="w-6 h-6 text-white" />
              ) : (
                <Tag className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-green-900">
                  {mainPromo.description}
                </span>
                <Badge className="bg-green-500/20 text-green-700 text-xs">
                  Auto-Applied
                </Badge>
              </div>
              <p className="text-sm text-green-700">
                {mainPromo.promotion.name}
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-green-600">
              -{formatSavings(totalSavings)}
            </div>
            <div className="flex items-center gap-1 text-xs text-green-600">
              <span>Details</span>
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </div>
          </div>
        </div>

        {/* Free Items Indicator */}
        {freeItemsAdded.length > 0 && (
          <div className="mt-3 flex items-center gap-2 bg-white/50 rounded-lg p-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-800">
              🎉 {freeItemsAdded.map(f => `${f.quantity}x ${f.itemName}`).join(', ')} FREE!
            </span>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t border-green-200 bg-white/50 p-4 space-y-3">
          <h4 className="font-semibold text-gray-900 text-sm">Applied Promotions</h4>
          
          {appliedPromotions.map((promo, idx) => (
            <div 
              key={idx}
              className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                  {promo.type === 'bogo' ? (
                    <Gift className="w-4 h-4 text-green-600" />
                  ) : (
                    <Tag className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {promo.promotion.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {promo.description}
                  </p>
                </div>
              </div>
              <span className="font-bold text-green-600">
                -₹{promo.discountAmount.toFixed(0)}
              </span>
            </div>
          ))}

          {/* Savings Summary */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg p-3 mt-4">
            <div className="flex items-center justify-between">
              <span className="font-medium">Total Savings</span>
              <span className="text-xl font-bold">₹{totalSavings.toFixed(0)}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * BogoItemIndicator - Shows BOGO indicator on individual cart items
 */
interface BogoItemIndicatorProps {
  isFreeItem: boolean;
  freeQuantity?: number;
  discountPercent?: number;
}

export function BogoItemIndicator({
  isFreeItem,
  freeQuantity = 1,
  discountPercent = 100,
}: BogoItemIndicatorProps) {
  if (!isFreeItem) return null;

  return (
    <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white px-2 py-1 rounded-full text-xs font-medium">
      <Gift className="w-3 h-3" />
      <span>
        {discountPercent === 100 
          ? `${freeQuantity} FREE` 
          : `${freeQuantity} @ ${discountPercent}% OFF`
        }
      </span>
    </div>
  );
}

/**
 * PromotionSuggestion - Shows suggestions for nearly qualifying promotions
 */
interface PromotionSuggestionProps {
  suggestion: Promotion;
  amountNeeded?: number;
  itemsNeeded?: number;
  onAction?: () => void;
}

export function PromotionSuggestion({
  suggestion,
  amountNeeded,
  itemsNeeded,
  onAction,
}: PromotionSuggestionProps) {
  const message = amountNeeded 
    ? `Add ₹${amountNeeded.toFixed(0)} more to unlock`
    : itemsNeeded 
      ? `Add ${itemsNeeded} more item${itemsNeeded > 1 ? 's' : ''} to unlock`
      : 'Almost there!';

  return (
    <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg p-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
          <Zap className="w-4 h-4 text-amber-600" />
        </div>
        <div>
          <p className="font-medium text-sm text-amber-900">
            {getPromotionBadgeText(suggestion)}
          </p>
          <p className="text-xs text-amber-700">
            {message}
          </p>
        </div>
      </div>
      {onAction && (
        <Button
          size="sm"
          variant="outline"
          onClick={onAction}
          className="border-amber-300 text-amber-700 hover:bg-amber-100"
        >
          <ShoppingBag className="w-3 h-3 mr-1" />
          Add
        </Button>
      )}
    </div>
  );
}

export default CartPromotionsBanner;
