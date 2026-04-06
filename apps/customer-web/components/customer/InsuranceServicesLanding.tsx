"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Shield, Star, Sparkles, ChevronRight, CheckCircle2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PromotionBanner } from './shared/PromotionBanner';

interface InsuranceServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function InsuranceServicesLanding({ phone, onBack, onNavigate }: InsuranceServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const endpoint = `/customer/discover-services?category=insurance&roleId=pet_insurance&serviceStyle=at_center`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[]; plans?: any[] }>(endpoint);
      const providerList = data.vendors || data.services || data.plans || [];
      setProviders(providerList);
      
      setStats({
        activeProviders: providerList.length || 8,
        policiesIssued: '2K+',
        rating: providerList.length > 0 
          ? Number(providerList.reduce((acc: number, p: any) => acc + Number(p.rating || 4.7), 0) / providerList.length).toFixed(1) 
          : '4.7'
      });
    } catch (error: any) {
      console.error('Error loading insurance providers:', error);
      setProviders([]);
      setStats({ activeProviders: 8, policiesIssued: '2K+', rating: '4.7' });
      // ✅ FIX: Show error toast for API failures
      toast.error('Failed to load insurance providers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleProviderSelect = (provider: any) => {
    onNavigate?.('insurance_policy_purchase', { vendorId: provider.id || provider.vendorId, provider });
  };

  const insurancePlans = [
    {
      name: 'Basic Coverage',
      price: '₹299/month',
      features: ['Accident coverage', 'Basic illness', 'Annual limit: ₹50,000'],
      color: 'from-blue-50 to-blue-100',
      borderColor: 'border-blue-200'
    },
    {
      name: 'Comprehensive',
      price: '₹599/month',
      features: ['Full accident & illness', 'Preventive care', 'Annual limit: ₹2,00,000', 'Wellness visits'],
      color: 'from-green-50 to-green-100',
      borderColor: 'border-green-200',
      popular: true
    },
    {
      name: 'Premium',
      price: '₹999/month',
      features: ['Everything in Comprehensive', 'No annual limit', 'Emergency care', 'Dental coverage'],
      color: 'from-purple-50 to-purple-100',
      borderColor: 'border-purple-200'
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header with Concave Bottom Curve */}
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-6 pt-8 pb-16 relative">
        <button 
          onClick={onBack}
          className="mb-4 flex items-center gap-2 text-white/90 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pet Insurance</h1>
            <p className="text-white/80 text-sm">Protect your furry friend</p>
          </div>
        </div>

        {/* Quick Stats */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold">{stats.activeProviders}+</div>
              <div className="text-white/80 text-xs">Providers</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold">{stats.policiesIssued}</div>
              <div className="text-white/80 text-xs">Policies</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="flex items-center gap-1 text-2xl font-bold">
                <Star className="w-4 h-4 fill-white" />
                {stats.rating}
              </div>
              <div className="text-white/80 text-xs">Trust Score</div>
            </div>
          </div>
        )}
        
        {/* Concave curve */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-white" 
             style={{
               borderTopLeftRadius: '50% 100%',
               borderTopRightRadius: '50% 100%',
             }}
        />
      </div>

      {/* Main Content on White Background */}
      <div className="px-6 pb-24">
        {/* Promotion Banner */}
        <div className="mb-6">
          <PromotionBanner service="insurance" maxPromotions={3} onNavigate={onNavigate} />
        </div>

        {/* Insurance Plans */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Insurance Plans</h2>
            <span className="text-sm text-gray-500">Monthly premium</span>
          </div>
          <div className="space-y-4">
            {insurancePlans.map((plan, idx) => (
              <Card 
                key={idx} 
                className={`p-5 border-2 ${plan.borderColor} ${plan.popular ? 'ring-2 ring-orange-500' : ''}`}
              >
                {plan.popular && (
                  <div className="mb-3">
                    <span className="bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                    <p className="text-orange-600 font-bold text-xl mt-1">{plan.price}</p>
                  </div>
                  {plan.popular && (
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                  )}
                </div>
                <div className="space-y-2 mb-4">
                  {plan.features.map((feature, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => {
                    if (onNavigate) onNavigate('insurance_policy_purchase', { plan: plan.name });
                  }}
                  className={`w-full ${
                    plan.popular 
                      ? 'bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white' 
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  {plan.popular ? 'Get Started' : 'Learn More'}
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Featured Providers */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">Insurance Providers</h2>
            <button 
              className="text-sm text-orange-600 flex items-center gap-1 font-medium"
              onClick={() => onNavigate?.('insurance_policy_purchase')}
            >
              View All <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {providers.length === 0 ? (
            <Card className="p-8 text-center">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Insurance Providers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {providers.slice(0, 5).map((provider, index) => (
                <div 
                  key={provider.id || provider.vendorId || index}
                  className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-orange-200 transition-colors"
                  onClick={() => handleProviderSelect(provider)}
                >
                  <div className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-xl shrink-0">
                     {provider.businessName ? provider.businessName.charAt(0) : 'I'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 truncate">{provider.businessName || provider.name || `Insurance Provider ${index}`}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1 text-orange-500 font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        {provider.rating || 4.7}
                      </span>
                      <span>•</span>
                      <span>{provider.coverageType || 'Comprehensive'}</span>
                    </div>
                  </div>
                  <div className="text-right">
                     <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
