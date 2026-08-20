"use client";

import { useState, useEffect } from 'react';
import { Apple } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import {
  NutritionVendorDetailsCard,
  nutritionVendorFromDiscoveryRow,
} from './NutritionVendorDetailsCard';
import { fetchMergedNutritionProviders } from '@/lib/nutritionist-discovery';
import { toast } from 'sonner';
import { isCustomerMealPlansEnabled } from '@/lib/customer-meal-plans-flag';
import { ServiceDashboardHeader } from '../shared/ServiceDashboardHeader';
import { EMPTY_SERVICE_HEADER_STATS } from '@/lib/service-header-stats';
import {
  shouldBlockNutritionDiscoveryForMissingPets,
  shouldFetchNutritionCustomerPets,
} from '@/lib/nutrition-guest-discovery';

interface ExpertNutritionistsListProps {
  phone: string;
  isGuest?: boolean;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function ExpertNutritionistsList({ phone, isGuest = false, onBack, onNavigate }: ExpertNutritionistsListProps) {
  const [loading, setLoading] = useState(true);
  const [nutritionists, setNutritionists] = useState<any[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [hasPets, setHasPets] = useState<boolean | null>(null);

  useEffect(() => {
    fetchPets();
    fetchNutritionists();
  }, [phone, isGuest]);

  const fetchPets = async () => {
    if (!shouldFetchNutritionCustomerPets({ isGuest, phone })) {
      setPets([]);
      setHasPets(false);
      return;
    }
    try {
      const petsData = await apiClient.get(`/customer/pets/${phone}`) as any;
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
    if (
      shouldBlockNutritionDiscoveryForMissingPets({
        isGuest,
        phone,
        hasPets: Boolean(hasPets && pets.length > 0),
      })
    ) {
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <ServiceDashboardHeader
        fullWidth
        serviceName="Expert Nutritionists"
        serviceSubtitle="Browse through all available expert nutritionists"
        serviceIcon={Apple}
        iconColor="text-white"
        stats={EMPTY_SERVICE_HEADER_STATS}
        onBack={onBack}
        showBackButton={true}
        headerColor="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35]"
        sheetToneClass="bg-white"
      />

      <div className="mx-auto w-full max-w-customer -mt-4 rounded-t-[1.75rem] bg-white px-4 pt-6 pb-6 sm:rounded-t-[2rem]">
        <div className="space-y-4">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-900 mb-2">All Top Rated Nutritionists</h2>
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
                    showViewMealPlans={isCustomerMealPlansEnabled()}
                    onViewMealPlans={() => {
                      if (!isCustomerMealPlansEnabled()) {
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