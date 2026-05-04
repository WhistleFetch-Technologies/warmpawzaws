"use client";

import { useState, useEffect } from 'react';
import { Heart, Moon, Star, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface SunsetServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function SunsetServiceRouter({ phone, onBack, onViewBooking, onNavigate }: SunsetServiceRouterProps) {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const endpoint = `/customer/discover-services?category=sunset&roleId=pet_sunset_services&serviceStyle=at_center`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const providerList = data.vendors || data.services || [];
      setProviders(providerList);
      
      const rated = providerList.filter((p: any) => {
        const rc = Number(p.reviewCount ?? p.reviews_count ?? p.totalReviews ?? 0) || 0;
        const raw = p.rating != null ? Number(p.rating) : NaN;
        return rc > 0 && Number.isFinite(raw) && raw > 0;
      });
      setStats({
        providers: providerList.length || 15,
        services: '1K+',
        rating:
          rated.length > 0
            ? (rated.reduce((acc: number, p: any) => acc + Number(p.rating), 0) / rated.length).toFixed(1)
            : '—',
      });
    } catch (error) {
      console.error('Error loading sunset service providers:', error);
      setProviders([]);
      setStats({ providers: 15, services: '1K+', rating: '—' });
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider: any) => {
    onNavigate?.('sunset-booking', { vendorId: provider.id || provider.vendorId, serviceType: 'sunset' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <>
      {/* Header is provided by renderScreenWithLayout wrapper (StandardizedHeader) */}
      
      {/* Info Banner - Moved below header */}
      <div className="px-4 pt-4 pb-2 bg-white">
        <div className="bg-orange-50 rounded-xl p-3 border border-orange-200">
          <p className="text-sm text-orange-900 leading-relaxed">
            We understand this is a difficult time. Our compassionate team provides dignified,
            peaceful end-of-life care for your beloved pet.
          </p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Service Types */}
        <div>
          <h2 className="text-lg font-bold text-slate-900 mb-4">Services Available</h2>
          <div className="space-y-3">
            {[
              { icon: '💐', title: 'Cremation Services', desc: 'Respectful and dignified cremation', price: '₹2,999 onwards' },
              { icon: '🕊️', title: 'Memorial Services', desc: 'Honoring your pet\'s memory', price: '₹999 onwards' },
              { icon: '📿', title: 'Grief Counseling', desc: 'Support during difficult times', price: '₹499 onwards' },
              { icon: '🌺', title: 'Memorial Products', desc: 'Keepsakes and remembrance items', price: '₹299 onwards' }
            ].map((service, idx) => (
              <Card key={idx} className="p-4 hover:shadow-md transition-shadow bg-white border border-slate-100">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center text-2xl">
                    {service.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{service.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{service.desc}</p>
                    <p className="text-orange-500 font-semibold mt-2">{service.price}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Featured Providers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Service Providers</h2>
            <button 
              className="text-sm text-orange-500 flex items-center gap-1 font-medium"
              onClick={() => onNavigate?.('sunset-booking', { serviceType: 'sunset' })}
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {providers.length === 0 ? (
            <Card className="p-8 text-center">
              <Moon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Service Providers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {providers.slice(0, 5).map((provider, index) => (
                <div 
                  key={provider.id || provider.vendorId || index}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                  onClick={() => handleProviderSelect(provider)}
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                     {provider.businessName ? provider.businessName.charAt(0) : 'S'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{provider.businessName || provider.name || `Sunset Services ${index}`}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                      {(() => {
                        const rc = Number(provider.reviewCount ?? provider.reviews_count ?? provider.totalReviews ?? 0) || 0;
                        const raw = provider.rating != null ? Number(provider.rating) : NaN;
                        const ok = rc > 0 && Number.isFinite(raw) && raw > 0;
                        return ok ? (
                      <>
                      <span className="flex items-center gap-1 text-orange-500 font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        {raw.toFixed(1)}
                      </span>
                      <span>•</span>
                      </>
                        ) : (
                      <span className="text-slate-400">No reviews yet</span>
                        );
                      })()}
                      <span>24/7 Available</span>
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

        {/* Help & Support */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl">
              💙
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 mb-1">Need Immediate Assistance?</h4>
              <p className="text-sm text-gray-600 mb-3">Our compassionate team is available 24/7 to help during this difficult time.</p>
              <Button 
                variant="outline" 
                className="border-orange-300 text-orange-600 hover:bg-orange-50"
                onClick={() => {
                  if (onNavigate) onNavigate('sunset-booking', { serviceType: 'sunset', urgent: true });
                }}
              >
                Get Help Now
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
