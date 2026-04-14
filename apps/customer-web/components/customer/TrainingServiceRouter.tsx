"use client";

import { useState, useEffect } from 'react';
import { GraduationCap, Building2, Home as HomeIcon, Star, ChevronRight, Heart, Trophy, Package, TrendingUp, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { TRAINING_GOALS } from './ProblemGridSection';
import { useProblemGridByRole } from './useProblemGridByRole';
import { PromotionBanner } from './shared/PromotionBanner';
import { ServiceDashboardHeader } from './shared/ServiceDashboardHeader';
import { ServiceDescriptionInline } from './shared/ServiceDescriptionInline';
import { FeaturedProviderCard } from './shared/FeaturedProviderCard';
import {
  normalizeAndDedupeDiscoveryProviders,
  type FeaturedProvider,
} from '@/lib/featured-provider';

interface TrainingServiceRouterProps {
  phone: string;
  onBack: () => void;
  onViewBooking?: (bookingId: string) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

interface ActiveTrainingPackage {
  id: string;
  packageName: string;
  trainerName: string;
  petName: string;
  totalSessions: number;
  completedSessions: number;
  skillsLearned: string[];
  nextSessionDate?: string;
}

interface PetSkillProgress {
  skillName: string;
  level: number; // 0-100
  status: 'not_started' | 'in_progress' | 'mastered';
}

export function TrainingServiceRouter({ phone, onBack, onViewBooking, onNavigate }: TrainingServiceRouterProps) {
  const trainingGoals = useProblemGridByRole('trainer');
  const [loading, setLoading] = useState(true);
  const [featuredTrainers, setFeaturedTrainers] = useState<FeaturedProvider[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [activePackages, setActivePackages] = useState<ActiveTrainingPackage[]>([]);
  const [petSkills, setPetSkills] = useState<PetSkillProgress[]>([]);
  const [previousTrainer, setPreviousTrainer] = useState<any>(null);

  useEffect(() => {
    loadTrainingData();
    loadActiveTrainingPackages();
    loadPetSkills();
    loadPreviousTrainer();
  }, []);

  const loadPreviousTrainer = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/previous-providers?serviceType=training`).catch(() => null);
      if (response?.provider) {
        setPreviousTrainer({ id: response.provider.id, name: response.provider.businessName || response.provider.name, photo: response.provider.photo, rating: response.provider.rating || 4.8, lastVisit: response.provider.lastVisit, sessionsCount: response.provider.sessionsCount || 1 });
      } else {
        const pkgRes = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=training`).catch(() => null);
        if (pkgRes?.packages?.length > 0) {
          const pkg = pkgRes.packages[0];
          if (pkg.vendorId && pkg.vendorName) setPreviousTrainer({ id: pkg.vendorId, name: pkg.vendorName, photo: null, rating: 4.8, lastVisit: pkg.lastUsed || '3 weeks ago', sessionsCount: pkg.sessionsUsed || 1 });
        }
      }
    } catch { /* ignore */ }
  };

  const loadActiveTrainingPackages = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/packages?serviceType=training`);
      if (response?.packages && Array.isArray(response.packages)) {
        setActivePackages(response.packages);
      } else {
        setActivePackages([]);
      }
    } catch (error: any) {
      // Silently fail - no packages is not an error
      console.log('No active training packages or error loading:', error?.message);
      setActivePackages([]);
    }
  };

  const loadPetSkills = async () => {
    try {
      const response = await apiClient.get<any>(`/customer/${phone}/pet-skills`);
      if (response?.skills && Array.isArray(response.skills)) {
        setPetSkills(response.skills);
      } else {
        setPetSkills([]);
      }
    } catch (error: any) {
      // Silently fail - no skills data is not an error
      console.log('No pet skills data or error loading:', error?.message);
      setPetSkills([]);
    }
  };

  const loadTrainingData = async () => {
    try {
      setLoading(true);

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
      let trainerServices: any[] = [];
      
      // Try 1: discover-services by category (same pattern as VetServiceRouter)
      try {
        const endpoint = `/customer/discover-services?category=training&serviceStyle=at_center${locationParams}`;
        const data = await apiClient.get<any>(endpoint);
        console.log('🔵 [TrainingServiceRouter] discover-services response:', data);
        
        if (Array.isArray(data)) {
          trainerServices = data;
        } else if (data?.vendors && Array.isArray(data.vendors)) {
          trainerServices = data.vendors;
        } else if (data?.providers && Array.isArray(data.providers)) {
          trainerServices = data.providers;
        } else if (data?.services && Array.isArray(data.services)) {
          trainerServices = data.services;
        } else if (data?.results && Array.isArray(data.results)) {
          trainerServices = data.results;
        } else if (data?.data && Array.isArray(data.data)) {
          trainerServices = data.data;
        }
      } catch (err) {
        console.warn('⚠️ [TrainingServiceRouter] discover-services failed, trying alternatives:', err);
      }
      
      // Try 2: services/by-style (at_home = at home training)
      if (trainerServices.length === 0) {
        try {
          const phoneParam = phone ? `&customerPhone=${encodeURIComponent(phone)}` : '';
          const altRes = await apiClient.get<any>(`/customer/services/by-style?style=at_home&category=training${locationParams}${phoneParam}`);
          let altData = (altRes as any)?.providers ?? (altRes as any)?.vendors ?? altRes;
          
          // ✅ FIX: Filter out business vendors when style is at_home
          if (Array.isArray(altData)) {
            altData = altData.filter((p: any) => p.vendorType !== 'business');
            trainerServices = altData;
          } else if (altData?.services) {
            trainerServices = altData.services;
          }
        } catch (err) {
          console.warn('⚠️ [TrainingServiceRouter] services/by-style failed:', err);
        }
      }
      
      // Try 3: Fallback to /customer/vendors/search (GET /customer/vendors does not exist)
      if (trainerServices.length === 0) {
        try {
          const vendorsData = await apiClient.get<any>(`/customer/vendors/search?roleId=pet_trainer&limit=50${locationParams}`);
          if (Array.isArray(vendorsData)) trainerServices = vendorsData;
          else if (vendorsData?.vendors) trainerServices = vendorsData.vendors;
          else if (vendorsData?.results) trainerServices = vendorsData.results;
        } catch (err) {
          console.warn('⚠️ [TrainingServiceRouter] vendors/search fallback failed:', err);
        }
      }
      
      console.log('🔵 [TrainingServiceRouter] Final trainerServices length:', trainerServices.length);

      const allTrainers = normalizeAndDedupeDiscoveryProviders(
        trainerServices,
        'training'
      );
      setFeaturedTrainers(allTrainers.slice(0, 5));
      
      setStats({
        activeTrainers: allTrainers.length,
        sessions: allTrainers.length > 0 ? `${Math.max(allTrainers.length * 40, 100)}+` : '0',
        rating: allTrainers.length > 0
          ? Number(
              allTrainers.reduce((acc, t) => acc + Number(t.rating || 0), 0) /
                allTrainers.length
            ).toFixed(1)
          : '-'
      });
    } catch (error) {
      console.error('Error loading training data:', error);
      // Show zeros on error - no fake data
      setStats({ activeTrainers: 0, sessions: '0', rating: '-' });
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
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  // ✅ FIX: Prepare stats for ServiceDashboardHeader
  const dashboardStats = stats ? [
    { value: `${stats.activeTrainers || 0}+`, label: 'Trainers', icon: <GraduationCap className="w-4 h-4" /> },
    { value: `${stats.sessions || 0}`, label: 'Sessions' },
    { value: `${stats.rating || '-'}`, label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ] : [
    { value: '0+', label: 'Trainers', icon: <GraduationCap className="w-4 h-4" /> },
    { value: '0', label: 'Sessions' },
    { value: '-', label: 'Rating', icon: <Star className="w-4 h-4 fill-white" /> }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ✅ FIX: Restore Frame UI with ServiceDashboardHeader */}
      <ServiceDashboardHeader
        serviceName="Training Services"
        serviceSubtitle="Professional pet training"
        serviceIcon={GraduationCap}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-[#FF8C42]"
      />

      {/* Main Content */}
      <div className="max-w-md mx-auto px-4 pt-4 bg-white">
        <div className="space-y-8">

          {/* Phase 1: Book again with previous trainer */}
          {previousTrainer && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-bold text-slate-900">Book again</h2>
              </div>
              <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 p-4">
                <div className="flex items-center gap-4">
                  {previousTrainer.photo ? (
                    <img src={previousTrainer.photo} alt={previousTrainer.name} className="w-16 h-16 rounded-xl object-cover border-2 border-orange-200" />
                  ) : (
                    <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 font-bold text-xl border-2 border-orange-200">
                      {previousTrainer.name?.charAt(0) || 'T'}
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{previousTrainer.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-600 mt-1">
                      <Star className="w-4 h-4 fill-orange-500" /> {previousTrainer.rating}
                      <span>•</span>
                      <span>Last visit: {previousTrainer.lastVisit || '3 weeks ago'}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{previousTrainer.sessionsCount || 1} session(s) with you</p>
                  </div>
                  <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white" onClick={() => onNavigate?.('training-booking', { vendorId: previousTrainer.id })}>
                    Book Now
                  </Button>
                </div>
              </Card>
            </div>
          )}
          
          {/* Active Training Package with Progress */}
          {activePackages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-orange-500" />
                  <h2 className="text-lg font-bold text-slate-900">Your Training</h2>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-orange-500"
                  onClick={() => onNavigate?.('training-progress', { packageId: activePackages[0].id })}
                >
                  View Progress
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              
              <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-orange-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{activePackages[0].packageName}</h3>
                    <p className="text-sm text-orange-600">with {activePackages[0].trainerName}</p>
                    <p className="text-xs text-gray-500 mt-1">{activePackages[0].petName}</p>
                  </div>
                </div>
                
                {/* Session Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Sessions Completed</span>
                    <span className="font-medium">{activePackages[0].completedSessions}/{activePackages[0].totalSessions}</span>
                  </div>
                  <div className="h-2 bg-orange-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-orange-500 to-amber-500 rounded-full transition-all"
                      style={{ width: `${(activePackages[0].completedSessions / activePackages[0].totalSessions) * 100}%` }}
                    />
                  </div>
                </div>
                
                {/* Skills Learned */}
                {activePackages[0].skillsLearned && activePackages[0].skillsLearned.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs text-gray-500 mb-2">Skills Learned</p>
                    <div className="flex flex-wrap gap-2">
                      {activePackages[0].skillsLearned.map((skill, idx) => (
                        <span key={idx} className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
                          <CheckCircle className="w-3 h-3" />
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Next Session */}
                {activePackages[0].nextSessionDate && (
                  <div className="flex items-center justify-between pt-3 border-t border-orange-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Next: {new Date(activePackages[0].nextSessionDate).toLocaleDateString()}</span>
                    </div>
                    <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                      View Details
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Pet Skills Matrix Preview */}
          {petSkills.length > 0 && (
            <Card className="border-blue-200 bg-blue-50/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Skill Progress</h3>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-blue-600"
                  onClick={() => onNavigate?.('training-skill-matrix')}
                >
                  Full Matrix
                </Button>
              </div>
              <div className="space-y-2">
                {petSkills.slice(0, 3).map((skill, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700">{skill.skillName}</span>
                        <span className={`text-xs font-medium ${
                          skill.status === 'mastered' ? 'text-green-600' : 
                          skill.status === 'in_progress' ? 'text-blue-600' : 'text-gray-400'
                        }`}>
                          {skill.status === 'mastered' ? '✓ Mastered' : 
                           skill.status === 'in_progress' ? 'In Progress' : 'Not Started'}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all ${
                            skill.status === 'mastered' ? 'bg-green-500' : 
                            skill.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${skill.level}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Promotion Banner - Phase 0.1 Integration */}
          <PromotionBanner service="training" maxPromotions={3} onNavigate={onNavigate} />

          {/* Service Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Choose Training Type</h2>
            <div className="grid grid-cols-2 gap-3" style={{ position: 'relative', zIndex: 1 }}>
              {serviceTypes.map((service) => (
                <button
                  key={service.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔵 [Training] Service style clicked:', service.id);
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
                  <div onClick={(e) => e.stopPropagation()} className="relative z-20">
                    <ServiceDescriptionInline
                      description={service.description}
                      title={service.name}
                      className="m-0 text-xs leading-snug text-slate-500"
                      linkClassName="inline cursor-pointer align-baseline text-[10px] font-semibold text-orange-600 hover:underline"
                    />
                  </div>
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
                onClick={() => onNavigate?.('problem_grid')}
                className="text-sm text-orange-600 font-medium hover:text-orange-700"
              >
                View All
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3" style={{ position: 'relative', zIndex: 1 }}>
              {(trainingGoals.length > 0 ? trainingGoals : TRAINING_GOALS).map((goal) => {
                const isViewAll = goal.id === 'view_all';
                const hasAdminTint = Boolean((goal as { iconBg?: string }).iconBg) && !isViewAll;
                return (
                  <button
                    key={goal.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🔵 [Training] Goal clicked:', goal.id);
                      if (isViewAll) {
                        onNavigate?.('problem_grid');
                      } else {
                        onNavigate?.('problem_selected', { problemId: goal.id });
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
                      {typeof goal.icon === 'string' ? (
                        <span className="text-2xl">{goal.icon}</span>
                      ) : hasAdminTint ? (
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${(goal as { iconBg?: string }).iconBg} group-hover:opacity-90`}
                        >
                          {goal.icon}
                        </div>
                      ) : (
                        <div className="text-slate-600 group-hover:text-orange-600">
                          {goal.icon}
                        </div>
                      )}
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
                onClick={() => onNavigate?.('training_center')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              {featuredTrainers.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">🎓</div>
                  <p className="text-gray-600 mb-2">No trainers available in your area yet</p>
                  <p className="text-gray-500 text-sm">Check back soon for training options!</p>
                </Card>
              ) : (
                featuredTrainers.map((provider) => (
                  <FeaturedProviderCard
                    key={provider.id}
                    provider={provider}
                    onClick={() => onNavigate?.('training_center')}
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
