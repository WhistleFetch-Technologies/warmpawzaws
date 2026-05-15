'use client';

import { useRouter } from 'next/navigation';
import { Utensils, Plus } from 'lucide-react';
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface VendorDietChartsProps {
  vendorId: string;
  onBack?: () => void;
}

export function VendorDietCharts({ vendorId, onBack }: VendorDietChartsProps) {
  const router = useRouter();

  const handleCreateDietPlan = () => {
    // Navigate to Nutrition Dashboard where users can create meal products/plans
    router.push('/nutrition/dashboard');
  };

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column min-h-screen bg-white">
        <VendorHeader
          tone="brand"
          title="Diet Charts"
          subtitle="Manage your meal plans"
          showBack={Boolean(onBack)}
          onBack={onBack}
        />
      <div className="p-4">
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Utensils className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Create Your Diet Plans</h3>
          <p className="text-gray-500 mb-6">Start creating customized meal plans and products for pets. Manage ingredients, nutritional values, and pricing all in one place.</p>
          <button 
            onClick={handleCreateDietPlan}
            className="bg-[#FF8C42] hover:bg-[#FF8C42]/90 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
          >
            <Plus className="w-5 h-5" />
            Create Diet Plan
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}

export default VendorDietCharts;
