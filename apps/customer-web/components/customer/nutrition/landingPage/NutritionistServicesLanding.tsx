"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Apple, Star, UtensilsCrossed, Calendar, Heart, Sparkles, ChevronRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { DietConsultationVendors } from './dietConsultation/DietConsultationVendors';
import { MealPlansList } from './mealplans/MealPlansList';
import { ExpertNutritionistsList } from './expertNutritionist/ExpertNutritionistsList';

interface NutritionistServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

/**
 * ✅ FIX: Added pet context validation to prevent crashes (NUT-CUST-001)
 * Nutrition services require a pet to be selected before booking
 */
export function NutritionistServicesLanding({ phone, onBack, onNavigate }: NutritionistServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [nutritionists, setNutritionists] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDietConsultation, setShowDietConsultation] = useState(false);
  const [showMealPlans, setShowMealPlans] = useState(false);
  const [showExpertNutritionists, setShowExpertNutritionists] = useState(false);

  useEffect(() => {
    loadPets();
    loadNutritionists();
  }, []);

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
      const endpoint = `/customer/discover-services?category=nutrition&roleId=pet_nutritionist`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[] }>(endpoint);
      console.log('Nutritionists data:', data);
      const nutritionistList = data.vendors || data.services || [];
      setNutritionists(nutritionistList);

      setStats({
        activeNutritionists: nutritionistList.length || 45,
        consultations: '1.5K+',
        rating: nutritionistList.length > 0
          ? (nutritionistList.reduce((acc: number, n: any) => acc + (n.rating || 4.9), 0) / nutritionistList.length).toFixed(1)
          : '4.9'
      });
    } catch (error) {
      console.error('Error loading nutritionists:', error);
      setNutritionists([]);
      setStats({ activeNutritionists: 45, consultations: '1.5K+', rating: '4.9' });
    } finally {
      setLoading(false);
    }
  };
  console.log('🟢 [NutritionistServicesLanding] Nutritionists:----------------------------------------------->', nutritionists);
  const handleNutritionistSelect = (nutritionist: any) => {
    // ✅ FIX: Validate pet context before navigation
    if (!hasPets || pets.length === 0) {
      toast.error('Please add a pet first before booking nutrition services');
      onNavigate?.('pets', { action: 'add' });
      return;
    }

    try {
      onNavigate?.('create-booking', {
        vendorId: nutritionist.id || nutritionist.vendorId,
        serviceId: 'pet_nutritionist'
      });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

  const handleBookNow = (data?: any) => {
    // Check if it's Diet Consultation - show vendor list
    if (data?.serviceType === 'Diet Consultation') {
      if (nutritionists.length === 0) {
        toast.error('No nutritionists available at the moment');
        return;
      }
      setShowDietConsultation(true);
      return;
    }

    // Check if it's Meal Plans - show meal plans list
    if (data?.serviceType === 'Meal Plans') {
      setShowMealPlans(true);
      return;
    }

    // ✅ FIX: Validate pet context before navigation for other services
    if (!hasPets || pets.length === 0) {
      toast.error('Please add a pet first before booking nutrition services');
      onNavigate?.('pets', { action: 'add' });
      return;
    }

    try {
      onNavigate?.('create-booking', {
        serviceId: 'pet_nutritionist',
        ...data
      });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };


  const serviceTypes = [
    { icon: UtensilsCrossed, label: 'Diet Consultation', color: 'bg-green-100 text-green-600', desc: 'Personalized meal plans' },
    { icon: Calendar, label: 'Meal Plans', color: 'bg-yellow-100 text-yellow-600', desc: 'Monthly subscriptions' },
    { icon: Heart, label: 'Weight Management', color: 'bg-pink-100 text-pink-600', desc: 'Healthy weight goals' },
    { icon: Apple, label: 'Allergy Management', color: 'bg-orange-100 text-orange-600', desc: 'Specialized diets' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FF8C42] flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#FF8C42] max-w-md mx-auto pb-24">
        <div className="px-6 pt-12 pb-6">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={onBack}
              className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-2xl font-bold text-white">Pet Nutrition</h1>
          </div>
        </div>
        <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
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

  // Show Diet Consultation Vendor List
  if (showDietConsultation) {
    return (
      <DietConsultationVendors
        vendors={nutritionists}
        phone={phone}
        onBack={() => setShowDietConsultation(false)}
        onNavigate={onNavigate}
      />
    );
  }

  // Show Meal Plans List
  if (showMealPlans) {
    return (
      <MealPlansList
        phone={phone}
        onBack={() => setShowMealPlans(false)}
        onNavigate={onNavigate}
      />
    );
  }

  // Show Expert Nutritionists List
  if (showExpertNutritionists) {
    return (
      <ExpertNutritionistsList
        phone={phone}
        onBack={() => setShowExpertNutritionists(false)}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto pb-24">
      {/* Header - Orange Background */}
      <div className="bg-[#FF8C42] px-6 pt-12 pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="text-2xl font-bold text-white">Pet Nutrition</h1>
        </div>

        {/* Stats Bar - Glassmorphism */}
        {stats && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold text-white">{stats.activeNutritionists}+</div>
              <div className="text-xs text-white/80">Experts</div>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-3 min-w-[100px] border border-white/10">
              <div className="text-2xl font-bold text-white">{stats.consultations}</div>
              <div className="text-xs text-white/80">Consultations</div>
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
                    <div className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 w-fit">First Time</div>
                    <div className="text-2xl font-bold text-slate-900">30% OFF</div>
                    <div className="text-slate-500 text-xs">First Consultation</div>
                  </div>
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center">
                    <Apple className="w-5 h-5 text-green-600" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="text-sm">
                    <span className="line-through text-slate-400 text-xs">₹999</span>
                    <span className="ml-2 font-bold text-slate-900">₹699</span>
                  </div>
                  <Button size="sm" className="bg-green-600 text-white hover:bg-green-700 h-8 text-xs px-4 rounded-lg" onClick={() => handleBookNow()}>
                    Book Now
                  </Button>
                </div>
              </Card>
            </div>
          </div>

          {/* Service Types */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-4">Our Services</h2>
            <div className="grid grid-cols-2 gap-3">
              {serviceTypes.map((service, idx) => (
                <button
                  key={idx}
                  onClick={() => handleBookNow({ serviceType: service.label })}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all text-left group relative overflow-hidden"
                >
                  <div className={`w-10 h-10 rounded-xl ${service.color.split(' ')[0]} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <service.icon className={`w-5 h-5 ${service.color.split(' ')[1]}`} />
                  </div>
                  <h3 className="font-semibold text-slate-900 text-sm mb-0.5">{service.label}</h3>
                  <p className="text-xs text-slate-500">{service.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Featured Nutritionists */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900">Expert Nutritionists</h2>
              <button
                className="text-sm text-orange-600 flex items-center gap-1 font-medium"
                onClick={() => setShowExpertNutritionists(true)}
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
                (nutritionists.slice(0, 5).map((nutritionist: any, index) => (
                  <div
                    key={index}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-orange-200 transition-colors"
                  >
                    <div
                      className="flex items-center gap-4 cursor-pointer mb-3"
                      onClick={() => handleNutritionistSelect(nutritionist)}
                    >
                      <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                        {nutritionist.businessName ? nutritionist.businessName.charAt(0) : nutritionist.name ? nutritionist.name.charAt(0) : 'N'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate">{nutritionist.businessName || nutritionist.name || `Nutritionist ${index}`}</h3>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1 text-orange-500 font-bold">
                            <Star className="w-3 h-3 fill-current" />
                            {nutritionist.rating || 4.9}
                          </span>
                          <span>•</span>
                          <span>Certified Expert</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>
                  </div>
                )))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
