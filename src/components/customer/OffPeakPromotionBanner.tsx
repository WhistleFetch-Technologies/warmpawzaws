import { useState, useEffect } from 'react';
import { Clock, Tag, TrendingDown, X } from 'lucide-react';
import { Card } from '../ui/card';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
// Brand color: #FF8C42

interface OffPeakPromotionBannerProps {
  serviceType?: string;
  onApplyPromotion?: (promotion: any) => void;
}

export function OffPeakPromotionBanner({ serviceType = 'grooming', onApplyPromotion }: OffPeakPromotionBannerProps) {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchPromotions();
    // Refresh every minute to check for new promotions
    const interval = setInterval(fetchPromotions, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchPromotions = async () => {
    try {
      const response = await fetch(`${API_BASE}/grooming/promotions`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.promotions.length > 0) {
          setPromotions(data.promotions);
          setDismissed(false); // Show banner when new promotions appear
        }
      }
    } catch (error) {
      console.error('Failed to fetch promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || promotions.length === 0 || dismissed) {
    return null;
  }

  const activePromotion = promotions[0]; // Show the first/best promotion

  return (
    <Card className="bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 border-amber-200 p-4 relative overflow-hidden mb-4">
      {/* Close button */}
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/50 transition-colors z-10"
      >
        <X className="w-4 h-4 text-gray-500" />
      </button>

      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center flex-shrink-0">
          <TrendingDown className="w-6 h-6 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Tag className="w-4 h-4 text-amber-600" />
            <h3 className="font-bold text-gray-900">{activePromotion.title}</h3>
          </div>
          
          <p className="text-sm text-gray-700 mb-2">
            {activePromotion.description}
          </p>

          {/* Discount Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <span className="font-bold text-lg">{activePromotion.discount}% OFF</span>
            </div>

            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Clock className="w-3.5 h-3.5" />
              <span>Valid until <strong>{activePromotion.validUntil}</strong></span>
            </div>
          </div>

          {/* Apply button */}
          {onApplyPromotion && (
            <button
              onClick={() => onApplyPromotion(activePromotion)}
              className="mt-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow-md"
            >
              Book Now & Save {activePromotion.discount}%
            </button>
          )}
        </div>
      </div>

      {/* Decorative elements */}
      <div className="absolute -bottom-2 -right-2 text-amber-200 opacity-20 pointer-events-none">
        <Tag className="w-20 h-20" />
      </div>

      {/* Pulse animation for urgency */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600 animate-pulse"></div>
    </Card>
  );
}
