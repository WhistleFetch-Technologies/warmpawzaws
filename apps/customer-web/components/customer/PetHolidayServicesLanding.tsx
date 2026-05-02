"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Palmtree, Star, Sparkles, ChevronRight, Hotel, Camera, Utensils } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface PetHolidayServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function PetHolidayServicesLanding({ phone, onBack, onNavigate }: PetHolidayServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [holidayPackages, setHolidayPackages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadHolidayPackages();
  }, []);

  const loadHolidayPackages = async () => {
    try {
      setLoading(true);
      const endpoint = `/customer/discover-services?category=holiday&roleId=pet_holiday&serviceStyle=at_center`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[]; packages?: any[] }>(endpoint);
      const packageList = data.vendors || data.services || data.packages || [];
      setHolidayPackages(packageList);
      
      const rated = packageList.filter((p: any) => {
        const rc = Number(p.reviewCount ?? p.reviews_count ?? p.totalReviews ?? 0) || 0;
        const raw = p.rating != null ? Number(p.rating) : NaN;
        return rc > 0 && Number.isFinite(raw) && raw > 0;
      });
      setStats({
        activePackages: packageList.length || 30,
        bookings: '800+',
        rating:
          rated.length > 0
            ? (rated.reduce((acc: number, p: any) => acc + Number(p.rating), 0) / rated.length).toFixed(1)
            : '—',
      });
    } catch (error) {
      console.error('Error loading holiday packages:', error);
      setHolidayPackages([]);
      setStats({ activePackages: 30, bookings: '800+', rating: '—' });
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelect = (pkg: any) => {
    onNavigate?.('create-booking', { vendorId: pkg.id || pkg.vendorId, serviceId: 'pet_holiday' });
  };

  const packageTypes = [
    { icon: Palmtree, label: 'Beach Vacations', color: 'bg-cyan-100 text-cyan-600', desc: 'Sunny beach getaways' },
    { icon: Hotel, label: 'Hill Stations', color: 'bg-green-100 text-green-600', desc: 'Mountain retreats' },
    { icon: Camera, label: 'Adventure Tours', color: 'bg-orange-100 text-orange-600', desc: 'Activity-packed trips' },
    { icon: Utensils, label: 'Luxury Stays', color: 'bg-purple-100 text-purple-600', desc: 'Premium experiences' }
  ];

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
          <h1 className="text-2xl font-bold text-white">Pet Holidays</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.activePackages}+</div>
               <div className="text-xs text-white/80">Packages</div>
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
                    <div className="bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">Summer</div>
                    <div className="text-2xl font-bold text-slate-900">25% OFF</div>
                    <div className="text-slate-500 text-xs">Beach Vacations</div>
                  </div>
                  <div className="w-10 h-10 bg-cyan-50 rounded-full flex items-center justify-center">
                    <Palmtree className="w-5 h-5 text-cyan-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    <span className="line-through text-slate-400 text-xs">₹19,999</span>
                    <span className="ml-2 font-bold text-slate-900">₹14,999</span>
                  </div>
                  <Button size="sm" className="bg-cyan-600 text-white hover:bg-cyan-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate?.('create-booking', { serviceId: 'pet_holiday' })}>
                    Book Now
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Package Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Holiday Types</h2>
            <div className="grid grid-cols-2 gap-3">
              {packageTypes.map((type, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigate?.('create-booking', { serviceId: 'pet_holiday', serviceType: type.label })}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group relative overflow-hidden"
                >
                  <div className={`w-10 h-10 rounded-xl ${type.color.split(' ')[0]} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <type.icon className={`w-5 h-5 ${type.color.split(' ')[1]}`} />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{type.label}</h3>
                  <p className="text-xs text-slate-500">{type.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Featured Packages */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Featured Holiday Packages</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('create-booking', { serviceId: 'pet_holiday' })}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {holidayPackages.length === 0 ? (
                <Card className="p-8 text-center">
                  <Palmtree className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">No Holiday Packages Found</h3>
                  <p className="text-sm text-gray-500">Check back soon for pet holiday packages!</p>
                </Card>
              ) : (
                holidayPackages.slice(0, 5).map((pkg: any, index) => (
                  <div 
                    key={pkg.id || pkg.vendorId || index}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                    onClick={() => handlePackageSelect(pkg)}
                  >
                    <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                       {pkg.vendorName ? pkg.vendorName.charAt(0) : pkg.packageName ? pkg.packageName.charAt(0) : 'H'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{pkg.vendorName || pkg.packageName || pkg.businessName || `Holiday Package ${index}`}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                        {(() => {
                          const rc = Number(pkg.reviewCount ?? pkg.reviews_count ?? pkg.totalReviews ?? 0) || 0;
                          const raw = pkg.rating != null ? Number(pkg.rating) : NaN;
                          const ok = rc > 0 && Number.isFinite(raw) && raw > 0;
                          return ok ? (
                        <span className="flex items-center gap-1 text-orange-500 font-bold">
                          <Star className="w-3 h-3 fill-current" />
                          {raw.toFixed(1)}
                        </span>
                          ) : (
                        <span className="text-slate-400">No reviews yet</span>
                          );
                        })()}
                        {pkg.price && (
                          <>
                            <span>•</span>
                            <span>From ₹{pkg.price.toLocaleString()}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                       <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
