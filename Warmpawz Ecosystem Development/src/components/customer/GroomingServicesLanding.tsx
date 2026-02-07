import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  Scissors,
  Home as HomeIcon,
  Building2,
  Sparkles,
  Star,
  TrendingUp,
  ChevronRight,
  MapPin,
  Heart,
  Shield,
  Zap
} from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../utils/api-config';
import { GROOMING_NEEDS } from './ProblemGridSection';

interface GroomingServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

export function GroomingServicesLanding({ onBack, onNavigate, customerId, phone }: GroomingServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [featuredGroomers, setFeaturedGroomers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [userPets, setUserPets] = useState<any[]>([]);

  const API_BASE = getApiBaseUrl();

  useEffect(() => {
    loadGroomingData();
    loadUserPets();
  }, []);

  const loadUserPets = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/customer/pets/${phone}`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );
      if (response.ok) {
        const data = await response.json();
        setUserPets(data.pets || []);
      }
    } catch (error) {
      console.error('❌ Error loading pets:', error);
    }
  };

  const loadGroomingData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_groomer`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const groomerServices = data.services || [];
        
        const vendorMap = new Map();
        groomerServices.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              businessName: service.vendorName,
              rating: service.vendorRating || 4.5,
              completedBookings: service.vendorReviewCount || 0,
              distance: Math.random() * 5 + 0.5,
              basePrice: service.price || 999
            });
          }
        });
        
        const allGroomers = Array.from(vendorMap.values());
        setFeaturedGroomers(allGroomers.slice(0, 5));
        
        setStats({
          activeGroomers: allGroomers.length || 120,
          sessions: '3K',
          rating: allGroomers.length > 0 
            ? (allGroomers.reduce((acc: number, g: any) => acc + (g.rating || 4.5), 0) / allGroomers.length).toFixed(1) 
            : '4.7'
        });
      } else {
        setStats({ activeGroomers: 120, sessions: '3K', rating: '4.7' });
      }
    } catch (error) {
      console.error('❌ [GROOMING-LANDING] Error loading grooming data:', error);
      setStats({ activeGroomers: 120, sessions: '3K', rating: '4.7' });
    } finally {
      setLoading(false);
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
          <h1 className="text-2xl font-bold text-white">Pet Grooming</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
             <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
                <div className="text-2xl font-bold text-white">{stats.activeGroomers}+</div>
                <div className="text-xs text-white/80">Pros</div>
             </div>
             <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
                <div className="text-2xl font-bold text-white">{stats.sessions}+</div>
                <div className="text-xs text-white/80">Sessions</div>
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
              {/* Offer 1 */}
              <Card className="min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">Limited Time</div>
                    <div className="text-2xl font-bold text-slate-900">20% OFF</div>
                    <div className="text-slate-500 text-xs">First Grooming Session</div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                    <Scissors className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    <span className="line-through text-slate-400 text-xs">₹1499</span>
                    <span className="ml-2 font-bold text-slate-900">₹1199</span>
                  </div>
                  <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate('grooming_center')}>
                    Book
                  </Button>
                </div>
              </Card>

              {/* Offer 2 */}
              <Card className="min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">Free Visit</div>
                    <div className="text-2xl font-bold text-slate-900">₹0 Fees</div>
                    <div className="text-slate-500 text-xs">Home Visit Charges</div>
                  </div>
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                    <HomeIcon className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-xs text-slate-500">Orders above ₹999</div>
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate('grooming_home')}>
                    Claim
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Grooming Needs Grid */}
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

            <div className="grid grid-cols-4 gap-3">
              {GROOMING_NEEDS.map((need) => {
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

          {/* Service Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Choose Service Type</h2>
            <div className="grid grid-cols-2 gap-3">
              {serviceTypes.map((service) => (
                <button
                  key={service.id}
                  onClick={() => onNavigate(service.id)}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group relative overflow-hidden"
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
                onClick={() => onNavigate('grooming_center')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {(featuredGroomers.length > 0 ? featuredGroomers : [1, 2, 3]).map((groomer: any, index) => (
                <div 
                  key={index}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                  onClick={() => onNavigate('grooming_center')}
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                     {groomer.businessName ? groomer.businessName.charAt(0) : 'P'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{groomer.businessName || `Pawfect Grooming ${index}`}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 text-orange-500 font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        {groomer.rating || 4.8}
                      </span>
                      <span>•</span>
                      <span>{groomer.distance ? `${groomer.distance.toFixed(1)} km` : '2.5 km'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                     <div className="font-bold text-slate-900">₹{groomer.basePrice || 799}</div>
                     <div className="text-[10px] text-slate-400">starts at</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
