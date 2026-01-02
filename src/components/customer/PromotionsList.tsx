import { useState, useEffect } from 'react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { Tag, Clock, ChevronRight, Percent, DollarSign, Gift, Truck, Zap } from 'lucide-react';
import { toast } from 'sonner';

interface Promotion {
  id: string;
  name?: string;
  title?: string; // Frontend expects 'title'
  description?: string;
  type?: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
  value?: number;
  discountPercentage?: number; // New format from backend
  discountAmount?: number; // New format from backend
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  validUntil?: string;
  endDate?: string; // Backend uses 'endDate'
  bannerImage?: string;
  termsAndConditions?: string;
  priority?: number;
  code?: string; // Sometimes promotions have a public code
}

interface PromotionsListProps {
  category?: string;
  applicableTo?: string; // 'all' | 'new_users' | 'categories' | 'services' | 'vendors'
  onSelectPromotion?: (promotion: Promotion) => void;
}

export function PromotionsList({ category, applicableTo, onSelectPromotion }: PromotionsListProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPromotions();
  }, [category, applicableTo]);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (category) queryParams.append('category', category);
      if (applicableTo) queryParams.append('applicableTo', applicableTo);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/promotions/active?${queryParams.toString()}`,
        {
          headers: {
            'apikey': publicAnonKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setPromotions(data.promotions || []);
        }
      }
    } catch (error) {
      console.error('Error fetching promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'percentage': return 'text-[#4CAF50] bg-[#4CAF50]/10';
      case 'fixed': return 'text-[#2196F3] bg-[#2196F3]/10';
      case 'free_shipping': return 'text-[#FF9800] bg-[#FF9800]/10';
      case 'buy_x_get_y': return 'text-[#9C27B0] bg-[#9C27B0]/10';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'percentage': return Percent;
      case 'fixed': return DollarSign;
      case 'free_shipping': return Truck;
      case 'buy_x_get_y': return Gift;
      default: return Tag;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm animate-pulse h-32 border border-gray-100"></div>
        ))}
      </div>
    );
  }

  if (promotions.length === 0) {
    return null; // Don't show anything if no promotions
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 px-1">
        <Zap className="w-5 h-5 text-[#FF8C42] fill-current" />
        Active Offers
      </h3>
      
      <div className="grid grid-cols-1 gap-4">
        {promotions.map((promo) => {
          // Support both old and new formats
          const promoType = promo.type || (promo.discountPercentage ? 'percentage' : 'fixed');
          const promoValue = promo.value || promo.discountPercentage || promo.discountAmount || 0;
          const promoTitle = promo.title || promo.name || 'Special Offer';
          const promoEndDate = promo.endDate || promo.validUntil;
          
          const Icon = getTypeIcon(promoType);
          
          return (
            <div 
              key={promo.id}
              onClick={() => onSelectPromotion?.(promo)}
              className="group relative bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex">
                {/* Left Side - Value */}
                <div className={`w-24 flex flex-col items-center justify-center p-2 ${getTypeColor(promoType)} border-r border-gray-100 border-dashed`}>
                  <div className="text-2xl font-bold">
                    {promoType === 'percentage' ? `${promoValue}%` : `₹${promoValue}`}
                  </div>
                  <div className="text-xs font-medium uppercase tracking-wider mt-1 text-center opacity-80">
                    {promoType === 'free_shipping' ? 'Free Ship' : 'OFF'}
                  </div>
                </div>
                
                {/* Right Side - Content */}
                <div className="flex-1 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-gray-900 line-clamp-1">{promoTitle}</h4>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{promo.description || ''}</p>
                    </div>
                    {promo.code && (
                      <div className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-mono border border-gray-200 border-dashed">
                        {promo.code}
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                    {promoEndDate && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Expires {new Date(promoEndDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[#FF8C42] font-medium group-hover:translate-x-1 transition-transform">
                      View Details <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
