"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Shield, CheckCircle2, Star, Search, TrendingUp, Heart, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

interface InsuranceServicesLandingProps {
  phone: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function InsuranceServicesLanding({ phone, onBack, onNavigate }: InsuranceServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const timeout = setTimeout(() => loadProviders(), 300);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        roleId: 'pet_insurance'
      });
      
      if (searchQuery) {
        params.append('query', searchQuery);
      }

      // Append params to URL query string
      const endpoint = `/customer/vendors/search${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await apiClient.get<{ vendors?: any[]; services?: any[]; plans?: any[] }>(endpoint);
      const providerList = data.vendors || data.services || data.plans || [];
      setProviders(providerList);
    } catch (error) {
      console.error('Error loading insurance providers:', error);
      // No mock fallback - show empty state when API fails
      setProviders([]);
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

  return (
    <div className="min-h-screen bg-gray-50 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-4 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Pet Insurance</h1>
            <p className="text-white/90 text-sm">Protect your pet's health</p>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search insurance providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/20 backdrop-blur rounded-lg text-white placeholder-white/70 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Hero Banner */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Protect Your Pet</h2>
              <p className="text-gray-700 mb-4">Comprehensive health insurance for your furry family member</p>
              <Button 
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
                onClick={() => {
                  if (onNavigate) onNavigate('insurance_policy_purchase');
                }}
              >
                Get Quote
              </Button>
            </div>
            <div className="text-5xl">🛡️</div>
          </div>
        </Card>

        {/* Insurance Plans */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Insurance Plans</h2>
            <span className="text-sm text-gray-500">Monthly premium</span>
          </div>
          <div className="space-y-4">
            {insurancePlans.map((plan, idx) => (
              <Card 
                key={idx} 
                className={`p-5 border-2 ${plan.borderColor} ${plan.popular ? 'ring-2 ring-blue-500' : ''}`}
              >
                {plan.popular && (
                  <div className="mb-3">
                    <span className="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
                    <p className="text-blue-600 font-bold text-xl mt-1">{plan.price}</p>
                  </div>
                  {plan.popular && (
                    <TrendingUp className="w-6 h-6 text-blue-600" />
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
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white' 
                      : 'bg-gray-900 hover:bg-gray-800 text-white'
                  }`}
                >
                  {plan.popular ? 'Get Started' : 'Learn More'}
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Why Insure Section */}
        <Card className="p-6 bg-gradient-to-br from-gray-50 to-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">Why Pet Insurance?</h3>
          <div className="space-y-3">
            {[
              { icon: '💰', title: 'Financial Protection', desc: 'Cover unexpected vet bills' },
              { icon: '🏥', title: 'Comprehensive Care', desc: 'Access to best treatments' },
              { icon: '❤️', title: 'Peace of Mind', desc: 'Focus on your pet\'s recovery' },
              { icon: '⚡', title: 'Quick Claims', desc: 'Fast reimbursement process' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Insurance Providers List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">Insurance Providers</h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : providers.length === 0 ? (
            <Card className="p-8 text-center">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">No Insurance Providers Found</h3>
              <p className="text-sm text-gray-500">Try adjusting your search or check back later</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {providers.map((provider, index) => (
                <Card 
                  key={provider.id || provider.vendorId || index} 
                  className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => handleProviderSelect(provider)}
                >
                  {/* Provider Image */}
                  <div className="h-48 bg-gradient-to-br from-blue-200 to-indigo-200 relative">
                    <div className="absolute inset-0 flex items-center justify-center text-6xl">
                      <Shield className="w-16 h-16 text-blue-600 opacity-30" />
                    </div>
                    <div className="absolute top-3 right-3 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                      <Star className="w-3 h-3 fill-white" />
                      {provider.rating || 4.7}
                    </div>
                  </div>

                  {/* Provider Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{provider.businessName || provider.name || 'Insurance Provider'}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                        <Heart className="w-4 h-4" />
                        <span>{provider.coverageType || 'Comprehensive Coverage'}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm">
                        <span className="text-gray-600">{provider.reviewsCount || 0} reviews</span>
                        {provider.startingFrom && (
                          <span className="text-blue-600 font-semibold">Starting from {provider.startingFrom}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProviderSelect(provider);
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white h-12 text-base font-semibold shadow-lg"
                    >
                      <Phone className="w-5 h-5 mr-2" />
                      Get Quote
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">
              💬
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-900 mb-1">Need Help Choosing?</h4>
              <p className="text-sm text-gray-600 mb-3">Our insurance experts can help you find the best plan for your pet.</p>
              <Button 
                variant="outline" 
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => {
                  if (onNavigate) onNavigate('insurance_policy_purchase', { consultation: true });
                }}
              >
                Schedule Consultation
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
