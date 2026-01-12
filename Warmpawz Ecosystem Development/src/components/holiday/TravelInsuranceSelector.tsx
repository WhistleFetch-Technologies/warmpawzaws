import { useState, useEffect } from 'react';
import { Shield, Check, Info } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface TravelInsuranceSelectorProps {
  bookingId?: string;
  petIds?: string[];
  onSelect?: (insurancePlanId: string) => void;
}

export function TravelInsuranceSelector({ bookingId, petIds, onSelect }: TravelInsuranceSelectorProps) {
  const [insurancePlans, setInsurancePlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    fetchInsurancePlans();
  }, []);

  const fetchInsurancePlans = async () => {
    try {
      const response = await fetch(`${API_BASE}/travel/insurance-options`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setInsurancePlans(data.insurancePlans);
        }
      }
    } catch (error) {
      console.error('Failed to fetch insurance plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    setSelectedPlan(planId);
    
    if (onSelect) {
      onSelect(planId);
    }

    if (bookingId) {
      try {
        await fetch(`${API_BASE}/travel/add-insurance`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            bookingId,
            insurancePlanId: planId,
            petIds: petIds || []
          })
        });
      } catch (error) {
        console.error('Failed to add insurance:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
        <p className="text-sm">Loading insurance options...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-orange-600" />
        <h3 className="font-bold text-gray-900">Travel Insurance (Optional)</h3>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-900">
            Protect your pet during travel with comprehensive insurance coverage. Covers medical emergencies, lost pets, and more.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {/* No Insurance Option */}
        <Card
          onClick={() => handleSelectPlan('none')}
          className={`p-4 cursor-pointer transition-all border-2 ${
            selectedPlan === 'none'
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-gray-900">No Insurance</h4>
                {selectedPlan === 'none' && (
                  <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">Travel without insurance coverage</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">₹0</p>
            </div>
          </div>
        </Card>

        {/* Insurance Plans */}
        {insurancePlans.map((plan) => (
          <Card
            key={plan.id}
            onClick={() => handleSelectPlan(plan.id)}
            className={`p-4 cursor-pointer transition-all border-2 ${
              selectedPlan === plan.id
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-gray-900">{plan.name}</h4>
                  {selectedPlan === plan.id && (
                    <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{plan.provider}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-900">₹{plan.price.toLocaleString()}</p>
                <p className="text-xs text-gray-500">per pet</p>
              </div>
            </div>

            <p className="text-sm text-gray-700 mb-3">{plan.coverage}</p>

            <div className="space-y-1.5">
              {plan.features.map((feature: string, idx: number) => (
                <div key={idx} className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-gray-700">{feature}</p>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      {selectedPlan && selectedPlan !== 'none' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-4">
          <p className="text-sm text-green-900">
            ✅ Insurance selected! Your pet will be protected during the journey.
          </p>
        </div>
      )}
    </div>
  );
}
