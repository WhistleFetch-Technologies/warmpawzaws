import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  MapPin,
  Sparkles,
  Star,
  TrendingUp,
  ChevronRight,
  Shield,
  Clock,
  Trophy
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { WALKING_NEEDS } from './ProblemGridSection';

interface WalkingServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

export function WalkingServicesLanding({ onBack, onNavigate, customerId, phone }: WalkingServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [featuredWalkers, setFeaturedWalkers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadWalkingData();
  }, []);

  const loadWalkingData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_walker`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const walkerServices = data.services || [];
        
        const vendorMap = new Map();
        walkerServices.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              businessName: service.vendorName,
              rating: service.vendorRating || 4.7,
              completedBookings: service.vendorReviewCount || 0,
              distance: Math.random() * 5 + 0.5,
              basePrice: service.price || 300
            });
          }
        });
        
        const allWalkers = Array.from(vendorMap.values());
        setFeaturedWalkers(allWalkers.slice(0, 5));
        
        setStats({
          activeWalkers: allWalkers.length || 120,
          walks: '10K+',
          rating: allWalkers.length > 0 
            ? (allWalkers.reduce((acc: number, w: any) => acc + (w.rating || 4.7), 0) / allWalkers.length).toFixed(1) 
            : '4.7'
        });
      } else {
        setStats({ activeWalkers: 120, walks: '10K+', rating: '4.7' });
      }
    } catch (error) {
      console.error('❌ [WALKING] Error loading walking data:', error);
      setStats({ activeWalkers: 120, walks: '10K+', rating: '4.7' });
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
          <h1 className="text-2xl font-bold text-white">Pet Walking</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.activeWalkers}+</div>
               <div className="text-xs text-white/80">Walkers</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.walks}</div>
               <div className="text-xs text-white/80">Walks</div>
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
                    <div className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">New Customer</div>
                    <div className="text-2xl font-bold text-slate-900">50% OFF</div>
                    <div className="text-slate-500 text-xs">First 3 Walks</div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    <span className="line-through text-slate-400 text-xs">₹300</span>
                    <span className="ml-2 font-bold text-slate-900">₹150</span>
                  </div>
                  <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate('walker_service')}>
                    Book Now
                  </Button>
                </div>
              </Card>

              <Card className="min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">Premium</div>
                    <div className="text-2xl font-bold text-slate-900">FREE</div>
                    <div className="text-slate-500 text-xs">Live GPS Tracking</div>
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-slate-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-xs text-slate-500">Included in all walks</div>
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate('walker_service')}>
                    Book
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Walking Needs Grid - Unified Style */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">What does your pet need?</h2>
              <button 
                onClick={() => onNavigate('problem_grid')}
                className="text-sm text-orange-600 font-medium hover:text-orange-700"
              >
                View All
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {WALKING_NEEDS.map((need) => {
                const isViewAll = need.id === 'view_all';
                return (
                  <button
                    key={need.id}
                    onClick={() => {
                      if (isViewAll) {
                        onNavigate('problem_grid');
                      } else {
                        onNavigate('problem_selected', { problemId: need.id });
                      }
                    }}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div className={`
                      w-full aspect-square rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all duration-200
                      ${isViewAll 
                        ? 'bg-orange-50 border border-orange-100 text-orange-600' 
                        : 'bg-white border border-slate-100 text-slate-700 group-hover:border-orange-200 group-hover:shadow-md group-hover:-translate-y-0.5'
                      }
                    `}>
                      {need.icon}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${isViewAll ? 'text-orange-600' : 'text-slate-600'}`}>
                      {need.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Featured Walkers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Walkers</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate('walker_service')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {(featuredWalkers.length > 0 ? featuredWalkers : [1, 2, 3]).map((walker: any, index) => (
                <div 
                  key={index}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                  onClick={() => onNavigate('walker_service')}
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                     {walker.businessName ? walker.businessName.charAt(0) : 'W'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{walker.businessName || `PawWalk Pro ${index}`}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 text-orange-500 font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        {walker.rating || 4.7}
                      </span>
                      <span>•</span>
                      <span>{walker.distance ? `${walker.distance.toFixed(1)} km` : 'Nearby'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                     <div className="font-bold text-slate-900">₹{walker.basePrice || 300}</div>
                     <div className="text-[10px] text-slate-400">per walk</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What's New */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Why Choose Us?</h2>
            <div className="space-y-3">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
                 <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center shrink-0">
                   <MapPin className="w-5 h-5 text-orange-600" />
                 </div>
                 <div>
                   <h3 className="font-bold text-slate-900 text-sm mb-1">Live GPS Tracking</h3>
                   <p className="text-xs text-slate-500">Watch your pet's walk in real-time</p>
                 </div>
              </div>
               <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start gap-4">
                 <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center shrink-0">
                   <Clock className="w-5 h-5 text-slate-600" />
                 </div>
                 <div>
                   <h3 className="font-bold text-slate-900 text-sm mb-1">Flexible Scheduling</h3>
                   <p className="text-xs text-slate-500">Book walks at your convenience</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
