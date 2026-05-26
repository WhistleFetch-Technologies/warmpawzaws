"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Apple, UtensilsCrossed, Calendar, Heart, Sparkles, ChevronRight, AlertCircle, Plus, Video, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { fetchMergedNutritionProviders } from '@/lib/nutritionist-discovery';
import { toast } from 'sonner';
import { useProblemGridByRole } from '../useProblemGridByRole';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import { NUTRITIONIST_NEEDS } from '../ProblemGridSection';
import { serviceTypes } from './constants';
import { NutritionistServicesLandingProps } from './constants/interface';
import {
  NutritionVendorDetailsCard,
  nutritionVendorFromDiscoveryRow,
} from './NutritionVendorDetailsCard';



/**
 * ✅ FIX: Added pet context validation to prevent crashes (NUT-CUST-001)
 * Nutrition services require a pet to be selected before booking
 */
export function NutritionistServicesLanding({ phone, onBack, onNavigate }: NutritionistServicesLandingProps) {
  const mealPlansLive = isCustomerMealPlansEnabled();
  //---------------------------states----------------------------------//
  const nutritionistNeeds = useProblemGridByRole('nutritionist');
  const [loading, setLoading] = useState(true);
  const [nutritionists, setNutritionists] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  //---------------------------useEffect----------------------------------//
  useEffect(() => {
    loadPets();
    loadNutritionists();
  }, [phone]);

  //---------------------------fucntions----------------------------------//
  const loadPets = async () => {
    try {
      const petsData = await apiClient.get(`/customer/pets/${phone}`) as any;
      const petsList = petsData?.pets || [];
      setPets(petsList);
      setHasPets(petsList.length > 0);
    } catch (err: any) {
      console.error('Error loading pets:', err);
      setError('Failed to load pets. Please try again.');
      setHasPets(false);
    }
  };

  const loadNutritionists = async () => {
    try {
      setLoading(true);
      const nutritionistList = await fetchMergedNutritionProviders({ customerPhone: phone });
      setNutritionists(nutritionistList);

      setStats({
        activeNutritionists: nutritionistList.length || 0,
        consultations: '1.5K+',
      });
    } catch (error) {
      console.error('Error loading nutritionists:', error);
      setNutritionists([]);
      setStats({ activeNutritionists: 0, consultations: '1.5K+' });
    } finally {
      setLoading(false);
    }
  };

  const handleNutritionistSelect = (nutritionist: any) => {
    // ✅ FIX: Validate pet context before navigation
    if (!hasPets || pets.length === 0) {
      toast.error('Please add a pet first before booking nutrition services');
      onNavigate?.('pets', { action: 'add' });
      return;
    }

    try {
      onNavigate?.('nutritionist-booking', {
        vendorId: nutritionist.id || nutritionist.vendorId,
        category: 'pet_nutritionist',
      });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  const handleBookNow = (data?: any) => {
    try {
      const serviceType = data?.serviceType || 'Diet Consultation';
      if (serviceType === 'Meal Plans') {
        if (!mealPlansLive) {
          toast.info('Meal plans are coming soon.');
          return;
        }
        onNavigate?.('nutrition-meal-plans');
        return;
      }
      onNavigate?.('diet-consultation-services', { serviceType });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  const dashboardStats = EMPTY_SERVICE_HEADER_STATS;


  //---------------------------render----------------------------------//
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto mb-3"></div>
          <p className="text-gray-600">Loading nutrition services...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-md mx-auto pb-24">
        <ServiceDashboardHeader
          serviceName="Pet Nutrition"
          serviceSubtitle="Expert nutrition consultation"
          serviceIcon={Apple}
          iconColor="text-white"
          stats={[]}
          onBack={onBack}
          showBackButton={true}
          headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        />
        <div className="bg-white px-6 pt-8 min-h-[calc(100vh-180px)]">
          <Card className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Unable to Load</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadPets} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
              Try Again
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  //---------------------------main render----------------------------------//
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ✅ FIX: Use ServiceDashboardHeader to match vet service UI frame */}
      <ServiceDashboardHeader
        serviceName="Pet Nutrition"
        serviceSubtitle="Expert nutrition consultation"
        serviceIcon={Apple}
        iconColor="text-white"
        stats={dashboardStats}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
      />

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white max-w-md mx-auto px-6 pt-8 min-h-[calc(100vh-180px)]">
        <div className="space-y-8">

          {/* Problem Grid - Consult by Need */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-orange-50 rounded-lg">
                  <Apple className="w-4 h-4 text-[#FF8C42]" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900">Consult by Need</h2>
              </div>
              <button
                onClick={() => onNavigate?.('problem_grid')}
                className="text-sm text-[#FF8C42] font-medium hover:text-[#FF7029] transition-colors"
              >
                View All
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {(nutritionistNeeds.length > 0 ? nutritionistNeeds : NUTRITIONIST_NEEDS).map((need) => {
                const isViewAll = need.id === 'view_all';
                const hasAdminTint = Boolean((need as { iconBg?: string }).iconBg) && !isViewAll;
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
                        ? 'bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100'
                        : 'bg-white border-slate-100 text-slate-600 hover:border-orange-200 hover:shadow-md hover:-translate-y-0.5'
                      }
                    `}>
                      <div
                        className={`
                        w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110
                        ${
                          isViewAll
                            ? 'bg-white/50'
                            : hasAdminTint
                              ? `${(need as { iconBg?: string }).iconBg} group-hover:opacity-90`
                              : 'bg-slate-50 group-hover:bg-orange-50'
                        }
                      `}
                      >
                        {typeof need.icon === 'string' ? (
                          <span className="text-xl">{need.icon}</span>
                        ) : (
                          <div
                            className={
                              hasAdminTint ? '' : 'text-slate-600 group-hover:text-orange-600'
                            }
                          >
                            {need.icon}
                          </div>
                        )}
                      </div>
                      <p className={`
                        text-[10px] font-medium text-center leading-tight line-clamp-2
                        ${isViewAll ? 'text-orange-700' : 'text-slate-600 group-hover:text-orange-700'}
                      `}>
                        {need.name}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ✅ NEW: Tele Consultation CTA */}
          <div>
            <button
              onClick={() => onNavigate?.('nutritionist-tele')}
              className="w-full p-4 rounded-2xl text-left transition-all border-2 border-green-200 hover:border-green-400 hover:shadow-lg bg-gradient-to-r from-green-50 to-emerald-50"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-semibold text-base text-gray-900">Video Consultation</h3>
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-medium flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Instant Available
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-snug">
                    Connect with pet nutritionists via video call. From ₹300
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" />
              </div>
            </button>
          </div>

          {/* Service Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Our Services</h2>
            <div className="grid grid-cols-2 gap-3">
              {serviceTypes.map((service, idx) => {
                const isMealPlansTile = service.label === 'Meal Plans';
                const comingSoon = isMealPlansTile && !mealPlansLive;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleBookNow({ serviceType: service.label })}
                    disabled={comingSoon}
                    aria-label={comingSoon ? `${service.label} — coming soon` : service.label}
                    className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-left group relative overflow-hidden ${
                      comingSoon
                        ? 'opacity-80 cursor-not-allowed'
                        : 'hover:shadow-md transition-all'
                    }`}
                  >
                    {comingSoon ? (
                      <span className="absolute top-2 right-2 rounded-md bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                        Soon
                      </span>
                    ) : null}
                    <div className={`w-10 h-10 rounded-xl ${service.color.split(' ')[0]} flex items-center justify-center mb-3 ${comingSoon ? '' : 'group-hover:scale-110 transition-transform'}`}>
                      <service.icon className={`w-5 h-5 ${service.color.split(' ')[1]}`} />
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{service.label}</h3>
                    <p className="text-xs text-slate-500">
                      {comingSoon ? 'Coming soon' : service.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Featured Nutritionists */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Expert Nutritionists</h2>
              <button
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => onNavigate?.('expert-nutritionists')}
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {nutritionists.length === 0 ? (
                <Card className="p-8 text-center">
                  <div className="text-4xl mb-3">🥗</div>
                  <p className="text-gray-600 mb-2">No nutritionists available yet</p>
                  <p className="text-gray-500 text-sm">Check back soon for expert pet nutrition consultants!</p>
                </Card>
              ) : (
                nutritionists.slice(0, 5).map((nutritionist: any, index: number) => {
                  const vendorId = String(nutritionist.id ?? nutritionist.vendorId ?? '').trim();
                  const snapshot = nutritionVendorFromDiscoveryRow(nutritionist as Record<string, unknown>);
                  return (
                    <NutritionVendorDetailsCard
                      key={vendorId || index}
                      vendor={snapshot}
                      showViewMealPlans={mealPlansLive}
                      onViewMealPlans={() => {
                        if (!mealPlansLive) {
                          toast.info('Meal plans are coming soon.');
                          return;
                        }
                        if (!vendorId) return;
                        onNavigate?.('nutrition-meal-plans', {
                          vendorId,
                          vendorSnapshot: snapshot,
                        });
                      }}
                      showBookConsultation
                      onBookConsultation={() => handleNutritionistSelect(nutritionist)}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
