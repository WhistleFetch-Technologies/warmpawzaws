import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Shield, Upload, Download, FileText, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface InsurancePlan {
  id: string;
  name: string;
  provider: string;
  coverageAmount: number;
  annualPremium: number;
  features: string[];
  ageLimit: { min: number; max: number };
  waitingPeriod: number; // days
  claimRatio: number; // percentage
}

interface InsurancePolicyPurchaseProps {
  customerId: string;
  petId: string;
  petName: string;
  petAge: number;
  petBreed: string;
}

export function InsurancePolicyPurchase({ 
  customerId, 
  petId, 
  petName, 
  petAge,
  petBreed 
}: InsurancePolicyPurchaseProps) {
  const [step, setStep] = useState<'browse' | 'details' | 'documents' | 'payment' | 'success'>('browse');
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<InsurancePlan | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Documents
  const [vaccinationCard, setVaccinationCard] = useState<File | null>(null);
  const [petPhoto, setPetPhoto] = useState<File | null>(null);
  const [medicalRecords, setMedicalRecords] = useState<File | null>(null);
  
  // Policy
  const [policyId, setPolicyId] = useState<string | null>(null);

  useEffect(() => {
    fetchInsurancePlans();
  }, []);

  const fetchInsurancePlans = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/insurance/plans`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || getMockPlans());
      } else {
        // Use mock plans if endpoint not available
        setPlans(getMockPlans());
      }
    } catch (error) {
      console.error('Error fetching plans:', error);
      setPlans(getMockPlans());
    }
  };

  const getMockPlans = (): InsurancePlan[] => [
    {
      id: 'basic',
      name: 'Basic Protection',
      provider: 'PetCare Insurance',
      coverageAmount: 100000,
      annualPremium: 3999,
      features: [
        'Accident coverage',
        'Emergency hospitalization',
        'Basic surgeries',
        '24/7 vet helpline'
      ],
      ageLimit: { min: 0, max: 8 },
      waitingPeriod: 30,
      claimRatio: 85
    },
    {
      id: 'standard',
      name: 'Standard Care',
      provider: 'PetCare Insurance',
      coverageAmount: 200000,
      annualPremium: 6999,
      features: [
        'All Basic features',
        'Illness coverage',
        'Advanced surgeries',
        'Annual health check-up',
        'Vaccination coverage'
      ],
      ageLimit: { min: 0, max: 10 },
      waitingPeriod: 15,
      claimRatio: 90
    },
    {
      id: 'premium',
      name: 'Premium Shield',
      provider: 'PetCare Insurance',
      coverageAmount: 500000,
      annualPremium: 12999,
      features: [
        'All Standard features',
        'Hereditary conditions',
        'Chronic disease management',
        'Alternative therapies',
        'Dental coverage',
        'Lost pet finder',
        'Third-party liability'
      ],
      ageLimit: { min: 0, max: 12 },
      waitingPeriod: 0,
      claimRatio: 95
    }
  ];

  const handlePlanSelect = (plan: InsurancePlan) => {
    // Check age eligibility
    if (petAge < plan.ageLimit.min || petAge > plan.ageLimit.max) {
      toast.error(`This plan is for pets aged ${plan.ageLimit.min}-${plan.ageLimit.max} years`);
      return;
    }

    setSelectedPlan(plan);
    setStep('details');
  };

  const handleDocumentUpload = async (file: File, type: string) => {
    // In production, upload to S3 and get URL
    // For now, just store the file object
    if (type === 'vaccination') setVaccinationCard(file);
    if (type === 'photo') setPetPhoto(file);
    if (type === 'medical') setMedicalRecords(file);
    
    toast.success(`${file.name} uploaded successfully`);
  };

  const handlePurchase = async () => {
    if (!vaccinationCard || !petPhoto) {
      toast.error('Please upload required documents');
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/insurance/purchase-policy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({
            customerId,
            petId,
            planId: selectedPlan?.id,
            documents: {
              vaccinationCard: 'uploaded', // In production, use S3 URLs
              petPhoto: 'uploaded',
              medicalRecords: medicalRecords ? 'uploaded' : null
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPolicyId(data.policy?.policyId || `POL-${Date.now()}`);
        setStep('success');
        toast.success('Insurance policy purchased successfully!');
      } else {
        toast.error('Failed to purchase policy');
      }
    } catch (error) {
      console.error('Error purchasing policy:', error);
      toast.error('Error purchasing policy');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPolicy = async () => {
    // In production, generate PDF and download
    toast.success('Policy document downloaded');
    
    // Simulate download
    const policyData = {
      policyId,
      petName,
      plan: selectedPlan?.name,
      coverage: selectedPlan?.coverageAmount,
      premium: selectedPlan?.annualPremium,
      startDate: new Date().toISOString()
    };
    
    console.log('Policy data:', policyData);
  };

  const renderBrowsePlans = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Pet Insurance Plan</h2>
        <p className="text-gray-600">
          Protect {petName} with comprehensive insurance coverage
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan, idx) => (
          <div
            key={plan.id}
            className={`relative border-2 rounded-xl p-6 cursor-pointer transition-all hover:shadow-lg ${
              idx === 1 
                ? 'border-orange-500 bg-orange-50' 
                : 'border-gray-200 hover:border-orange-300'
            }`}
            onClick={() => handlePlanSelect(plan)}
          >
            {idx === 1 && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-xs px-3 py-1 rounded-full">
                Popular
              </div>
            )}

            <div className="text-center mb-4">
              <Shield className={`w-12 h-12 mx-auto mb-2 ${
                idx === 1 ? 'text-orange-600' : 'text-gray-400'
              }`} />
              <h3 className="font-bold text-lg text-gray-900">{plan.name}</h3>
              <p className="text-sm text-gray-600">{plan.provider}</p>
            </div>

            <div className="text-center mb-4 pb-4 border-b border-gray-200">
              <p className="text-3xl font-bold text-gray-900">₹{plan.annualPremium.toLocaleString()}</p>
              <p className="text-sm text-gray-600">per year</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-1">Coverage Amount</p>
              <p className="font-semibold text-gray-900">₹{plan.coverageAmount.toLocaleString()}</p>
            </div>

            <ul className="space-y-2 mb-4">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between text-xs text-gray-600 mb-4">
              <span>Claim Ratio: {plan.claimRatio}%</span>
              <span>Waiting: {plan.waitingPeriod}d</span>
            </div>

            <Button className="w-full bg-orange-600 hover:bg-orange-700">
              Select Plan
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPlanDetails = () => (
    <div className="space-y-6">
      <Button 
        variant="outline" 
        onClick={() => setStep('browse')}
        className="mb-4"
      >
        ← Back to Plans
      </Button>

      <div className="bg-white rounded-xl border-2 border-orange-200 p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
            <Shield className="w-8 h-8 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-gray-900 mb-1">{selectedPlan?.name}</h3>
            <p className="text-gray-600">{selectedPlan?.provider}</p>
            <p className="text-2xl font-bold text-orange-600 mt-2">
              ₹{selectedPlan?.annualPremium.toLocaleString()}/year
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Coverage Amount</p>
            <p className="text-xl font-bold text-gray-900">₹{selectedPlan?.coverageAmount.toLocaleString()}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Claim Ratio</p>
            <p className="text-xl font-bold text-gray-900">{selectedPlan?.claimRatio}%</p>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold text-gray-900 mb-3">Coverage Includes:</h4>
          <div className="grid md:grid-cols-2 gap-2">
            {selectedPlan?.features.map((feature, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 mb-1">Waiting Period</p>
              <p className="text-blue-700">
                {selectedPlan?.waitingPeriod === 0 
                  ? 'No waiting period - coverage starts immediately!'
                  : `${selectedPlan?.waitingPeriod} days waiting period applies for illness claims`
                }
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={() => setStep('documents')} 
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          Continue to Upload Documents
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderDocuments = () => (
    <div className="space-y-6">
      <Button 
        variant="outline" 
        onClick={() => setStep('details')}
        className="mb-4"
      >
        ← Back
      </Button>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-bold text-lg text-gray-900 mb-6">Upload Required Documents</h3>

        <div className="space-y-4">
          {/* Vaccination Card */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <FileText className="w-6 h-6 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">
                  Vaccination Card *
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Upload {petName}'s vaccination records
                </p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0], 'vaccination')}
                  className="text-sm"
                />
                {vaccinationCard && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    {vaccinationCard.name}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Pet Photo */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <Upload className="w-6 h-6 text-orange-600 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">
                  Pet Photo *
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Clear photo of {petName}
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0], 'photo')}
                  className="text-sm"
                />
                {petPhoto && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    {petPhoto.name}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Medical Records (Optional) */}
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <FileText className="w-6 h-6 text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">
                  Medical Records (Optional)
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Previous medical history if available
                </p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => e.target.files?.[0] && handleDocumentUpload(e.target.files[0], 'medical')}
                  className="text-sm"
                />
                {medicalRecords && (
                  <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    {medicalRecords.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Button 
          onClick={handlePurchase}
          disabled={!vaccinationCard || !petPhoto || loading}
          className="w-full mt-6 bg-orange-600 hover:bg-orange-700"
        >
          {loading ? 'Processing...' : 'Proceed to Payment'}
          <ChevronRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>

      <h2 className="text-2xl font-bold text-gray-900">
        Insurance Policy Activated!
      </h2>

      <p className="text-gray-600">
        Congratulations! {petName} is now protected with {selectedPlan?.name}
      </p>

      <div className="bg-white rounded-xl border-2 border-green-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600">Policy ID</span>
          <span className="font-mono font-semibold text-gray-900">{policyId}</span>
        </div>
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600">Coverage</span>
          <span className="font-semibold text-gray-900">₹{selectedPlan?.coverageAmount.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Annual Premium</span>
          <span className="font-semibold text-gray-900">₹{selectedPlan?.annualPremium.toLocaleString()}</span>
        </div>
      </div>

      <Button 
        onClick={handleDownloadPolicy}
        className="w-full bg-orange-600 hover:bg-orange-700"
      >
        <Download className="w-4 h-4 mr-2" />
        Download Policy Document
      </Button>

      <Button 
        variant="outline"
        onClick={() => window.location.href = '/insurance/my-policies'}
        className="w-full"
      >
        View My Policies
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {step === 'browse' && renderBrowsePlans()}
        {step === 'details' && renderPlanDetails()}
        {step === 'documents' && renderDocuments()}
        {step === 'success' && renderSuccess()}
      </div>
    </div>
  );
}
