"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Plane, Star, Sparkles, ChevronRight, Package, Truck, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface RelocationServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function RelocationServicesLanding({ phone, onBack, onNavigate }: RelocationServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [relocationServices, setRelocationServices] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadRelocationServices();
  }, []);

  const loadRelocationServices = async () => {
    try {
      setLoading(true);
      const endpoint = `/customer/discover-services?category=relocation&roleId=pet_relocation&serviceStyle=at_center`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const serviceList = data.vendors || data.services || [];
      setRelocationServices(serviceList);
      
      setStats({
        activeServices: serviceList.length || 25,
        relocations: '500+',
        rating: serviceList.length > 0 
          ? Number(serviceList.reduce((acc: number, s: any) => acc + Number(s.rating || 4.7), 0) / serviceList.length).toFixed(1) 
          : '4.7'
      });
    } catch (error) {
      console.error('Error loading relocation services:', error);
      setRelocationServices([]);
      setStats({ activeServices: 25, relocations: '500+', rating: '4.7' });
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (service: any) => {
    onNavigate?.('relocation-booking', { vendorId: service.id || service.vendorId, serviceId: 'pet_relocation' });
  };

  const serviceTypes = [
    { icon: Plane, label: 'Air Transport', color: 'bg-blue-100 text-blue-600', desc: 'Domestic & international' },
    { icon: Truck, label: 'Road Transport', color: 'bg-green-100 text-green-600', desc: 'Long distance moves' },
    { icon: Package, label: 'Packing Service', color: 'bg-orange-100 text-orange-600', desc: 'Safe packaging' },
    { icon: Shield, label: 'Full Service', color: 'bg-purple-100 text-purple-600', desc: 'End-to-end support' }
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
          <h1 className="text-2xl font-bold text-white">Pet Relocation</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.activeServices}+</div>
               <div className="text-xs text-white/80">Services</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.relocations}</div>
               <div className="text-xs text-white/80">Relocations</div>
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
          
          {/* Service Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Relocation Options</h2>
            <div className="grid grid-cols-2 gap-3">
              {serviceTypes.map((type, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigate?.('relocation-booking', { serviceId: 'pet_relocation', serviceType: type.label })}
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

          {/* Featured Services */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Relocation Services</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('relocation-booking', { serviceId: 'pet_relocation' })}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {relocationServices.length === 0 ? (
                <Card className="p-8 text-center">
                  <Plane className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="font-semibold text-gray-900 mb-2">No Relocation Services Found</h3>
                  <p className="text-sm text-gray-500">Check back soon for pet relocation services!</p>
                </Card>
              ) : (
                relocationServices.slice(0, 5).map((service: any, index) => (
                  <div 
                    key={service.id || service.vendorId || index}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                    onClick={() => handleServiceSelect(service)}
                  >
                    <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                       {service.vendorName ? service.vendorName.charAt(0) : service.businessName ? service.businessName.charAt(0) : 'R'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 truncate">{service.vendorName || service.businessName || `Relocation Service ${index}`}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <span className="flex items-center gap-1 text-orange-500 font-bold">
                          <Star className="w-3 h-3 fill-current" />
                          {service.rating || 4.7}
                        </span>
                        <span>•</span>
                        <span>{service.serviceName || 'Full Service'}</span>
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
