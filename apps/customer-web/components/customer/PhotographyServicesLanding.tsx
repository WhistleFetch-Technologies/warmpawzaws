"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Camera, Star, Sparkles, ChevronRight, Video, Users, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { averageStarDisplayFromNumbers, formatRatingNumberOrDash } from '@/lib/rating-display';
import { toast } from 'sonner';

interface PhotographyServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function PhotographyServicesLanding({ phone, onBack, onNavigate }: PhotographyServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [photographers, setPhotographers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadPhotographers();
  }, []);

  const loadPhotographers = async () => {
    try {
      setLoading(true);
      const endpoint = `/customer/discover-services?category=photography&roleId=pet_photographer&serviceStyle=at_center`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const photographerList = data.vendors || data.services || [];
      setPhotographers(photographerList);
      
      setStats({
        activePhotographers: photographerList.length || 85,
        sessions: '2K+',
      });
    } catch (error) {
      console.error('Error loading photographers:', error);
      setPhotographers([]);
      setStats({ activePhotographers: 85, sessions: '2K+' });
    } finally {
      setLoading(false);
    }
  };

  const handlePhotographerSelect = (photographer: any) => {
    onNavigate?.('photography-booking', { vendorId: photographer.id || photographer.vendorId, serviceId: 'pet_photographer' });
  };

  const photographyTypes = [
    { icon: Camera, label: 'Portrait Sessions', color: 'bg-purple-100 text-purple-600', desc: 'Professional portraits' },
    { icon: Video, label: 'Video Shoots', color: 'bg-blue-100 text-blue-600', desc: 'Video content' },
    { icon: Users, label: 'Event Photography', color: 'bg-pink-100 text-pink-600', desc: 'Special events' },
    { icon: ImageIcon, label: 'Pet Showcases', color: 'bg-orange-100 text-orange-600', desc: 'Showcase photos' }
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
      <div className="px-6 cw-header-safe-top pb-6">
        <div className="flex items-center gap-4 mb-6">
           <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Pet Photography</h1>
        </div>

      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        <div className="space-y-8">
          
          {/* Photography Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Photography Services</h2>
            <div className="grid grid-cols-2 gap-3">
              {photographyTypes.map((type, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigate?.('photography-booking', { serviceId: 'pet_photographer', serviceType: type.label })}
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

          {/* Featured Photographers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Photographers</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('photography-booking', { serviceId: 'pet_photographer' })}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {photographers.length === 0 ? (
                <Card className="p-8 text-center">
                  <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">No Photographers Found</h3>
                  <p className="text-sm text-gray-500">Check back soon for pet photography services!</p>
                </Card>
              ) : (
                photographers.slice(0, 5).map((photographer: any, index) => (
                  <div 
                    key={index}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                    onClick={() => handlePhotographerSelect(photographer)}
                  >
                    <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                       {photographer.businessName ? photographer.businessName.charAt(0) : photographer.name ? photographer.name.charAt(0) : 'P'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{photographer.businessName || photographer.name || `Photographer ${index}`}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                        {(() => {
                          const rc = Number(photographer.reviewCount ?? photographer.reviews_count ?? photographer.totalReviews ?? 0) || 0;
                          const raw = photographer.rating != null ? Number(photographer.rating) : NaN;
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
                        <span>Professional</span>
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
