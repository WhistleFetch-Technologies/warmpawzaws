"use client";

import { useState, useEffect } from 'react';
import { Home as HomeIcon, Star, MapPin, Calendar, Sparkles, ChevronRight, Camera, Moon, Sun, RefreshCw, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PromotionBanner } from './shared/PromotionBanner';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';

interface BoardingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function BoardingServiceRouter({ phone, onBack, onViewBooking, onNavigate }: BoardingServiceRouterProps) {
  const [loading, setLoading] = useState(true);
  const [boardingFacilities, setBoardingFacilities] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [previousFacility, setPreviousFacility] = useState<any>(null);

  useEffect(() => {
    loadBoardingFacilities();
    loadPreviousFacility();
  }, []);

  const loadPreviousFacility = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=boarding`).catch(() => null);
      if (response?.provider) {
        setPreviousFacility({ id: response.provider.id, name: response.provider.businessName || response.provider.name, photo: response.provider.photo, rating: response.provider.rating || 4.8, lastVisit: response.provider.lastVisit });
      } else {
        const pkgRes = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=boarding`).catch(() => null);
        if (pkgRes?.packages?.length > 0) {
          const pkg = pkgRes.packages[0];
          if (pkg.vendorId && pkg.vendorName) setPreviousFacility({ id: pkg.vendorId, name: pkg.vendorName, photo: null, rating: 4.8, lastVisit: pkg.lastUsed || '3 weeks ago' });
        }
      }
    } catch { /* ignore */ }
  };

  const loadBoardingFacilities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_boarding'
      });

      // Use the correct endpoint for discovering services
      const endpoint = `/customer/discover-services?category=boarding&roleId=pet_boarding`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const facilityList = data.vendors || data.services || [];
      setBoardingFacilities(facilityList);
      
      // Set stats based on data
      setStats({
        activeFacilities: facilityList.length || 35,
        guests: '5K+',
        rating: facilityList.length > 0 
          ? Number(facilityList.reduce((acc: number, f: any) => acc + Number(f.rating || 4.6), 0) / facilityList.length).toFixed(1) 
          : '4.6'
      });
    } catch (error) {
      console.error('Error loading boarding facilities:', error);
      setBoardingFacilities([]);
      setStats({ activeFacilities: 35, guests: '5K+', rating: '4.6' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = async (facilityId: string) => {
    try {
      const data = await apiClient.get<{ available?: boolean; message?: string }>(`/vendor/${facilityId}/boarding/availability`);
      
      if (data.available !== false) {
        if (onNavigate) {
          // ✅ FIX: Use boarding-specific booking flow instead of generic create-booking
          onNavigate('boarding-booking', { vendorId: facilityId, serviceType: 'boarding' });
        } else {
          toast.success('Facility is available! Proceeding to booking...');
        }
      } else {
        toast.error(data.message || 'Facility is currently unavailable');
      }
    } catch (error: any) {
      console.error('Error checking availability:', error);
      // Proceed anyway - optimistic flow
      if (onNavigate) {
        // ✅ FIX: Use boarding-specific booking flow instead of generic create-booking
        onNavigate('boarding-booking', { vendorId: facilityId, serviceType: 'boarding' });
      } else {
        toast.info('Proceeding to booking...');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const boardingStats = stats
    ? [
        { value: `${stats.activeFacilities}+`, label: 'Facilities' },
        { value: stats.guests, label: 'Happy Pets' },
        { value: stats.rating, label: 'Rating', icon: <Star className="w-4 h-4 fill-current" /> },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <ServiceDashboardHeader
        serviceName="Pet Boarding"
        serviceSubtitle="Safe & comfortable pet stay"
        serviceIcon={Building2}
        iconColor="text-white"
        stats={boardingStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
      />
      <div className="flex-1 overflow-y-auto bg-white">
      <div className="px-4 pt-4 bg-white">
        <div className="space-y-8">
          
          {/* Promotion Banner */}
          <PromotionBanner service="boarding" maxPromotions={3} onNavigate={onNavigate} />

          {/* Phase 1: Book again with previous facility */}
          {previousFacility && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-slate-900">Book again</h2>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-4">
                <div className="flex items-center gap-4">
                  {previousFacility.photo ? (
                    <img src={previousFacility.photo} alt={previousFacility.name} className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200" />
                  ) : (
                    <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                      {previousFacility.name?.charAt(0) || 'B'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{previousFacility.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <Star className="w-4 h-4 fill-orange-500" /> {previousFacility.rating}
                      <span>•</span>
                      <span>Last stay: {previousFacility.lastVisit || '3 weeks ago'}</span>
                    </div>
                  </div>
                  <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white" onClick={() => handleCheckAvailability(previousFacility.id)}>
                    Book Now
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Boarding Options */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Boarding Options</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onNavigate?.('boarding_overnight')}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group relative overflow-hidden"
              >
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Moon className="w-5 h-5 text-slate-600" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mb-0.5">Overnight</h3>
                <p className="text-xs text-slate-500">Extended stays</p>
                <span className="absolute top-3 right-3 px-2 py-0.5 bg-orange-100 text-orange-600 text-[9px] font-bold rounded-full uppercase tracking-wide">
                  Popular
                </span>
              </button>

              <button
                onClick={() => onNavigate?.('daycare')}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group relative overflow-hidden"
              >
                 <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Sun className="w-5 h-5 text-slate-600" />
                </div>
                <h3 className="font-semibold text-slate-900 text-sm mb-0.5">Daycare</h3>
                <p className="text-xs text-slate-500">Daily care</p>
              </button>
            </div>
          </div>

          {/* Featured Facilities */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Featured Stays</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('boarding_facility')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {boardingFacilities.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">🏠</div>
                  <p className="text-gray-600 mb-2">No boarding facilities available yet</p>
                  <p className="text-gray-500 text-sm">Check back soon for boarding options!</p>
                </Card>
              ) : (
                (boardingFacilities.slice(0, 5).map((facility: any, index) => (
                  <div 
                    key={facility.id || index}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                    onClick={() => handleCheckAvailability(facility.id || facility.vendorId)}
                  >
                    <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                       {facility.businessName ? facility.businessName.charAt(0) : 'B'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{facility.businessName || facility.name || `Pet Resort ${index}`}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 text-orange-500 font-bold">
                          <Star className="w-3 h-3 fill-current" />
                          {facility.rating || 4.6}
                        </span>
                        <span>•</span>
                        <span>{facility.distance ? `${Number(facility.distance).toFixed(1)} km` : 'Nearby'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="font-bold text-slate-900">₹{facility.priceRange?.replace(/[^0-9]/g, '') || facility.basePrice || 800}</div>
                       <div className="text-[10px] text-slate-400">/night</div>
                    </div>
                  </div>
                )))
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
