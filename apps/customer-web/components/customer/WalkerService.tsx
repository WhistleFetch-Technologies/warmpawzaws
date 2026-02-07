"use client";

import { useState, useEffect } from 'react';
import { Dog, Star, MapPin, Clock, Search, Navigation, Radio, Eye, Play, Package, Footprints, Plus, Bike, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PromotionBanner } from './shared/PromotionBanner';
import { WALKING_NEEDS } from './ProblemGridSection';
import { useProblemGridByRole } from './useProblemGridByRole';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';

interface WalkerServiceProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface ActiveWalk {
  id: string;
  walkerName: string;
  petName: string;
  startTime: string;
  status: 'in_progress' | 'completed' | 'scheduled';
  distanceCovered?: number;
  currentLocation?: { latitude: number; longitude: number };
}

export function WalkerService({ phone, onBack, onNavigate }: WalkerServiceProps) {
  const walkingNeeds = useProblemGridByRole('walker');
  const [loading, setLoading] = useState(true);
  const [walkers, setWalkers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeWalks, setActiveWalks] = useState<ActiveWalk[]>([]);
  const [activePackages, setActivePackages] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [previousWalker, setPreviousWalker] = useState<any>(null);

  useEffect(() => {
    loadWalkers();
    loadActiveWalks();
    loadActivePackages();
    loadPreviousWalker();
  }, []);

  const loadPreviousWalker = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=walking`).catch(() => null);
      if (response?.provider) {
        setPreviousWalker({ id: response.provider.id, name: response.provider.businessName || response.provider.name, photo: response.provider.photo, rating: response.provider.rating || 4.8, lastVisit: response.provider.lastVisit, sessionsCount: response.provider.sessionsCount || 1 });
      } else {
        const pkgRes = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=walking`).catch(() => null);
        if (pkgRes?.packages?.length > 0) {
          const pkg = pkgRes.packages[0];
          if (pkg.vendorId && pkg.vendorName) setPreviousWalker({ id: pkg.vendorId, name: pkg.vendorName, photo: null, rating: 4.8, lastVisit: pkg.lastUsed || '3 weeks ago', sessionsCount: pkg.sessionsUsed || 1 });
        }
      }
    } catch { /* ignore */ }
  };

  const loadActiveWalks = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/active-walks`);
      if (response?.walks && Array.isArray(response.walks)) {
        setActiveWalks(response.walks);
      } else {
        setActiveWalks([]);
      }
    } catch (error: any) {
      // Silently fail - no active walks is not an error
      console.log('No active walks or error loading:', error?.message);
      setActiveWalks([]);
    }
  };

  const loadActivePackages = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=walking`);
      if (response?.packages && Array.isArray(response.packages)) {
        setActivePackages(response.packages);
      } else {
        setActivePackages([]);
      }
    } catch (error: any) {
      // Silently fail - no packages is not an error
      console.log('No active packages or error loading:', error?.message);
      setActivePackages([]);
    }
  };

  useEffect(() => {
    if (searchQuery) {
      const timeout = setTimeout(() => loadWalkers(), 300);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery]);

  const loadWalkers = async () => {
    try {
      setLoading(true);
      // Rule: Home service = only solo with at_home. Use discover-services with serviceStyle=at_home.
      const locationParams = await (async (): Promise<string> => {
        try {
          const lat = typeof localStorage !== 'undefined' && localStorage.getItem('customer_latitude');
          const lng = typeof localStorage !== 'undefined' && localStorage.getItem('customer_longitude');
          if (lat && lng) return `&latitude=${lat}&longitude=${lng}`;
        } catch (_) {}
        if (typeof phone !== 'undefined' && phone) {
          try {
            const profileRes = await apiClient.get(`/customer/profile?phone=${encodeURIComponent(phone)}`) as any;
            const profile = profileRes?.profile || profileRes;
            if (profile?.latitude != null && profile?.longitude != null)
              return `&latitude=${encodeURIComponent(String(profile.latitude))}&longitude=${encodeURIComponent(String(profile.longitude))}`;
          } catch (_) {}
        }
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000, maximumAge: 300000 });
            });
            return `&latitude=${encodeURIComponent(String(pos.coords.latitude))}&longitude=${encodeURIComponent(String(pos.coords.longitude))}`;
          } catch (_) {}
        }
        return '';
      })();
      let walkerList: any[] = [];
      try {
        const endpoint = `/customer/discover-services?category=walker&serviceStyle=at_home&roleId=walker${locationParams}`;
        const data = await apiClient.get<{ success?: boolean; vendors?: any[]; providers?: any[]; services?: any[]; staff?: any[] }>(endpoint);
        walkerList = data.vendors || data.providers || data.services || data.staff || [];
        // Fallback: try category-only (no roleId) so backend returns all walker/pet_walker roles
        if (walkerList.length === 0) {
          const fallbackUrl = `/customer/discover-services?category=walker&serviceStyle=at_home${locationParams}`;
          const fallback = await apiClient.get<{ vendors?: any[]; providers?: any[] }>(fallbackUrl);
          walkerList = fallback.vendors || fallback.providers || [];
        }
      } catch (_) {
        // Fallback: vendors/search with serviceStyle=at_home
        try {
          const params = new URLSearchParams({ roleId: 'pet_walker', serviceStyle: 'at_home', limit: '50', ...(searchQuery && { query: searchQuery }) });
          const data = await apiClient.get<{ vendors?: any[]; services?: any[]; staff?: any[] }>(`/customer/vendors/search?${params.toString()}${locationParams}`);
          walkerList = data.vendors || data.services || data.staff || [];
        } catch (__) {
          walkerList = [];
        }
      }
      setWalkers(walkerList);
    } catch (error) {
      console.error('Error loading walkers:', error);
      setWalkers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleWalkerSelect = (walker: any) => {
    onNavigate?.('walker-booking', { vendorId: walker.id || walker.vendorId, serviceType: 'walking', serviceStyle: 'at_home' });
  };

  // Prepare stats for ServiceDashboardHeader
  const dashboardStats = stats ? [
    { value: `${stats.walkers}+`, label: 'Walkers' },
    { value: stats.walks, label: 'Walks' },
    { value: `*${stats.rating}`, label: 'Rating' }
  ] : [
    { value: '30+', label: 'Walkers' },
    { value: '2K+', label: 'Walks' },
    { value: '*4.8', label: 'Rating' }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ FIX: Use ServiceDashboardHeader to match vet service UI frame */}
      <ServiceDashboardHeader
        serviceName="Dog Walking"
        serviceSubtitle="Professional pet walking services"
        serviceIcon={Dog}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />
      
      {/* Search Bar - Moved below header */}
      <div className="max-w-md mx-auto px-4 pt-4 pb-4 bg-white">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search walkers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Phase 1: Book again with previous walker */}
        {previousWalker && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900">Book again</h2>
            </div>
            <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-4">
              <div className="flex items-center gap-4">
                {previousWalker.photo ? (
                  <img src={previousWalker.photo} alt={previousWalker.name} className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200" />
                ) : (
                  <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                    {previousWalker.name?.charAt(0) || 'W'}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-lg">{previousWalker.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                    <div className="flex items-center gap-1 text-orange-600 font-bold">
                      <Star className="w-4 h-4 fill-orange-500" />
                      {previousWalker.rating}
                    </div>
                    <span>•</span>
                    <span>Last walk: {previousWalker.lastVisit || '3 weeks ago'}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{previousWalker.sessionsCount || 1} walk(s) with you</p>
                </div>
                <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white" onClick={() => handleWalkerSelect(previousWalker)}>
                  Book Now
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Active Walk in Progress - GPS Tracking */}
        {activeWalks.filter(w => w.status === 'in_progress').length > 0 && (
          <Card className="bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] text-white p-4 relative overflow-hidden">
            <div className="absolute top-2 right-2">
              <span className="flex items-center gap-1 bg-white/20 backdrop-blur px-2 py-1 rounded-full text-xs">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center">
                <Navigation className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-lg mb-1">Walk in Progress</h3>
                <p className="text-white/90 text-sm">{activeWalks[0].petName} with {activeWalks[0].walkerName}</p>
                {activeWalks[0].distanceCovered && (
                  <p className="text-white/80 text-xs mt-1">{activeWalks[0].distanceCovered}km covered</p>
                )}
              </div>
              <Button 
                variant="secondary" 
                size="sm" 
                className="bg-white text-orange-500 hover:bg-white/90"
                onClick={() => onNavigate?.('walk-live-tracking', { sessionId: activeWalks[0].id })}
              >
                <Eye className="w-4 h-4 mr-1" />
                Track
              </Button>
            </div>
          </Card>
        )}

        {/* Active Walking Packages */}
        {activePackages.length > 0 && (
          <Card className="border-blue-200 bg-blue-50/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Your Walking Packages</h3>
              </div>
            </div>
            <div className="space-y-2">
              {activePackages.slice(0, 2).map((pkg, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-100">
                  <div>
                    <p className="font-medium text-sm">{pkg.packageName || 'Walking Package'}</p>
                    <p className="text-xs text-gray-500">
                      {pkg.remainingSessions === 'unlimited' ? 'Unlimited' : `${pkg.remainingSessions} sessions left`}
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="text-blue-600 border-blue-200"
                    onClick={() => onNavigate?.('schedule-walk', { packageId: pkg.id })}
                  >
                    <Play className="w-3 h-3 mr-1" />
                    Schedule
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Professional Pet Walking</h2>
              <p className="text-gray-700 mb-4">Exercise, companionship & care</p>
            </div>
            <div className="flex-shrink-0 w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center">
              <Dog className="w-8 h-8 text-orange-600" />
            </div>
          </div>
        </Card>

        {/* Promotion Banner - Phase 0.1 Integration */}
        <PromotionBanner service="walking" maxPromotions={3} />

        {/* Problem Grid - Walk by Need */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-orange-50 rounded-lg">
                <Footprints className="w-4 h-4 text-orange-500" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900">Walk by Need</h2>
            </div>
            <button 
              onClick={() => onNavigate?.('problem_grid')}
              className="text-sm text-orange-500 font-medium hover:text-orange-600 transition-colors"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(walkingNeeds.length > 0 ? walkingNeeds : WALKING_NEEDS).map((need) => {
              const isViewAll = need.id === 'view_all';
              return (
                <button
                  key={need.id}
                  onClick={() => {
                    if (isViewAll) {
                      onNavigate?.('problem_grid');
                    } else {
                      onNavigate?.('problem_selected', { problemId: need.id, problemTitle: need.name });
                    }
                  }}
                  className="group relative flex flex-col items-center"
                >
                  <div className={`
                    w-full aspect-square rounded-2xl border transition-all duration-200 flex flex-col items-center justify-center gap-2 p-2
                    ${isViewAll 
                      ? 'bg-orange-50 border-orange-100 text-orange-600 hover:bg-orange-100' 
                      : 'bg-white border-slate-100 text-slate-600 hover:border-orange-200 hover:shadow-md hover:-translate-y-0.5'
                    }
                  `}>
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110
                      ${isViewAll ? 'bg-white/50' : 'bg-slate-50 group-hover:bg-orange-50'}
                    `}>
                      {typeof need.icon === 'string' ? (
                        <span className="text-xl">{need.icon}</span>
                      ) : (
                        <div className="text-slate-600 group-hover:text-orange-500">
                          {need.icon}
                        </div>
                      )}
                    </div>
                    <p className={`
                      text-[10px] font-medium text-center leading-tight line-clamp-2
                      ${isViewAll ? 'text-orange-600' : 'text-slate-600 group-hover:text-orange-600'}
                    `}>
                      {need.name}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Walk Packages */}
        <div>
          <h2 className="font-bold text-gray-900 mb-4">Walk Packages</h2>
          <div className="space-y-3">
            {[
              { icon: <Dog className="w-7 h-7 text-orange-600" />, title: '30 Min Walk', price: '₹199/walk', features: ['Quick exercise', 'Basic walk'] },
              { icon: <Dog className="w-7 h-7 text-orange-600" />, title: '60 Min Walk', price: '₹349/walk', features: ['Extended exercise', 'Playtime'] },
              { icon: '📅', title: 'Weekly Package', price: '₹1,999/week', features: ['5 walks', 'GPS tracking', 'Updates'] }
            ].map((pkg, idx) => (
              <Card key={idx} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-100 to-amber-100 rounded-xl flex items-center justify-center text-2xl [&>svg]:shrink-0">
                    {pkg.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900">{pkg.title}</h3>
                    <p className="text-orange-500 font-bold mb-2">{pkg.price}</p>
                    {pkg.features.map((f, i) => (
                      <div key={i} className="text-sm text-gray-600">• {f}</div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Walkers List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Available Walkers</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
            </div>
          ) : walkers.length === 0 ? (
            <Card className="p-8 text-center">
              <Dog className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Walkers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {walkers.map((walker, index) => (
                <Card 
                  key={walker.id || walker.vendorId || index} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleWalkerSelect(walker)}
                >
                  {/* Walker Image */}
                  <div className="h-48 bg-gradient-to-br from-orange-100 to-amber-100 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-6xl">
                      <Bike className="w-16 h-16 text-orange-400 opacity-30" />
                    </div>
                    <div className="absolute top-3 right-3 bg-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {walker.rating || 4.5}
                    </div>
                  </div>

                  {/* Walker Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{walker.name || walker.businessName || 'Pet Walker'}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <MapPin className="w-4 h-4" />
                        <span>{walker.location?.address || walker.address || walker.city || 'Location'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-gray-600">{walker.reviewsCount || walker.reviewCount || 0} reviews</span>
                        {walker.priceRange && (
                          <span className="text-orange-500 font-semibold">{walker.priceRange}</span>
                        )}
                        {walker.experience && (
                          <span className="text-gray-500">• {walker.experience}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWalkerSelect(walker);
                      }}
                      className="w-full bg-gradient-to-br from-[#FF8C42] to-[#FF6B35] hover:from-[#FF7A35] hover:to-[#FF5A25] text-white h-12 text-base font-semibold shadow-lg"
                    >
                      <Dog className="w-5 h-5 mr-2" />
                      Book Walker
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Walking Features */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Why Choose Us?</h3>
          <div className="space-y-3">
            {[
              { icon: '📍', title: 'GPS Tracking', desc: 'Real-time location tracking' },
              { icon: '⏱️', title: 'Flexible Timing', desc: 'Book walks on your schedule' },
              { icon: '📸', title: 'Walk Reports', desc: 'Photos & activity updates' },
              { icon: '🛡️', title: 'Insured & Bonded', desc: 'Fully insured walkers' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
