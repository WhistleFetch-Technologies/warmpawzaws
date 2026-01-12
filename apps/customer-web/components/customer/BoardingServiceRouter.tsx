"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Home as HomeIcon, Star, MapPin, Calendar, Sparkles, ChevronRight, Camera, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

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

  useEffect(() => {
    loadBoardingFacilities();
  }, []);

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
          ? (facilityList.reduce((acc: number, f: any) => acc + (f.rating || 4.6), 0) / facilityList.length).toFixed(1) 
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
          onNavigate('create-booking', { vendorId: facilityId, serviceType: 'boarding' });
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
        onNavigate('create-booking', { vendorId: facilityId, serviceType: 'boarding' });
      } else {
        toast.info('Proceeding to booking...');
      }
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
      {/* HEADER with Orange gradient (Boarding service color - home/comfort theme) */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-white text-xl font-bold">Pet Boarding</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="font-medium text-white">{stats.activeFacilities}+</div>
               <div className="text-xs text-white/80">Facilities</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="font-medium text-white">{stats.guests}</div>
               <div className="text-xs text-white/80">Happy Pets</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="flex items-center gap-1 font-medium text-white">
                 {stats.rating} <Star className="w-4 h-4 fill-white" />
               </div>
               <div className="text-xs text-white/80">Rating</div>
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
                    <div className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">First Time</div>
                    <div className="text-2xl font-bold text-slate-900">30% OFF</div>
                    <div className="text-slate-500 text-xs">First Boarding Stay</div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                    <HomeIcon className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    <span className="line-through text-slate-400 text-xs">₹1200</span>
                    <span className="ml-2 font-bold text-slate-900">₹840</span>
                  </div>
                  <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate?.('boarding_facility')}>
                    Book Now
                  </Button>
                </div>
              </Card>

              <Card className="min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">Extended</div>
                    <div className="text-2xl font-bold text-slate-900">FREE CCTV</div>
                    <div className="text-slate-500 text-xs">On 5+ days booking</div>
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <Camera className="w-5 h-5 text-slate-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-xs text-slate-500">Includes premium care</div>
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate?.('boarding_facility')}>
                    Book
                  </Button>
                </div>
              </Card>
            </div>
          </div>

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
                        <span>{facility.distance ? `${facility.distance.toFixed(1)} km` : 'Nearby'}</span>
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
  );
}
