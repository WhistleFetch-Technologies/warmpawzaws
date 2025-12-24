import React, { useState, useEffect } from 'react';
import { Tag, Calendar, ChevronRight, X, Sparkles } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

/**
 * 🎯 CUSTOMER MARKETING INTEGRATION - Promotions & Deals
 * 
 * Features:
 * - Browse active promotions and deals
 * - Filter by service category
 * - View promotion details
 * - Apply promotions to bookings
 * - Display countdown timers for expiring deals
 */

interface Promotion {
  id: string;
  title?: string;
  name?: string; // Backend uses 'name'
  description?: string;
  bannerImage?: string;
  discountType?: 'percentage' | 'fixed' | 'freebie';
  discountValue?: number;
  discountPercentage?: number; // New format from backend
  discountAmount?: number; // New format from backend
  maxDiscountAmount?: number;
  minOrderAmount?: number;
  validFrom?: string;
  startDate?: string; // Backend uses 'startDate'
  validUntil?: string;
  endDate?: string; // Backend uses 'endDate'
  targetIds?: string[];
  applicableTo?: 'services' | 'products' | 'all';
  isActive: boolean;
  priority?: number;
  termsAndConditions?: string;
}

interface PromotionsDealsProps {
  category?: string;
  applicableTo?: 'services' | 'products' | 'all';
  onPromotionSelect?: (promotion: Promotion) => void;
  compact?: boolean;
}

export function PromotionsDeals({ 
  category, 
  applicableTo = 'all',
  onPromotionSelect,
  compact = false 
}: PromotionsDealsProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchActivePromotions();
  }, [category, applicableTo]);

  const fetchActivePromotions = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (applicableTo) params.append('applicableTo', applicableTo);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/promotions/active?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (data.success) {
        setPromotions(data.promotions || []);
      } else {
        console.error('Failed to fetch promotions:', data.error);
      }
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTimeLeft = (validUntil?: string) => {
    if (!validUntil) return null;
    const now = new Date();
    const end = new Date(validUntil);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} left`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} left`;
    return 'Ending soon';
  };

  const getDiscountText = (promo: Promotion) => {
    if (promo.discountType === 'percentage') {
      return `${promo.discountValue}% OFF`;
    } else if (promo.discountType === 'fixed') {
      return `₹${promo.discountValue} OFF`;
    } else {
      return 'FREE GIFT';
    }
  };

  const handlePromotionClick = (promo: Promotion) => {
    setSelectedPromotion(promo);
    setShowDetails(true);
    if (onPromotionSelect) {
      onPromotionSelect(promo);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-200 h-24 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (promotions.length === 0) {
    return (
      <div className="p-8 text-center">
        <Sparkles className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <p className="text-gray-600">No active promotions at the moment</p>
        <p className="text-sm text-gray-500 mt-2">Check back soon for exciting deals!</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {promotions.slice(0, 3).map(promo => (
          <div
            key={promo.id}
            onClick={() => handlePromotionClick(promo)}
            className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-orange-600" />
                <span className="text-orange-600">{getDiscountText(promo)}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-orange-600" />
            </div>
            <p className="text-sm mt-1 line-clamp-1">{promo.title}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Promotions List */}
      <div className="grid grid-cols-1 gap-4">
        {promotions.map(promo => (
          <div
            key={promo.id}
            onClick={() => handlePromotionClick(promo)}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
          >
            {promo.bannerImage && (
              <div className="h-40 bg-gradient-to-r from-orange-400 to-pink-500 relative">
                <img 
                  src={promo.bannerImage} 
                  alt={promo.title || promo.name || 'Promotion'}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 right-3 bg-white px-3 py-1 rounded-full text-sm shadow-md">
                  <span className="text-orange-600">{getDiscountText(promo)}</span>
                </div>
              </div>
            )}

            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="text-lg mb-1">{promo.title || promo.name || 'Special Offer'}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                    {promo.description || ''}
                  </p>

                  {/* Conditions */}
                  <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                    {promo.minOrderAmount && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        Min ₹{promo.minOrderAmount}
                      </span>
                    )}
                    {promo.maxDiscountAmount && (promo.discountType === 'percentage' || promo.discountPercentage) && (
                      <span className="bg-gray-100 px-2 py-1 rounded">
                        Max ₹{promo.maxDiscountAmount}
                      </span>
                    )}
                  </div>
                </div>

                {!promo.bannerImage && (
                  <div className="bg-gradient-to-br from-orange-500 to-pink-500 text-white px-4 py-2 rounded-lg text-center shrink-0">
                    <div className="text-lg">{getDiscountText(promo)}</div>
                  </div>
                )}
              </div>

              {/* Time Left */}
              {calculateTimeLeft(promo.endDate || promo.validUntil) && (
                <div className="mt-3 flex items-center gap-2 text-xs text-orange-600">
                  <Calendar className="h-3 w-3" />
                  <span>{calculateTimeLeft(promo.endDate || promo.validUntil)}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Promotion Details Modal */}
      {showDetails && selectedPromotion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <h2 className="text-lg">Promotion Details</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              {selectedPromotion.bannerImage && (
                <img
                  src={selectedPromotion.bannerImage}
                  alt={selectedPromotion.title}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />
              )}

              <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white px-6 py-4 rounded-lg text-center mb-4">
                <div className="text-2xl">{getDiscountText(selectedPromotion)}</div>
              </div>

              <h3 className="text-xl mb-2">{selectedPromotion.title}</h3>
              <p className="text-gray-600 mb-4">{selectedPromotion.description}</p>

              <div className="space-y-3 mb-6">
                <h4 className="text-sm text-gray-700">Offer Details</h4>
                
                {selectedPromotion.minOrderAmount && (
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <span className="text-sm text-gray-600">Minimum Order</span>
                    <span className="text-sm">₹{selectedPromotion.minOrderAmount}</span>
                  </div>
                )}

                {selectedPromotion.maxDiscountAmount && (
                  <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <span className="text-sm text-gray-600">Maximum Discount</span>
                    <span className="text-sm">₹{selectedPromotion.maxDiscountAmount}</span>
                  </div>
                )}

                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                  <span className="text-sm text-gray-600">Valid Until</span>
                  <span className="text-sm">{new Date(selectedPromotion.validUntil).toLocaleDateString()}</span>
                </div>
              </div>

              {selectedPromotion.termsAndConditions && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="text-sm mb-2">Terms & Conditions</h4>
                  <p className="text-xs text-gray-600 whitespace-pre-line">
                    {selectedPromotion.termsAndConditions}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
