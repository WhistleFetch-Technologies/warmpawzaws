"use client";

import { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { Scissors, Building2, Home as HomeIcon, Star, MapPin, Sparkles, ChevronRight, RefreshCw, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { GROOMING_NEEDS } from './ProblemGridSection';
import { PromotionBanner } from './shared/PromotionBanner';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { FeaturedProviderCard } from './shared/FeaturedProviderCard';
import {
  normalizeAndDedupeDiscoveryProviders,
  type FeaturedProvider,
} from '@/lib/featured-provider';
import { problemIconTextColorToBgClass } from '@/lib/problem-grid-icon-bg';

function DynamicProblemIcon({ iconName, iconColor }: { iconName?: string; iconColor?: string }) {
  if (!iconName || !(LucideIcons as any)[iconName]) {
    return <Scissors className="w-6 h-6 text-gray-500" />;
  }
  const Icon = (LucideIcons as any)[iconName];
  return <Icon className={`w-6 h-6 ${iconColor || 'text-gray-600'}`} />;
}

interface GroomingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

const GROOMING_ROLE_IDS = ['groomer', 'groomer_solo', 'groomer_center', 'pet_groomer'];

export function GroomingServiceRouter({ phone, onBack, onViewBooking, onNavigate }: GroomingServiceRouterProps) {
  const [loading, setLoading] = useState(true);
  const [featuredGroomers, setFeaturedGroomers] = useState<FeaturedProvider[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [previousGroomer, setPreviousGroomer] = useState<any>(null);
  const [groomingNeeds, setGroomingNeeds] = useState<any[]>([]);

  useEffect(() => {
    loadGroomingData();
    loadPreviousGroomer();
    loadGroomingNeeds();
  }, []);

  const loadGroomingNeeds = async () => {
    try {
      for (const roleId of GROOMING_ROLE_IDS) {
        const res = await apiClient.get<{ success?: boolean; problems?: any[] }>(`/public/problem-grid/${roleId}`);
        if (res?.success && Array.isArray(res.problems) && res.problems.length > 0) {
          const withViewAll = [
            ...res.problems.map((p: any) => {
              const iconColor = p.iconColor ?? p.icon_color;
              return {
                id: p.id || p.problemId,
                name: p.displayName || p.name,
                icon: <DynamicProblemIcon iconName={p.iconName} iconColor={iconColor} />,
                iconBg: problemIconTextColorToBgClass(iconColor),
              };
            }),
            { id: 'view_all', name: 'View All', icon: <Plus className="w-6 h-6 text-orange-600" /> },
          ];
          setGroomingNeeds(withViewAll);
          return;
        }
      }
    } catch (_) {
      // Keep groomingNeeds empty so we use GROOMING_NEEDS fallback
    }
  };

  const loadGroomingData = async () => {
    try {
      setLoading(true);

      // Get customer location for distance/radius (same as VetServiceRouter)
      let latitude: string | undefined;
      let longitude: string | undefined;
      try {
        const profileRes = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
        const profile = profileRes?.profile || profileRes;
        if (profile?.latitude != null && profile?.longitude != null) {
          latitude = String(profile.latitude);
          longitude = String(profile.longitude);
        }
      } catch (_) { /* ignore */ }
      if (latitude == null && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 300000 });
          });
          latitude = String(pos.coords.latitude);
          longitude = String(pos.coords.longitude);
        } catch (_) { /* ignore */ }
      }
      const locationParams = latitude && longitude ? `&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}` : '';

      // ✅ Align with Vet: discover by category (service discovery respects category/role from dashboard tiles)
      let groomerServices: any[] = [];
      
      // Try 1: discover-services by category (same pattern as VetServiceRouter)
      try {
        const endpoint = `/customer/discover-services?category=grooming&serviceStyle=at_center${locationParams}`;
        const data = await apiClient.get<any>(endpoint);
        console.log('🔵 [GroomingServiceRouter] discover-services response:', data);
        
        if (Array.isArray(data)) {
          groomerServices = data;
        } else if (data?.vendors && Array.isArray(data.vendors)) {
          groomerServices = data.vendors;
        } else if (data?.providers && Array.isArray(data.providers)) {
          groomerServices = data.providers;
        } else if (data?.services && Array.isArray(data.services)) {
          groomerServices = data.services;
        } else if (data?.results && Array.isArray(data.results)) {
          groomerServices = data.results;
        } else if (data?.data && Array.isArray(data.data)) {
          groomerServices = data.data;
        }
      } catch (err) {
        console.warn('⚠️ [GroomingServiceRouter] discover-services failed, trying alternatives:', err);
      }
      
      // Try 2: services/by-style (at_center = grooming centre)
      if (groomerServices.length === 0) {
        try {
          const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
          const altRes = await apiClient.get<any>(`/customer/services/by-style?style=at_center&category=grooming${locationParams}${phoneParam}`);
          const altData = (altRes as any)?.providers ?? (altRes as any)?.vendors ?? altRes;
          if (Array.isArray(altData)) groomerServices = altData;
          else if (altData?.services) groomerServices = altData.services;
        } catch (err) {
          console.warn('⚠️ [GroomingServiceRouter] services/by-style failed:', err);
        }
      }
      
      // Try 3: Fallback to /customer/vendors/search (GET /customer/vendors does not exist)
      if (groomerServices.length === 0) {
        try {
          const vendorsData = await apiClient.get<any>(`/customer/vendors/search?roleId=pet_groomer&limit=50${locationParams}`);
          if (Array.isArray(vendorsData)) groomerServices = vendorsData;
          else if (vendorsData?.vendors) groomerServices = vendorsData.vendors;
          else if (vendorsData?.results) groomerServices = vendorsData.results;
        } catch (err) {
          console.warn('⚠️ [GroomingServiceRouter] vendors/search fallback failed:', err);
        }
      }
      
      console.log('🔵 [GroomingServiceRouter] Final groomerServices length:', groomerServices.length);

      const allGroomers = normalizeAndDedupeDiscoveryProviders(
        groomerServices,
        'grooming'
      );
      console.log('🔵 [GroomingServiceRouter] Found vendors:', allGroomers.length);
      setFeaturedGroomers(allGroomers.slice(0, 5));
      
      setStats({
        activeGroomers: allGroomers.length,
        sessions: allGroomers.length > 0 ? `${Math.max(allGroomers.length * 25, 100)}+` : '0',
        rating: allGroomers.length > 0
          ? Number(
              allGroomers.reduce((acc, g) => acc + Number(g.rating || 0), 0) /
                allGroomers.length
            ).toFixed(1)
          : '-'
      });
    } catch (error) {
      console.error('❌ [GroomingServiceRouter] Error loading grooming data:', error);
      // Show zeros on error - no fake data
      setStats({ activeGroomers: 0, sessions: '0', rating: '-' });
    } finally {
      setLoading(false);
    }
  };

  const loadPreviousGroomer = async () => {
    try {
      // Try to get previous groomer from booking history or packages
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=grooming`).catch(() => null);
      
      if (response?.provider) {
        setPreviousGroomer({
          id: response.provider.id,
          name: response.provider.businessName || response.provider.name,
          photo: response.provider.photo || null,
          rating: response.provider.rating || 4.9,
          lastVisit: response.provider.lastVisit,
          sessionsCount: response.provider.sessionsCount || 5
        });
      } else {
        // Try getting from active packages
        const packagesResponse = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=grooming`).catch(() => null);
        if (packagesResponse?.packages && packagesResponse.packages.length > 0) {
          const pkg = packagesResponse.packages[0];
          if (pkg.vendorId && pkg.vendorName) {
            setPreviousGroomer({
              id: pkg.vendorId,
              name: pkg.vendorName,
              photo: null,
              rating: 4.9,
              lastVisit: pkg.lastUsed || '3 weeks ago',
              sessionsCount: pkg.sessionsUsed || 5
            });
          }
        }
      }
    } catch (error) {
      // Silently fail - not having a previous groomer is not an error
      console.log('No previous groomer found:', error);
    }
  };

  const serviceTypes = [
    {
      id: 'grooming_center',
      name: 'Grooming Centre',
      description: 'Visit our salons',
      icon: Building2,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      badge: '50+ Centres'
    },
    {
      id: 'grooming_home',
      name: 'At Home Grooming',
      description: 'Groomer comes to you',
      icon: HomeIcon,
      color: 'text-green-600',
      bg: 'bg-green-50',
      badge: 'Track Live'
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const dashboardStats = stats ? [
    { value: `${stats.activeGroomers || 0}+`, label: 'Pros', icon: <Scissors className="w-4 h-4" /> },
    { value: `${stats.sessions || 0}+`, label: 'Sessions' },
    { value: `${stats.rating || '-'}`, label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ] : [
    { value: '0+', label: 'Pros', icon: <Scissors className="w-4 h-4" /> },
    { value: '0+', label: 'Sessions' },
    { value: '-', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
      <ServiceDashboardHeader
        serviceName="Grooming Services"
        serviceSubtitle="Premium pet grooming"
        serviceIcon={Scissors}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 pt-4 bg-white">
        <div className="space-y-8">
          
          {/* YOUR GROOMER Section - As per Master Plan */}
          {previousGroomer && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-slate-900">🔄 YOUR GROOMER</h2>
              </div>
              
              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-4">
                <div className="flex items-center gap-4">
                  {previousGroomer.photo ? (
                    <img 
                      src={previousGroomer.photo} 
                      alt={previousGroomer.name}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                      {previousGroomer.name?.charAt(0) || 'G'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{previousGroomer.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <div className="flex items-center gap-1 text-orange-600 font-bold">
                        <Star className="w-4 h-4 fill-orange-500" />
                        {previousGroomer.rating}
                      </div>
                      <span>•</span>
                      <span>Last visit: {previousGroomer.lastVisit || '3 weeks ago'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {previousGroomer.sessionsCount || 5} sessions with you
                    </p>
                  </div>
                  <Button 
                    size="sm"
                    className="bg-orange-600 text-white hover:bg-orange-700 whitespace-nowrap"
                    onClick={() => onNavigate?.('create-booking', { 
                      vendorId: previousGroomer.id,
                      serviceType: 'grooming'
                    })}
                  >
                    Book Again
                  </Button>
                </div>
              </Card>
            </div>
          )}

          {/* PHASE 1.2: Promotion Banners (from Admin Marketing) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900">Spotlight Offers</h2>
            </div>
            <PromotionBanner service="grooming" onNavigate={onNavigate} />
          </div>

          {/* Grooming Needs Grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">What does your pet need?</h2>
              <button 
                onClick={() => {
                  console.log('🔵 [Grooming] View All problem grid clicked');
                  onNavigate?.('problem_grid');
                }}
                className="text-sm text-orange-600 font-medium hover:text-orange-700"
              >
                View All
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3" style={{ position: 'relative', zIndex: 1 }}>
              {(groomingNeeds.length > 0 ? groomingNeeds : GROOMING_NEEDS).map((need) => {
                const isViewAll = need.id === 'view_all';
                const hasAdminTint = Boolean((need as { iconBg?: string }).iconBg) && !isViewAll;
                return (
                  <button
                    key={need.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔵 [Grooming] Problem grid clicked:', need.id, isViewAll);
                      if (isViewAll) {
                        console.log('🔵 [Grooming] Navigating to problem_grid');
                        onNavigate?.('problem_grid');
                      } else {
                        console.log('🔵 [Grooming] Navigating to problem_selected:', need.id);
                        onNavigate?.('problem_selected', { problemId: need.id, problemTitle: need.name });
                      }
                    }}
                    className="group flex flex-col items-center gap-2 cursor-pointer"
                    style={{ 
                      pointerEvents: 'auto', 
                      zIndex: 1,
                      position: 'relative'
                    }}
                  >
                    <div className={`
                      w-full aspect-square rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all duration-200
                      ${isViewAll 
                        ? 'bg-orange-50 border border-orange-100 text-orange-600' 
                        : 'bg-white border border-slate-100 text-slate-700 group-hover:border-orange-200 group-hover:shadow-md group-hover:-translate-y-0.5'
                      }
                    `}>
                      {typeof need.icon === 'string' ? (
                        <span className="text-2xl">{need.icon}</span>
                      ) : hasAdminTint ? (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${(need as { iconBg?: string }).iconBg} group-hover:opacity-90`}
                        >
                          {need.icon}
                        </div>
                      ) : (
                        <div className="text-slate-600 group-hover:text-orange-600">
                          {need.icon}
                        </div>
                      )}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${isViewAll ? 'text-orange-600' : 'text-slate-600'}`}>
                      {need.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Choose Service Type</h2>
            <div className="grid grid-cols-2 gap-3" style={{ position: 'relative', zIndex: 1 }}>
              {serviceTypes.map((service) => (
              <button
                key={service.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log('🔵 [Grooming] Service style clicked:', service.id);
                  onNavigate?.(service.id);
                }}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group relative overflow-hidden cursor-pointer"
                style={{ 
                  pointerEvents: 'auto', 
                  zIndex: 1,
                  position: 'relative'
                }}
              >
                  <div className={`w-10 h-10 rounded-xl ${service.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <service.icon className={`w-5 h-5 ${service.color}`} />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{service.name}</h3>
                  <p className="text-xs text-slate-500">{service.description}</p>
                  {service.badge && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded-full uppercase tracking-wide">
                      {service.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Featured Groomers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Groomers</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('grooming_center')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {featuredGroomers.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">✂️</div>
                  <p className="text-gray-600 mb-2">No groomers available in your area yet</p>
                  <p className="text-gray-500 text-sm">Check back soon for grooming options!</p>
                </Card>
              ) : (
                featuredGroomers.map((provider) => (
                  <FeaturedProviderCard
                    key={provider.id}
                    provider={provider}
                    onClick={() => onNavigate?.('grooming_center')}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
