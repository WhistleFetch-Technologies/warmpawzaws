"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, GraduationCap, Building2, Home as HomeIcon, Star, Sparkles, ChevronRight, Heart, Trophy, Package, TrendingUp, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { TRAINING_GOALS } from './ProblemGridSection';

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
  const [loading, setLoading] = useState(true);
  const [featuredTrainers, setFeaturedTrainers] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [activePackages, setActivePackages] = useState<ActiveTrainingPackage[]>([]);
  const [petSkills, setPetSkills] = useState<PetSkillProgress[]>([]);

  useEffect(() => {
    loadTrainingData();
    loadActiveTrainingPackages();
    loadPetSkills();
  }, []);

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
      const endpoint = `/customer/discover-services?category=training&roleId=pet_trainer`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      const trainerServices = data.vendors || data.services || [];
      
      const vendorMap = new Map();
      trainerServices.forEach((service: any) => {
        const vendorId = service.vendorId || service.id;
        if (!vendorMap.has(vendorId)) {
          vendorMap.set(vendorId, {
            id: vendorId,
            businessName: service.vendorName || service.businessName || service.name,
            rating: service.vendorRating || service.rating || 4.5,
            completedBookings: service.vendorReviewCount || service.reviewsCount || 0,
            distance: service.distance || Math.random() * 5 + 0.5,
            basePrice: service.price || 1500
          });
        }
      });
      
      const allTrainers = Array.from(vendorMap.values());
      setFeaturedTrainers(allTrainers.slice(0, 5));
      
      setStats({
        activeTrainers: allTrainers.length,
        sessions: allTrainers.length > 0 ? `${Math.max(allTrainers.length * 40, 100)}+` : '0',
        rating: allTrainers.length > 0 
          ? (allTrainers.reduce((acc: number, t: any) => acc + (t.rating || 4.5), 0) / allTrainers.length).toFixed(1) 
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
          
          {/* FREE TRIAL ENTRY POINT - As per Master Plan */}
          {activePackages.length === 0 && (
            <Card className="bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100 border-2 border-orange-200 p-6 shadow-lg relative overflow-hidden">
              <div className="absolute top-2 right-2">
                <span className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  FREE
                </span>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-md border-2 border-orange-200 flex-shrink-0">
                  <GraduationCap className="w-8 h-8 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-slate-900 mb-2">🎁 FREE TRIAL SESSION</h2>
                  <p className="text-slate-700 mb-1">
                    Meet a trainer, assess your dog's needs, and get a training plan!
                  </p>
                  <p className="text-sm text-slate-600 mb-4">
                    ✅ 30 min evaluation session<br />
                    ✅ Personalized training plan<br />
                    ✅ No commitment required
                  </p>
                  <Button 
                    className="bg-orange-600 text-white hover:bg-orange-700 font-bold text-base px-6 py-3 rounded-xl shadow-md"
                    onClick={() => onNavigate?.('training-trial-booking')}
                  >
                    <GraduationCap className="w-5 h-5 mr-2" />
                    Book Free Trial - 30 min
                  </Button>
                </div>
              </div>
            </Card>
          )}
          
          {/* Active Training Package with Progress */}
          {activePackages.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-bold text-slate-900">Your Training</h2>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-purple-600"
                  onClick={() => onNavigate?.('training-progress', { packageId: activePackages[0].id })}
                >
                  View Progress
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              
              <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-4">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Trophy className="w-6 h-6 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-purple-900">{activePackages[0].packageName}</h3>
                    <p className="text-sm text-purple-600">with {activePackages[0].trainerName}</p>
                    <p className="text-xs text-gray-500 mt-1">{activePackages[0].petName}</p>
                  </div>
                </div>
                
                {/* Session Progress */}
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Sessions Completed</span>
                    <span className="font-medium">{activePackages[0].completedSessions}/{activePackages[0].totalSessions}</span>
                  </div>
                  <div className="h-2 bg-purple-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
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
                  <div className="flex items-center justify-between pt-3 border-t border-purple-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>Next: {new Date(activePackages[0].nextSessionDate).toLocaleDateString()}</span>
                    </div>
                    <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
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
                  <Button size="sm" className="bg-orange-600 text-white hover:bg-orange-700 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate?.('training_center')}>
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
                  <Button size="sm" className="bg-slate-900 text-white hover:bg-slate-800 h-8 text-xs px-4 rounded-lg" onClick={() => onNavigate?.('training_center')}>
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
                  onClick={() => onNavigate?.(service.id)}
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
                onClick={() => onNavigate?.('problem_grid')}
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
                        onNavigate?.('problem_grid');
                      } else {
                        onNavigate?.('problem_selected', { problemId: goal.id });
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
                      {typeof goal.icon === 'string' ? (
                        <span className="text-2xl">{goal.icon}</span>
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
              {(featuredTrainers.length > 0 ? featuredTrainers : [1, 2, 3]).map((trainer: any, index) => (
                <div 
                  key={index}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                  onClick={() => onNavigate?.('training_center')}
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
