"use client";

import { useState, useEffect } from 'react';
import { ArrowLeft, Shield, CheckCircle2, Star, TrendingUp, Sparkles, Phone, Mail, FileText, Copy, Download, AlertCircle, Info, Dog, Cat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { mergeCustomerVendorServicesPayload } from '@/lib/customer-vendor-services-merge';
import { toast } from 'sonner';
import { UniversalPaymentPage } from '../payment/UniversalPaymentPage';
import { catalogPriceIncludesTax } from '@/lib/booking-display-utils';
import { formatRatingNumberOrDash } from '@/lib/rating-display';
import { downloadBlob, getDownloadMessage } from '@/lib/download-file';

interface InsuranceProviderProps {
  phone?: string;
  customerPhone?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (policyId?: string) => void;
}

interface Pet {
  id: string;
  name: string;
  species: string;
  breed: string;
  age?: number;
}

export function InsuranceProvider(props: InsuranceProviderProps) {
  const phone = props.phone || props.customerPhone || '';
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const [step, setStep] = useState<'plans' | 'details' | 'pet' | 'payment' | 'issued'>('plans');
  const [policyData, setPolicyData] = useState<any>(null);
  const [showPaymentPage, setShowPaymentPage] = useState(false);
  const [customerId, setCustomerId] = useState<string | null>(null);

  useEffect(() => {
    loadProviderData();
    loadPets();
    loadCustomerId();
  }, [props.vendorId, phone]);

  const loadCustomerId = async () => {
    try {
      const profileResponse = await apiClient.get<any>(`/customer/profile?phone=${encodeURIComponent(phone)}`);
      if (profileResponse?.profile?.id || profileResponse?.id) {
        setCustomerId(profileResponse?.profile?.id || profileResponse?.id);
      }
    } catch (err) {
      console.log('Could not get customer ID');
    }
  };

  const loadPets = async () => {
    try {
      const petsResponse = await apiClient.get<any>(`/customer/pets/${phone}`);
      if (petsResponse.pets && petsResponse.pets.length > 0) {
        setPets(petsResponse.pets.map((p: any) => ({
          id: p.id,
          name: p.name,
          species: p.species || p.type,
          breed: p.breed,
          age: p.age,
        })));
      }
    } catch (error) {
      console.error('Error loading pets:', error);
    }
  };

  const loadProviderData = async () => {
    try {
      setLoading(true);
      
      // Load provider details
      if (props.vendorId) {
        const providerData = await apiClient.get<any>(`/customer/vendor/${props.vendorId}`);
        setProvider(providerData.vendor || providerData);
      }
      
      // Load insurance plans
      const plansData = await apiClient.get<any>(`/customer/vendor/${props.vendorId}/services?category=insurance`);
      const plansList =
        Array.isArray(plansData?.services) || Array.isArray(plansData?.packages)
          ? mergeCustomerVendorServicesPayload(plansData)
          : plansData.plans || [];
      
      // If no plans from API, use default plans
      if (plansList.length === 0) {
        setPlans([
          {
            id: 'basic',
            name: 'Basic Coverage',
            price: 299,
            period: 'month',
            features: ['Accident coverage', 'Basic illness', 'Annual limit: ₹50,000', '24/7 helpline'],
            coverage: '₹50,000',
            deductible: '₹2,000'
          },
          {
            id: 'comprehensive',
            name: 'Comprehensive',
            price: 599,
            period: 'month',
            features: ['Full accident & illness', 'Preventive care', 'Annual limit: ₹2,00,000', 'Wellness visits', 'Dental coverage'],
            coverage: '₹2,00,000',
            deductible: '₹1,500',
            popular: true
          },
          {
            id: 'premium',
            name: 'Premium',
            price: 999,
            period: 'month',
            features: ['Everything in Comprehensive', 'No annual limit', 'Emergency care', 'Dental coverage', 'Alternative therapies'],
            coverage: 'Unlimited',
            deductible: '₹1,000'
          }
        ]);
      } else {
        setPlans(plansList);
      }
    } catch (error: any) {
      console.error('Error loading insurance provider:', error);
      toast.error('Failed to load insurance plans');
      
      // Fallback plans
      setPlans([
        {
          id: 'basic',
          name: 'Basic Coverage',
          price: 299,
          period: 'month',
          features: ['Accident coverage', 'Basic illness', 'Annual limit: ₹50,000'],
          coverage: '₹50,000'
        },
        {
          id: 'comprehensive',
          name: 'Comprehensive',
          price: 599,
          period: 'month',
          features: ['Full accident & illness', 'Preventive care', 'Annual limit: ₹2,00,000'],
          coverage: '₹2,00,000',
          popular: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanSelect = (plan: any) => {
    setSelectedPlan(plan);
    setStep('details');
  };

  const handleProceedToPetSelection = () => {
    if (!selectedPlan) return;
    // Check if pet is required based on plan
    if (pets.length > 0) {
      setStep('pet');
    } else {
      // Skip pet selection if no pets, or proceed to payment
      setStep('payment');
    }
  };

  const handleProceedToPayment = () => {
    if (!selectedPlan || !selectedPet) {
      toast.error('Please select a pet for the policy');
      return;
    }
    setShowPaymentPage(true);
  };

  const handlePaymentSuccess = async (bookingId: string, orderId?: string) => {
    try {
      // Create policy after payment success
      if (!selectedPet) {
        toast.error('Please select a pet for the policy');
        return;
      }
      const policyPayload = {
        vendorId: props.vendorId,
        planId: selectedPlan.id,
        customerId: customerId,
        customerPhone: phone,
        petId: selectedPet.id,
        planName: selectedPlan.name,
        price: selectedPlan.price,
        period: selectedPlan.period || 'month',
        coverage: selectedPlan.coverage,
        deductible: selectedPlan.deductible,
        bookingId: bookingId,
        orderId: orderId,
      };

      const response = await apiClient.post<any>('/customer/insurance/purchase', policyPayload);
      
      if (response.success || response.policyId || response.policy) {
        const policy = response.policy || {
          id: response.policyId || `POL-${Date.now()}`,
          policyNumber: response.policyNumber || `POL-${Date.now()}`,
          planName: selectedPlan.name,
          price: selectedPlan.price,
          period: selectedPlan.period || 'month',
          coverage: selectedPlan.coverage,
          petName: selectedPet.name,
          issuedDate: new Date().toISOString(),
          status: 'active',
          providerName: provider?.businessName || provider?.name || 'Insurance Provider',
          providerPhone: provider?.phone || '',
          providerEmail: provider?.email || '',
        };
        
        setPolicyData(policy);
        setShowPaymentPage(false);
        setStep('issued');
        toast.success('Insurance policy issued successfully!');
        
        if (props.onSuccess) {
          props.onSuccess(policy.id);
        }
      } else {
        toast.error('Failed to issue policy');
      }
    } catch (error: any) {
      console.error('Policy issuance error:', error);
      toast.error(error.message || 'Failed to issue policy');
    }
  };

  const copyPolicyNumber = () => {
    if (policyData?.policyNumber) {
      navigator.clipboard.writeText(policyData.policyNumber);
      toast.success('Policy number copied!');
    }
  };

  const downloadPolicy = async () => {
    const policyDoc = `
INSURANCE POLICY DOCUMENT

Policy Number: ${policyData?.policyNumber}
Issued Date: ${new Date(policyData?.issuedDate).toLocaleDateString()}
Status: ${policyData?.status?.toUpperCase()}

Provider: ${policyData?.providerName}
Plan: ${policyData?.planName}
Pet: ${policyData?.petName}

Coverage: ₹${policyData?.coverage}
Premium: ₹${policyData?.price}/${policyData?.period}
Deductible: ₹${selectedPlan?.deductible}

Contact Support:
Phone: ${policyData?.providerPhone}
Email: ${policyData?.providerEmail}

This is a digital policy document. Please keep this for your records.
    `;
    
    const blob = new Blob([policyDoc], { type: 'text/plain' });
    const { saveResult } = await downloadBlob({
      blob,
      fileName: `policy-${policyData?.policyNumber}.txt`,
      title: 'Insurance policy',
      previewHtmlInBrowser: false,
    });
    if (saveResult === 'failed') {
      toast.error(getDownloadMessage(saveResult, 'policy document'));
    } else {
      toast.success(getDownloadMessage(saveResult, 'policy document'));
    }
  };

  if (loading && !provider) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center max-w-md mx-auto">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent"></div>
      </div>
    );
  }

  if (step === 'payment' && showPaymentPage && selectedPlan && selectedPet) {
    return (
      <UniversalPaymentPage
        type="booking"
        serviceId={selectedPlan.id}
        serviceName={`${selectedPlan.name} - Insurance Policy`}
        serviceDescription={`Insurance policy for ${selectedPet.name}`}
        serviceStyle="product"
        category="insurance"
        vendorId={props.vendorId || ''}
        vendorName={provider?.businessName || provider?.name || 'Insurance Provider'}
        petId={selectedPet.id}
        petName={selectedPet.name}
        petBreed={selectedPet.breed}
        baseAmount={selectedPlan.price}
        priceIncludesTax={catalogPriceIncludesTax(selectedPlan)}
        duration={0}
        quantity={1}
        customerPhone={phone}
        customerId={customerId || undefined}
        onBack={() => setShowPaymentPage(false)}
        onSuccess={handlePaymentSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 to-orange-600 max-w-md mx-auto pb-24">
      {/* Header with ORANGE gradient theme matching InsuranceServicesLanding */}
      <div className="px-6 cw-header-safe-top pb-6">
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={props.onBack}
            className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-white">
              {provider?.businessName || provider?.name || 'Insurance Provider'}
            </h1>
            <p className="text-white/80 text-sm mt-1">Select your insurance plan</p>
          </div>
        </div>

        {/* Provider Stats */}
        {provider && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold text-white">{formatRatingNumberOrDash(provider.rating)}</div>
              <div className="text-white/80 text-xs">Rating</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold text-white">{provider.policiesIssued || '2K+'}</div>
              <div className="text-white/80 text-xs">Policies</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/20">
              <div className="text-2xl font-bold text-white">24/7</div>
              <div className="text-white/80 text-xs">Support</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content - White Card with Top Radius */}
      <div className="bg-white rounded-t-[32px] px-6 pt-8 min-h-[calc(100vh-280px)]">
        {step === 'plans' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Available Plans</h2>
            
            {plans.map((plan) => (
              <Card 
                key={plan.id}
                className={`p-5 border-2 cursor-pointer transition-all hover:shadow-lg ${
                  plan.popular 
                    ? 'border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100' 
                    : 'border-gray-200 hover:border-orange-200'
                }`}
                onClick={() => handlePlanSelect(plan)}
              >
                {plan.popular && (
                  <Badge className="mb-3 bg-orange-500 text-white">Most Popular</Badge>
                )}
                
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Coverage: {plan.coverage || '₹50,000'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-600">
                      ₹{plan.price}
                    </div>
                    <div className="text-xs text-gray-500">/{plan.period || 'month'}</div>
                  </div>
                </div>

                <ul className="space-y-2 mt-4">
                  {plan.features?.slice(0, 4).map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  className="w-full mt-4 bg-orange-500 hover:bg-orange-600 text-white"
                  onClick={() => handlePlanSelect(plan)}
                >
                  Select Plan
                </Button>
              </Card>
            ))}
          </div>
        )}

        {step === 'details' && selectedPlan && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <button 
                onClick={() => setStep('plans')}
                className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-bold text-gray-900">Plan Details</h2>
            </div>

            <Card className="p-6 border-2 border-orange-500 bg-gradient-to-br from-orange-50 to-orange-100">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">{selectedPlan.name}</h3>
                  <p className="text-gray-600 mt-1">Coverage: ₹{typeof selectedPlan.coverage === 'number' ? selectedPlan.coverage.toLocaleString() : selectedPlan.coverage || '₹50,000'}</p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-orange-600">
                    ₹{selectedPlan.price}
                  </div>
                  <div className="text-sm text-gray-500">/{selectedPlan.period || 'month'}</div>
                </div>
              </div>

              {selectedPlan.popular && (
                <Badge className="mb-4 bg-orange-500 text-white">Most Popular</Badge>
              )}

              <div className="space-y-3 mt-6">
                <h4 className="font-semibold text-gray-900">What's Included:</h4>
                <ul className="space-y-2">
                  {selectedPlan.features?.map((feature: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 space-y-2">
                {selectedPlan.deductible && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>Deductible:</strong> ₹{selectedPlan.deductible} per claim
                    </p>
                  </div>
                )}
                
                {selectedPlan.waitingPeriod && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-800">
                      <strong>Waiting Period:</strong> {selectedPlan.waitingPeriod} days
                    </p>
                  </div>
                )}

                {(selectedPlan.minAge || selectedPlan.maxAge) && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-purple-800">
                      <strong>Age Range:</strong> {selectedPlan.minAge || 0} - {selectedPlan.maxAge || 15} years
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-gray-600 mt-0.5" />
                  <p className="text-xs text-gray-600">
                    Please review all terms and conditions. Coverage begins after the waiting period.
                  </p>
                </div>
              </div>
            </Card>

            <Button 
              className="w-full h-14 text-lg bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white"
              onClick={handleProceedToPetSelection}
              disabled={loading}
            >
              Continue to Pet Selection
            </Button>
          </div>
        )}

        {step === 'pet' && selectedPlan && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <button 
                onClick={() => setStep('details')}
                className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center hover:bg-gray-200"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h2 className="text-xl font-bold text-gray-900">Select Pet for Policy</h2>
            </div>

            {pets.length > 0 ? (
              <div className="space-y-3">
                {pets.map((pet) => {
                  const isEligible = (!selectedPlan.minAge || (pet.age || 0) >= selectedPlan.minAge) &&
                                     (!selectedPlan.maxAge || (pet.age || 0) <= selectedPlan.maxAge);
                  
                  return (
                    <Card
                      key={pet.id}
                      className={`p-4 border-2 cursor-pointer transition-all ${
                        selectedPet?.id === pet.id
                          ? 'border-orange-500 bg-orange-50'
                          : isEligible
                          ? 'border-gray-200 hover:border-orange-200'
                          : 'border-gray-200 opacity-50'
                      }`}
                      onClick={() => isEligible && setSelectedPet(pet)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center">
                          {pet.species?.toLowerCase().includes('dog') ? (
                            <Dog className="w-7 h-7 text-orange-600" />
                          ) : pet.species?.toLowerCase().includes('cat') ? (
                            <Cat className="w-7 h-7 text-orange-600" />
                          ) : (
                            <Shield className="w-7 h-7 text-orange-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{pet.name}</h3>
                          <p className="text-sm text-gray-500">{pet.breed}</p>
                          {pet.age !== undefined && (
                            <p className="text-xs text-gray-400">{pet.age} years old</p>
                          )}
                        </div>
                        {!isEligible && (
                          <Badge variant="outline" className="text-red-600">Not Eligible</Badge>
                        )}
                        {selectedPet?.id === pet.id && (
                          <CheckCircle2 className="w-6 h-6 text-orange-500" />
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">No pets added yet</p>
                <Button
                  variant="outline"
                  onClick={() => props.onNavigate?.('add-pet', {})}
                >
                  Add Pet
                </Button>
              </Card>
            )}

            <Button 
              className="w-full h-14 text-lg bg-gradient-to-r from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800 text-white"
              onClick={handleProceedToPayment}
              disabled={!selectedPet || loading}
            >
              {selectedPet ? `Continue to Payment - ₹${selectedPlan.price}/${selectedPlan.period || 'month'}` : 'Select a Pet to Continue'}
            </Button>
          </div>
        )}

        {step === 'issued' && policyData && (
          <div className="space-y-6 py-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Policy Issued Successfully!</h2>
              <p className="text-gray-600">Your insurance policy is now active</p>
            </div>

            {/* Policy Details Card */}
            <Card className="p-6 border-2 border-green-500 bg-gradient-to-br from-green-50 to-green-100">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b">
                  <span className="text-gray-600">Policy Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg text-gray-900">{policyData.policyNumber}</span>
                    <button
                      onClick={copyPolicyNumber}
                      className="p-1 hover:bg-white/50 rounded"
                      title="Copy policy number"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Plan</p>
                    <p className="font-semibold text-gray-900">{policyData.planName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Pet</p>
                    <p className="font-semibold text-gray-900">{policyData.petName}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Premium</p>
                    <p className="font-semibold text-gray-900">₹{policyData.price}/{policyData.period}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Coverage</p>
                    <p className="font-semibold text-gray-900">₹{typeof policyData.coverage === 'number' ? policyData.coverage.toLocaleString() : policyData.coverage}</p>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-sm text-gray-600">Issued Date</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(policyData.issuedDate).toLocaleDateString('en-IN', { 
                      day: 'numeric', 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </p>
                </div>

                <div className="pt-3 border-t">
                  <Badge className="bg-green-500 text-white">Active</Badge>
                </div>
              </div>
            </Card>

            {/* Post-Policy Support Section - Like PolicyBazaar */}
            <Card className="p-6 bg-blue-50 border border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-blue-600" />
                Support & Contact
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Provider</span>
                  <span className="font-medium text-gray-900">{policyData.providerName}</span>
                </div>
                {policyData.providerPhone && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Phone</span>
                    <a 
                      href={`tel:${policyData.providerPhone}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {policyData.providerPhone}
                    </a>
                  </div>
                )}
                {policyData.providerEmail && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Email</span>
                    <a 
                      href={`mailto:${policyData.providerEmail}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {policyData.providerEmail}
                    </a>
                  </div>
                )}
              </div>
            </Card>

            {/* Important Information */}
            <Card className="p-6 bg-amber-50 border border-amber-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">Important Information</h4>
                  <ul className="space-y-1 text-sm text-gray-700">
                    <li>• Save your policy number for future reference</li>
                    <li>• Coverage begins after waiting period ({selectedPlan?.waitingPeriod || 30} days)</li>
                    <li>• Keep this document safe for claims processing</li>
                    <li>• Contact support for any queries or claims</li>
                  </ul>
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Button 
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                onClick={downloadPolicy}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Policy Document
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                onClick={() => props.onNavigate?.('my-policies', {})}
              >
                <FileText className="w-4 h-4 mr-2" />
                View My Policies
              </Button>
              <Button 
                variant="outline"
                className="w-full"
                onClick={props.onBack}
              >
                Back to Home
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
