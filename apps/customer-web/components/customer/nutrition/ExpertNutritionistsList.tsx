"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { urlCustomerPetsByPhonePath } from '@/lib/customer-service-list-urls';
import {
  NutritionVendorDetailsCard,
  nutritionVendorFromDiscoveryRow,
} from './NutritionVendorDetailsCard';
import { fetchMergedNutritionProviders } from '@/lib/nutritionist-discovery';
import { toast } from 'sonner';

interface ExpertNutritionistsListProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function ExpertNutritionistsList({ phone, onBack, onNavigate }: ExpertNutritionistsListProps) {
  const [loading, setLoading] = useState(true);
  const [nutritionists, setNutritionists] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);

  useEffect(() => {
    fetchPets();
    fetchNutritionists();
  }, [phone]);

  const fetchPets = async () => {
    try {
      const petsData = await apiClient.get(urlCustomerPetsByPhonePath(phone)) as any;
      const petsList = petsData?.pets || [];
      setPets(petsList);
      setHasPets(petsList.length > 0);
    } catch (err: any) {
      console.error('Error loading pets:', err);
      setHasPets(false);
    }
  };

  //we need to crate a seprate endpoiny to deal with top vendors
  const fetchNutritionists = async () => {
    try {
      setLoading(true);
      const nutritionistList = await fetchMergedNutritionProviders({ customerPhone: phone });
      setNutritionists(nutritionistList);
    } catch (error: any) {
      console.error('Error loading nutritionists:', error);
      toast.error('Failed to load nutritionists. Please try again.');
      setNutritionists([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNutritionistClick = (nutritionist: any) => {
    // ✅ FIX: Validate pet context before navigation (fallback)
    if (!hasPets || pets.length === 0) {
      toast.error('Please add a pet first before booking nutrition services');
      onNavigate?.('pets', { action: 'add' });
      return;
    }

    try {
      // Navigate to create booking page
      onNavigate?.('create-booking', {
        vendorId: nutritionist.id || nutritionist.vendorId,
        serviceId: 'pet_nutritionist'
      });
    } catch (err: any) {
      console.error('Navigation error:', err);
      toast.error('Failed to navigate. Please try again.');
    }
  };

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
          <h1 className="text-2xl font-bold text-white">Expert Nutritionists</h1>
        </div>
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-180px)]">
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 mb-2">All Top Rated Nutritionists</h2>
            <p className="text-sm text-slate-600">Browse through all available expert nutritionists</p>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="p-4 rounded-2xl border border-slate-100">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                  </div>
                </Card>
              ))}
            </div>
          ) : nutritionists.length === 0 ? (
            <Card className="p-8 text-center">
              <div className="text-4xl mb-3">🥗</div>
              <p className="text-gray-600 mb-2">No nutritionists available yet</p>
              <p className="text-gray-500 text-sm">Check back soon for expert pet nutrition consultants!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {nutritionists.map((nutritionist: any, index: number) => {
                const vendorId = String(nutritionist.id ?? nutritionist.vendorId ?? '').trim();
                const snapshot = nutritionVendorFromDiscoveryRow(nutritionist as Record<string, unknown>);
                return (
                  <NutritionVendorDetailsCard
                    key={vendorId || index}
                    vendor={snapshot}
                    showViewMealPlans
                    onViewMealPlans={() => {
                      if (!vendorId) return;
                      onNavigate?.('nutrition-meal-plans', {
                        vendorId,
                        vendorSnapshot: snapshot,
                      });
                    }}
                    showBookConsultation
                    onBookConsultation={() => handleNutritionistClick(nutritionist)}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}