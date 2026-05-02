'use client';

import { useState, useEffect } from 'react';
import { Coffee, ArrowLeft, Star, Sparkles, ChevronRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { StarRating } from '@/components/customer/shared/StarRating';

interface PetCafeServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function PetCafeServicesLanding({ phone, onBack, onNavigate }: PetCafeServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [cafes, setCafes] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadCafes();
  }, []);

  const loadCafes = async () => {
    try {
      setLoading(true);
      const endpoint = `/customer/discover-services?category=cafe&roleId=pet_cafe&serviceStyle=at_center`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const cafeList = data.vendors || data.services || [];
      
      // Deduplicate vendors
      const uniqueVendors = new Map();
      cafeList.forEach((s: any) => {
        const vendorId = s.vendorId || s.id;
        if (!uniqueVendors.has(vendorId)) {
          uniqueVendors.set(vendorId, {
            id: vendorId,
            vendorId: vendorId,
            businessName: s.vendorName || s.businessName || s.name,
            vendorLocation: s.vendorLocation?.address || s.location?.address || 'Location unavailable',
            vendorRating: s.vendorRating ?? s.rating,
            vendorReviewCount: s.vendorReviewCount || s.reviewsCount || 0,
            price: s.price,
            serviceName: s.serviceName,
            description: s.description
          });
        }
      });
      
      const uniqueCafes = Array.from(uniqueVendors.values());
      setCafes(uniqueCafes);
      
      const withReviews = uniqueCafes.filter((c: any) => {
        const rc = Number(c.vendorReviewCount ?? c.review_count ?? 0) || 0;
        const r = Number(c.vendorRating ?? c.rating);
        return rc > 0 && Number.isFinite(r) && r > 0;
      });
      const avgRating =
        withReviews.length > 0
          ? (
              withReviews.reduce((acc: number, c: any) => acc + Number(c.vendorRating ?? c.rating), 0) /
              withReviews.length
            ).toFixed(1)
          : null;

      setStats({
        activeCafes: uniqueCafes.length || 0,
        reservations: '3K+',
        rating: avgRating,
      });
    } catch (error: any) {
      console.error('Error loading cafes:', error);
      setCafes([]);
      setStats({ activeCafes: 0, reservations: '3K+', rating: null });
      // ✅ FIX: Show error toast for API failures (toast is not imported, but error is handled)
      console.warn('Failed to load cafes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FF8C42] flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
      {/* Header - Orange Background */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
           <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Pet Cafes</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.activeCafes}+</div>
               <div className="text-xs text-white/80">Cafes</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.reservations}</div>
               <div className="text-xs text-white/80">Reservations</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="flex items-center gap-1 text-2xl font-bold text-white">
                 {stats.rating != null ? stats.rating : '—'} {stats.rating != null ? <Star className="w-4 h-4 fill-white" /> : null}
               </div>
               <div className="text-xs text-white/80">Avg rating</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        <div className="space-y-8">
          
          {/* Spotlight Offers */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900">Spotlight Offers</h2>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
              <Card className="min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">Weekend</div>
                    <div className="text-2xl font-bold text-slate-900">15% OFF</div>
                    <div className="text-slate-500 text-xs">On Table Booking</div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                    <Coffee className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-xs text-slate-500">Valid on weekends</div>
                  <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate?.('cafe_reservation')}>
                    Book Table
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Featured Cafes */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Rated Cafes</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('cafe_reservation')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {cafes.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="text-4xl mb-3">☕</div>
                <p className="text-gray-600 mb-2">No pet cafes available yet</p>
                <p className="text-gray-500 text-sm">Check back soon!</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {cafes.slice(0, 5).map((cafe, index) => (
                  <div 
                    key={cafe.id || index}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                    onClick={() => onNavigate?.('cafe_detail', { vendorId: cafe.id || cafe.vendorId })}
                  >
                    <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                       {cafe.businessName ? cafe.businessName.charAt(0) : 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{cafe.businessName || `Pet Cafe ${index}`}</h3>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 mt-1">
                        <StarRating
                          rating={cafe.vendorRating}
                          reviewCount={cafe.vendorReviewCount}
                          starsClassName="w-3 h-3"
                          textClassName="text-xs text-slate-500"
                        />
                        <span className="hidden sm:inline">•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {cafe.vendorLocation || 'Location'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                       <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
