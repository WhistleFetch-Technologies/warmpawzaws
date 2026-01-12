import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  GraduationCap,
  Home as HomeIcon,
  Building2,
  Sparkles,
  Star,
  TrendingUp,
  ChevronRight,
  MapPin,
  Shield,
  Trophy,
  Heart
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { TRAINING_GOALS } from './ProblemGridSection';

interface TrainingServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

export function TrainingServicesLanding({ onBack, onNavigate, customerId, phone }: TrainingServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [featuredTrainers, setFeaturedTrainers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadTrainingData();
  }, []);

  const loadTrainingData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_trainer`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        const trainerServices = data.services || [];
        
        const vendorMap = new Map();
        trainerServices.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              businessName: service.vendorName,
              rating: service.vendorRating || 4.5,
              completedBookings: service.vendorReviewCount || 0,
              distance: Math.random() * 5 + 0.5,
              basePrice: service.price || 1500
            });
          }
        });
        
        const allTrainers = Array.from(vendorMap.values());
        setFeaturedTrainers(allTrainers.slice(0, 5));
        
        setStats({
          activeTrainers: allTrainers.length || 45,
          sessions: '2K+',
          rating: allTrainers.length > 0 
            ? (allTrainers.reduce((acc: number, t: any) => acc + (t.rating || 4.5), 0) / allTrainers.length).toFixed(1) 
            : '4.8'
        });
      } else {
        setStats({ activeTrainers: 45, sessions: '2K+', rating: '4.8' });
      }
    } catch (error) {
      console.error('❌ [TRAINING] Error loading training data:', error);
      setStats({ activeTrainers: 45, sessions: '2K+', rating: '4.8' });
    } finally {
      setLoading(false);
    }
  };

  const serviceTypes = [
    {
      id: 'training_center',
      name: 'Training Centre',
      description: 'Visit our facilities',
      icon: Building2,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      badge: '30+ Centres'
    },
    {
      id: 'training_home',
      name: 'At Home Training',
      description: 'Trainer comes to you',
      icon: HomeIcon,
      color: 'text-slate-600',
      bg: 'bg-slate-50',
      badge: 'Personalized'
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
          <h1 className="text-2xl font-bold text-white">Pet Training</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.activeTrainers}+</div>
               <div className="text-xs text-white/80">Trainers</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
               <div className="text-2xl font-bold text-white">{stats.sessions}</div>
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
              <Card className="min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">New Puppy</div>
                    <div className="text-2xl font-bold text-slate-900">25% OFF</div>
                    <div className="text-slate-500 text-xs">Puppy Training Package</div>
                  </div>
                  <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-orange-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    <span className="line-through text-slate-400 text-xs">₹2999</span>
                    <span className="ml-2 font-bold text-slate-900">₹2249</span>
                  </div>
                  <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate('training_center')}>
                    Book Now
                  </Button>
                </div>
              </Card>

              <Card className="min-w-[280px] flex-shrink-0 bg-white border border-slate-100 p-5 shadow-sm rounded-2xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">Popular</div>
                    <div className="text-2xl font-bold text-slate-900">₹4999</div>
                    <div className="text-slate-500 text-xs">Obedience Package</div>
                  </div>
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    <Heart className="w-5 h-5 text-slate-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-xs text-slate-500">8 Sessions</div>
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate('training_center')}>
                    Book
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Service Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Choose Training Type</h2>
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

          {/* Training Goals Grid - Unified Style */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">What's your goal?</h2>
              <button 
                onClick={() => onNavigate('problem_grid')}
                className="text-sm text-orange-600 font-medium hover:text-orange-700"
              >
                View All
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3">
              {TRAINING_GOALS.map((goal) => {
                const isViewAll = goal.id === 'view_all';
                return (
                  <button
                    key={goal.id}
                    onClick={() => {
                      if (isViewAll) {
                        onNavigate('problem_grid');
                      } else {
                        onNavigate('problem_selected', { problemId: goal.id });
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
                      {goal.icon}
                    </div>
                    <span className={`text-[10px] font-medium text-center leading-tight line-clamp-2 ${isViewAll ? 'text-orange-600' : 'text-slate-600'}`}>
                      {goal.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Featured Trainers */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Top Trainers</h2>
              <button 
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate('training_center')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {(featuredTrainers.length > 0 ? featuredTrainers : [1, 2, 3]).map((trainer: any, index) => (
                <div 
                  key={index}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                  onClick={() => onNavigate('training_center')}
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                     {trainer.businessName ? trainer.businessName.charAt(0) : 'T'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{trainer.businessName || `Professional Trainer ${index}`}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 text-orange-500 font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        {trainer.rating || 4.8}
                      </span>
                      <span>•</span>
                      <span>{trainer.distance ? `${trainer.distance.toFixed(1)} km` : 'Nearby'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                     <div className="font-bold text-slate-900">₹{trainer.basePrice || 1500}</div>
                     <div className="text-[10px] text-slate-400">starting</div>
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
