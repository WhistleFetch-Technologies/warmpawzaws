"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Palmtree, Star, MapPin, Calendar, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface ResortServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function ResortServicesLanding({ phone, onBack, onNavigate }: ResortServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [resorts, setResorts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadResorts();
  }, []);

  const loadResorts = async () => {
    try {
      setLoading(true);
      const endpoint = `/customer/discover-services?category=resort&roleId=pet_resort&serviceStyle=at_center`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const resortList = data.vendors || data.services || [];
      setResorts(resortList);
      
      setStats({
        activeResorts: resortList.length || 15,
        bookings: '2K+',
        rating: resortList.length > 0 
          ? Number(resortList.reduce((acc: number, r: any) => acc + Number(r.rating || 4.8), 0) / resortList.length).toFixed(1) 
          : '4.8'
      });
    } catch (error) {
      console.error('Error loading resorts:', error);
      setResorts([]);
      setStats({ activeResorts: 15, bookings: '2K+', rating: '4.8' });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckAvailability = async (resortId: string) => {
    try {
      const data = await apiClient.get<{ available?: boolean; message?: string }>(`/vendor/${resortId}/resort/availability`);
      
      if (data.available !== false) {
        if (onNavigate) {
          onNavigate('resort_booking', { vendorId: resortId });
        } else {
          toast.success('Resort is available! Proceeding to booking...');
        }
      } else {
        toast.error(data.message || 'Resort is currently unavailable');
      }
    } catch (error: any) {
      console.error('Error checking availability:', error);
      if (onNavigate) {
        onNavigate('resort_booking', { vendorId: resortId });
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
      {/* Header - Orange Background */}
      <div className="px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
           <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Pet Resorts</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.activeResorts}+</div>
               <div className="text-xs text-white/80">Resorts</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.bookings}</div>
               <div className="text-xs text-white/80">Bookings</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="flex items-center gap-1 text-2xl font-bold text-white">
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
                    <div className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">Weekend</div>
                    <div className="text-2xl font-bold text-slate-900">20% OFF</div>
                    <div className="text-slate-500 text-xs">Weekend Getaway</div>
                  </div>
                  <div className="w-10 h-10 bg-teal-50 rounded-full flex items-center justify-center">
                    <Palmtree className="w-5 h-5 text-teal-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    <span className="line-through text-slate-400 text-xs">₹4999</span>
                    <span className="ml-2 font-bold text-slate-900">₹3999</span>
                  </div>
                  <Button size="sm" className="bg-teal-600 text-white hover:bg-teal-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate?.('resort_booking')}>
                    Book Now
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Resort Packages */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Resort Packages</h2>
            <div className="space-y-3">
              {[
                { icon: '🌊', title: 'Weekend Getaway', price: '₹3,999/day', features: ['Pool access', 'Spa session'] },
                { icon: '💎', title: 'Luxury Suite', price: '₹7,999/day', features: ['Private suite', 'Gourmet meals', '24/7 care'] },
                { icon: '🎉', title: 'Birthday Package', price: '₹12,999', features: ['Party setup', 'Cake', 'Photoshoot'] }
              ].map((pkg, idx) => (
                <Card key={idx} className="p-4 hover:shadow-md transition-shadow bg-white border border-slate-100">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-xl flex items-center justify-center text-2xl">
                      {pkg.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{pkg.title}</h3>
                      <p className="text-teal-600 font-bold mb-2">{pkg.price}</p>
                      {pkg.features.map((f, i) => (
                        <div key={i} className="text-sm text-gray-600">• {f}</div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Featured Resorts */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Luxury Pet Resorts</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('resort_booking')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {resorts.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="text-4xl mb-3">🏝️</div>
                <p className="text-gray-600 mb-2">No pet resorts available yet</p>
                <p className="text-gray-500 text-sm">Check back soon for luxury pet resort experiences!</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {resorts.slice(0, 5).map((resort, index) => (
                  <div 
                    key={resort.id || index}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                    onClick={() => handleCheckAvailability(resort.id || resort.vendorId)}
                  >
                    <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                       {resort.businessName ? resort.businessName.charAt(0) : 'R'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{resort.businessName || resort.name || `Pet Resort ${index}`}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 text-orange-500 font-bold">
                          <Star className="w-3 h-3 fill-current" />
                          {resort.rating || 4.8}
                        </span>
                        <span>•</span>
                        <span>{resort.priceRange || '₹3,999/day'}</span>
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
