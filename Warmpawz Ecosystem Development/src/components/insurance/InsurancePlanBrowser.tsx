import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Shield,
  CheckCircle,
  XCircle,
  Info,
  Heart,
  Activity,
  FileText,
  Clock,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

const BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface InsurancePlan {
  planId: string;
  planName: string;
  provider: string;
  type: string;
  coverage: {
    accidentCover: number;
    illnessCover: number;
    surgicalCover: number;
    dentalCover?: number;
    vaccinationCover?: number;
  };
  monthlyPremium: number;
  annualPremium: number;
  deductible: number;
  maxCoverAge: number;
  minCoverAge: number;
  waitingPeriod: number;
  features: string[];
  exclusions: string[];
  claimProcess: string;
}

interface InsurancePlanBrowserProps {
  petAge?: number;
  petBreed?: string;
  onPlanSelect: (plan: InsurancePlan, calculatedPremium?: number) => void;
}

export function InsurancePlanBrowser({
  petAge,
  petBreed,
  onPlanSelect
}: InsurancePlanBrowserProps) {
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [calculatedPremiums, setCalculatedPremiums] = useState<Record<string, number>>({});
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, [selectedType]);

  useEffect(() => {
    if (plans.length > 0 && petAge !== undefined) {
      calculatePremiums();
    }
  }, [plans, petAge, petBreed]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const url = selectedType
        ? `${BASE_URL}/insurance/plans?type=${selectedType}`
        : `${BASE_URL}/insurance/plans`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast.error('Failed to load insurance plans');
    } finally {
      setLoading(false);
    }
  };

  const calculatePremiums = async () => {
    const premiums: Record<string, number> = {};

    for (const plan of plans) {
      try {
        const response = await fetch(`${BASE_URL}/insurance/calculate-premium`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            planId: plan.planId,
            petAge,
            petBreed
          })
        });

        if (response.ok) {
          const data = await response.json();
          premiums[plan.planId] = data.monthlyPremium;
        }
      } catch (error) {
        console.error('Error calculating premium:', error);
      }
    }

    setCalculatedPremiums(premiums);
  };

  const getPlanTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'accident_only': 'Accident Only',
      'time_limited': 'Time Limited',
      'maximum_benefit': 'Maximum Benefit',
      'lifetime': 'Lifetime Coverage'
    };
    return labels[type] || type;
  };

  const getPlanTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'accident_only': 'bg-blue-100 text-blue-700',
      'time_limited': 'bg-green-100 text-green-700',
      'maximum_benefit': 'bg-orange-100 text-orange-700',
      'lifetime': 'bg-purple-100 text-purple-700'
    };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  const handlePlanSelect = (plan: InsurancePlan) => {
    setSelectedPlan(plan);
    const premium = calculatedPremiums[plan.planId] || plan.monthlyPremium;
    onPlanSelect(plan, premium);
  };

  return (
    <div className="space-y-6">
      {/* Filter by Type */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-6">
        <h3 className="font-bold text-gray-900 mb-4">Filter by Coverage Type</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => setSelectedType(null)}
            className={`p-3 border-2 rounded-lg text-sm transition-all ${
              selectedType === null
                ? 'border-orange-600 bg-orange-50 text-orange-900'
                : 'border-gray-200 hover:border-orange-300'
            }`}
          >
            All Plans
          </button>
          
          {['accident_only', 'time_limited', 'maximum_benefit', 'lifetime'].map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`p-3 border-2 rounded-lg text-sm transition-all ${
                selectedType === type
                  ? 'border-orange-600 bg-orange-50 text-orange-900'
                  : 'border-gray-200 hover:border-orange-300'
              }`}
            >
              {getPlanTypeLabel(type)}
            </button>
          ))}
        </div>
      </div>

      {/* Plans Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
        </div>
      ) : plans.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-gray-200 p-12 text-center">
          <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No insurance plans available</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const premium = calculatedPremiums[plan.planId] || plan.monthlyPremium;
            const isSelected = selectedPlan?.planId === plan.planId;

            return (
              <div
                key={plan.planId}
                className={`bg-white rounded-xl border-2 overflow-hidden transition-all ${
                  isSelected
                    ? 'border-orange-600 shadow-lg'
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                {/* Header */}
                <div className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                  <div className="flex items-start justify-between mb-2">
                    <Shield className="w-8 h-8" />
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPlanTypeColor(plan.type)} bg-white`}>
                      {getPlanTypeLabel(plan.type)}
                    </span>
                  </div>
                  
                  <h3 className="font-bold text-xl mb-1">{plan.planName}</h3>
                  <p className="text-orange-100 text-sm">{plan.provider}</p>
                </div>

                {/* Pricing */}
                <div className="p-6 border-b border-gray-200">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      ₹{premium.toLocaleString()}
                    </div>
                    <p className="text-sm text-gray-600">per month</p>
                    {petAge !== undefined && calculatedPremiums[plan.planId] && (
                      <p className="text-xs text-green-600 mt-2">
                        Customized for your pet's age
                      </p>
                    )}
                  </div>

                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">Annual (save 10%)</span>
                      <span className="font-medium text-gray-900">
                        ₹{Math.round(premium * 12 * 0.9).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coverage */}
                <div className="p-6 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3">Coverage</h4>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Accident</span>
                      <span className="font-medium text-gray-900">
                        ₹{(plan.coverage.accidentCover / 100000).toFixed(1)}L
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Illness</span>
                      <span className="font-medium text-gray-900">
                        ₹{(plan.coverage.illnessCover / 100000).toFixed(1)}L
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Surgery</span>
                      <span className="font-medium text-gray-900">
                        ₹{(plan.coverage.surgicalCover / 100000).toFixed(1)}L
                      </span>
                    </div>
                    {plan.coverage.dentalCover && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Dental</span>
                        <span className="font-medium text-gray-900">
                          ₹{(plan.coverage.dentalCover / 100000).toFixed(1)}L
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Deductible</span>
                      <span className="font-medium text-gray-900">
                        ₹{plan.deductible.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div className="p-6 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3">Key Features</h4>
                  
                  <ul className="space-y-2">
                    {plan.features.slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.features.length > 3 && (
                    <button
                      onClick={() => setShowDetails(showDetails === plan.planId ? null : plan.planId)}
                      className="text-sm text-orange-600 hover:text-orange-700 mt-2"
                    >
                      {showDetails === plan.planId ? 'Show less' : `+${plan.features.length - 3} more features`}
                    </button>
                  )}

                  {showDetails === plan.planId && (
                    <ul className="space-y-2 mt-2">
                      {plan.features.slice(3).map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Additional Info */}
                <div className="p-6 bg-gray-50">
                  <div className="space-y-2 text-xs text-gray-600 mb-4">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Waiting period: {plan.waitingPeriod} days
                    </div>
                    <div className="flex items-center gap-2">
                      <Info className="w-3 h-3" />
                      Age: {plan.minCoverAge}-{plan.maxCoverAge} years
                    </div>
                  </div>

                  <Button
                    onClick={() => handlePlanSelect(plan)}
                    className={`w-full ${
                      isSelected
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-orange-600 hover:bg-orange-700'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Selected
                      </>
                    ) : (
                      'Select Plan'
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
