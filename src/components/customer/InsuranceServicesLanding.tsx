import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  ChevronRight,
  Phone,
  Heart,
  Zap,
  CheckCircle,
  Award,
  FileText
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
// Brand color: #FF8C42

interface InsuranceServicesLandingProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  customerId: string;
  phone: string;
}

export function InsuranceServicesLanding({ onBack, onNavigate, customerId, phone }: InsuranceServicesLandingProps) {
  const [loading, setLoading] = useState(true);
  const [featuredProviders, setFeaturedProviders] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadInsuranceData();
  }, []);

  const loadInsuranceData = async () => {
    try {
      setLoading(true);
      
      // Fetch services from backend with roleId filter
      const response = await fetch(
        `${API_BASE}/customer/services?roleId=pet_insurance`,
        { headers: { Authorization: `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('✅ [INSURANCE] Loaded services:', data);
        
        // Already filtered by roleId=pet_insurance on backend
        const insuranceServices = data.services || [];
        
        console.log(`✅ [INSURANCE] Found ${insuranceServices.length} insurance services from ${new Set(insuranceServices.map((s: any) => s.vendorId)).size} providers`);
        
        // Get unique vendors
        const vendorMap = new Map();
        insuranceServices.forEach((service: any) => {
          const vendorId = service.vendorId;
          if (!vendorMap.has(vendorId)) {
            vendorMap.set(vendorId, {
              id: vendorId,
              businessName: service.vendorName,
              rating: service.vendorRating || 4.7,
              completedPolicies: service.vendorReviewCount || 0,
              basePrice: service.price || 999
            });
          }
        });
        
        const allProviders = Array.from(vendorMap.values());
        setFeaturedProviders(allProviders.slice(0, 5));
        
        setStats({
          activeProviders: allProviders.length || 12,
          policiesIssued: '10K+',
          rating: allProviders.length > 0 
            ? (allProviders.reduce((acc: number, p: any) => acc + (p.rating || 4.7), 0) / allProviders.length).toFixed(1) 
            : '4.7'
        });
      } else {
        console.error('❌ [INSURANCE] Failed to load services:', response.status);
        setStats({
          activeProviders: 12,
          policiesIssued: '10K+',
          rating: '4.7'
        });
      }
    } catch (error) {
      console.error('❌ [INSURANCE] Error loading insurance data:', error);
      setStats({
        activeProviders: 12,
        policiesIssued: '10K+',
        rating: '4.7'
      });
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    {
      id: 'basic',
      name: 'Basic Plan',
      price: '₹999',
      period: '/year',
      features: [
        'Accident coverage up to ₹50K',
        'Emergency vet visits',
        'Basic vaccinations',
        '24/7 helpline support'
      ],
      color: 'cyan',
      popular: false
    },
    {
      id: 'premium',
      name: 'Premium Plan',
      price: '₹2,499',
      period: '/year',
      features: [
        'Comprehensive coverage ₹2L',
        'All medical treatments',
        'Surgery & hospitalization',
        'Wellness check-ups',
        'Vaccination coverage',
        'Lost pet finder'
      ],
      color: 'blue',
      popular: true
    },
    {
      id: 'elite',
      name: 'Elite Plan',
      price: '₹4,999',
      period: '/year',
      features: [
        'Complete coverage ₹5L',
        'Lifetime renewals',
        'Dental & optical care',
        'Alternative therapies',
        'International coverage',
        'Grooming & training benefits'
      ],
      color: 'purple',
      popular: false
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white max-w-md mx-auto">
      {/* Header with Concave Bottom Curve */}
      <div className="bg-gradient-to-br from-cyan-600 to-cyan-700 text-white px-6 pt-8 pb-16 relative">
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

      {/* Main Content */}
      <div className="px-6 pb-24">
        {/* Spotlight Offers */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-cyan-600" />
            <h2 className="text-lg font-semibold">Limited Time Offers</h2>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
            {/* New Pet Owner Offer */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-cyan-100 text-cyan-600 border-none mb-2">New Pet</Badge>
                  <div className="text-3xl font-bold text-cyan-600 mb-1">50% OFF</div>
                  <div className="text-gray-700 text-sm">First Year Premium</div>
                </div>
                <div className="p-3 bg-cyan-50 rounded-xl">
                  <Shield className="w-6 h-6 text-cyan-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm">
                  <span className="line-through text-gray-400">₹2999</span>
                  <span className="ml-2 font-bold text-lg text-gray-900">₹1499</span>
                </div>
                <Button 
                  size="sm" 
                  className="bg-cyan-600 text-white hover:bg-cyan-700 h-8"
                  onClick={() => onNavigate('insurance_provider')}
                >
                  Get Quote
                </Button>
              </div>
            </Card>

            {/* Multi-Pet Discount */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-orange-100 text-orange-600 border-none mb-2">Multi-Pet</Badge>
                  <div className="text-3xl font-bold text-orange-600 mb-1">30% OFF</div>
                  <div className="text-gray-700 text-sm">Additional Pets</div>
                </div>
                <div className="p-3 bg-orange-50 rounded-xl">
                  <Heart className="w-6 h-6 text-orange-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">Cover all your pets</div>
                <Button 
                  size="sm" 
                  className="bg-orange-600 text-white hover:bg-orange-700 h-8"
                  onClick={() => onNavigate('insurance_provider')}
                >
                  Get Quote
                </Button>
              </div>
            </Card>

            {/* Claim-Free Bonus */}
            <Card className="min-w-[280px] flex-shrink-0 bg-white border border-gray-100 p-5 shadow-sm">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge className="bg-green-100 text-green-600 border-none mb-2">Renewal</Badge>
                  <div className="text-3xl font-bold text-green-600 mb-1">FREE</div>
                  <div className="text-gray-700 text-sm">Health Check-up</div>
                </div>
                <div className="p-3 bg-green-50 rounded-xl">
                  <Award className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-600">On claim-free renewal</div>
                <Button 
                  size="sm" 
                  className="bg-green-600 text-white hover:bg-green-700 h-8"
                  onClick={() => onNavigate('insurance_provider')}
                >
                  Renew
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* Insurance Plans */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Choose Your Plan</h2>
          </div>
          
          <div className="space-y-3">
            {plans.map((plan) => (
              <Card
                key={plan.id}
                className={`p-5 cursor-pointer hover:shadow-lg transition-all bg-white border-2 ${
                  plan.popular ? 'border-blue-500 shadow-md' : 'border-gray-100'
                }`}
                onClick={() => onNavigate('insurance_provider', { planId: plan.id })}
              >
                {plan.popular && (
                  <Badge className="bg-blue-600 text-white border-none mb-3">
                    Most Popular
                  </Badge>
                )}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-sm text-gray-500">{plan.period}</span>
                    </div>
                  </div>
                  <div className={`w-12 h-12 bg-${plan.color}-100 rounded-xl flex items-center justify-center`}>
                    <Shield className={`w-6 h-6 text-${plan.color}-600`} />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <Button 
                  className={`w-full bg-${plan.color}-600 text-white hover:bg-${plan.color}-700`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate('insurance_provider', { planId: plan.id });
                  }}
                >
                  Get This Plan
                </Button>
              </Card>
            ))}
          </div>
        </div>

        {/* Featured Providers */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Trusted Providers</h2>
            <button 
              className="text-sm text-cyan-600 flex items-center gap-1"
              onClick={() => onNavigate('insurance_provider')}
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="space-y-3">
            {featuredProviders.length > 0 ? (
              featuredProviders.slice(0, 3).map((provider, index) => (
                <Card 
                  key={index}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('insurance_provider')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      {provider.businessName?.charAt(0) || 'I'}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{provider.businessName || 'Insurance Provider'}</h3>
                      <p className="text-xs text-gray-500 mb-2">IRDAI Licensed • Quick Claims</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">{provider.rating || 4.7}</span>
                          <span className="text-gray-400">({provider.completedPolicies || 0})</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-600">
                          <Zap className="w-3 h-3" />
                          <span>Fast Claim Settlement</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-cyan-600">₹{provider.basePrice || 999}</div>
                      <div className="text-xs text-gray-400">starting</div>
                    </div>
                  </div>
                </Card>
              ))
            ) : (
              // Placeholder providers
              [
                { name: 'PetCare Insurance', policies: 2500 },
                { name: 'PawProtect Insurance', policies: 1800 },
                { name: 'FurryGuard Insurance', policies: 3200 }
              ].map((provider, i) => (
                <Card 
                  key={i}
                  className="p-4 cursor-pointer hover:shadow-md transition-all bg-white border border-gray-100 shadow-sm"
                  onClick={() => onNavigate('insurance_provider')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-600 to-cyan-700 rounded-xl flex items-center justify-center text-white text-xl font-bold">
                      {provider.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold mb-1">{provider.name}</h3>
                      <p className="text-xs text-gray-500 mb-2">IRDAI Licensed • Quick Claims</p>
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1 text-amber-500">
                          <Star className="w-3 h-3 fill-current" />
                          <span className="font-semibold">4.7</span>
                          <span className="text-gray-400">({provider.policies})</span>
                        </div>
                        <div className="flex items-center gap-1 text-green-600">
                          <Zap className="w-3 h-3" />
                          <span>Fast Claim Settlement</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-cyan-600">₹{999 + i * 500}</div>
                      <div className="text-xs text-gray-400">starting</div>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Why Insurance */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-cyan-600" />
            <h2 className="text-lg font-semibold">Why Pet Insurance?</h2>
          </div>
          
          <div className="space-y-3">
            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Shield className="w-5 h-5 text-cyan-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Financial Protection</h3>
                  <p className="text-sm text-gray-600">Cover unexpected vet bills & emergencies</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Heart className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Peace of Mind</h3>
                  <p className="text-sm text-gray-600">Focus on care, not costs during emergencies</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Easy Claims</h3>
                  <p className="text-sm text-gray-600">Quick approval & cashless treatments</p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white border border-gray-100 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">24/7 Support</h3>
                  <p className="text-sm text-gray-600">Expert guidance anytime you need it</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
