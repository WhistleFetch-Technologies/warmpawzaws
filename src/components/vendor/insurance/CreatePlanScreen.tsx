import { useState } from 'react';
import { ArrowLeft, Shield, Info, CheckCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card } from '../../ui/card';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface PlanFormData {
  planName: string;
  petType: string;
  coverageAmount: number;
  premium: number;
  coveragePercentage: number;
  claimTurnaroundDays: number;
  description: string;
  inclusions: string[];
  exclusions: string[];
  ageLimit: {
    min: number;
    max: number;
  };
  waitingPeriod: number;
  renewalBenefit: string;
}

export function CreatePlanScreen({ 
  vendorId,
  onBack,
  onSuccess 
}: { 
  vendorId: string;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<PlanFormData>({
    planName: '',
    petType: 'dog',
    coverageAmount: 0,
    premium: 0,
    coveragePercentage: 80,
    claimTurnaroundDays: 7,
    description: '',
    inclusions: [],
    exclusions: [],
    ageLimit: { min: 0, max: 15 },
    waitingPeriod: 30,
    renewalBenefit: ''
  });

  const [inclusion, setInclusion] = useState('');
  const [exclusion, setExclusion] = useState('');

  const handleAddInclusion = () => {
    if (inclusion.trim()) {
      setFormData(prev => ({
        ...prev,
        inclusions: [...prev.inclusions, inclusion.trim()]
      }));
      setInclusion('');
    }
  };

  const handleRemoveInclusion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      inclusions: prev.inclusions.filter((_, i) => i !== index)
    }));
  };

  const handleAddExclusion = () => {
    if (exclusion.trim()) {
      setFormData(prev => ({
        ...prev,
        exclusions: [...prev.exclusions, exclusion.trim()]
      }));
      setExclusion('');
    }
  };

  const handleRemoveExclusion = (index: number) => {
    setFormData(prev => ({
      ...prev,
      exclusions: prev.exclusions.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/vendor/${vendorId}/insurance/plans`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      );

      if (response.ok) {
        alert('✅ Plan submitted for admin approval!');
        onSuccess();
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error creating plan:', error);
      alert('Failed to create plan. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FF8C42] gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-[#FF8C42] gradient-to-r from-blue-600 to-indigo-600 p-4 text-white sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <Button onClick={onBack} className="p-2 hover:bg-[#FF8C42] white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Create Insurance Plan</h1>
            <p className="text-xs text-blue-100">Step {step} of 3</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${
                s <= step ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4 pb-24">
        {/* Step 1: Basic Details */}
        {step === 1 && (
          <div className="space-y-4">
            <Card className="p-4 bg-[#FF8C42] blue-50 border-blue-200">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm">Plan Information</h3>
                  <p className="text-xs text-blue-700 mt-1">
                    Provide basic details about your insurance plan. This will be reviewed by admin before going live.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-4">
                <div>
                  <Label>Plan Name *</Label>
                  <Input
                    placeholder="e.g., Premium Health Insurance - Dogs"
                    value={formData.planName}
                    onChange={e => setFormData(prev => ({ ...prev, planName: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Pet Type *</Label>
                  <Select 
                    value={formData.petType}
                    onValueChange={value => setFormData(prev => ({ ...prev, petType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dog">Dogs</SelectItem>
                      <SelectItem value="cat">Cats</SelectItem>
                      <SelectItem value="both">Both Dogs & Cats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Plan Description *</Label>
                  <Textarea
                    placeholder="Describe the plan benefits and features..."
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Min Age (months)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData.ageLimit.min}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        ageLimit: { ...prev.ageLimit, min: parseInt(e.target.value) || 0 }
                      }))}
                    />
                  </div>
                  <div>
                    <Label>Max Age (years)</Label>
                    <Input
                      type="number"
                      placeholder="15"
                      value={formData.ageLimit.max}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        ageLimit: { ...prev.ageLimit, max: parseInt(e.target.value) || 15 }
                      }))}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Button
              onClick={() => setStep(2)}
              disabled={!formData.planName || !formData.description}
              className="w-full bg-blue-600 hover:bg-[#FF8C42] blue-700"
            >
              Next: Coverage & Premium
            </Button>
          </div>
        )}

        {/* Step 2: Coverage & Premium */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="p-4 bg-[#FF8C42] blue-50 border-blue-200">
              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm">Coverage Details</h3>
                  <p className="text-xs text-blue-700 mt-1">
                    Define the coverage amount, premium, and claim processing details.
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="space-y-4">
                <div>
                  <Label>Coverage Amount (₹) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 200000"
                    value={formData.coverageAmount}
                    onChange={e => setFormData(prev => ({ ...prev, coverageAmount: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">Maximum claim amount per year</p>
                </div>

                <div>
                  <Label>Annual Premium (₹) *</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 12000"
                    value={formData.premium}
                    onChange={e => setFormData(prev => ({ ...prev, premium: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">Yearly premium amount</p>
                </div>

                <div>
                  <Label>Coverage Percentage *</Label>
                  <Input
                    type="number"
                    placeholder="80"
                    min="0"
                    max="100"
                    value={formData.coveragePercentage}
                    onChange={e => setFormData(prev => ({ ...prev, coveragePercentage: parseInt(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">% of eligible expenses covered</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Claim TAT (days)</Label>
                    <Input
                      type="number"
                      placeholder="7"
                      value={formData.claimTurnaroundDays}
                      onChange={e => setFormData(prev => ({ ...prev, claimTurnaroundDays: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Waiting Period (days)</Label>
                    <Input
                      type="number"
                      placeholder="30"
                      value={formData.waitingPeriod}
                      onChange={e => setFormData(prev => ({ ...prev, waitingPeriod: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div>
                  <Label>Renewal Benefit</Label>
                  <Input
                    placeholder="e.g., 10% discount on renewal"
                    value={formData.renewalBenefit}
                    onChange={e => setFormData(prev => ({ ...prev, renewalBenefit: e.target.value }))}
                  />
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!formData.coverageAmount || !formData.premium}
                className="flex-1 bg-blue-600 hover:bg-[#FF8C42] blue-700"
              >
                Next: Inclusions & Exclusions
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Inclusions & Exclusions */}
        {step === 3 && (
          <div className="space-y-4">
            <Card className="p-4 bg-[#FF8C42] green-50 border-green-200">
              <div className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-green-900 text-sm">Coverage Details</h3>
                  <p className="text-xs text-green-700 mt-1">
                    Specify what's covered and what's not in this plan.
                  </p>
                </div>
              </div>
            </Card>

            {/* Inclusions */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">What's Included</h3>
              
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="e.g., OPD consultations"
                  value={inclusion}
                  onChange={e => setInclusion(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddInclusion()}
                />
                <Button onClick={handleAddInclusion} size="sm">Add</Button>
              </div>

              <div className="space-y-2">
                {formData.inclusions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-[#FF8C42] green-50 p-2 rounded-lg">
                    <span className="text-sm text-green-900">✓ {item}</span>
                    <Button onClick={() => handleRemoveInclusion(index)}
                      className="text-red-500 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Exclusions */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">What's Excluded</h3>
              
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="e.g., Pre-existing conditions"
                  value={exclusion}
                  onChange={e => setExclusion(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleAddExclusion()}
                />
                <Button onClick={handleAddExclusion} size="sm">Add</Button>
              </div>

              <div className="space-y-2">
                {formData.exclusions.map((item, index) => (
                  <div key={index} className="flex items-center justify-between bg-[#FF8C42] red-50 p-2 rounded-lg">
                    <span className="text-sm text-red-900">✗ {item}</span>
                    <Button onClick={() => handleRemoveExclusion(index)}
                      className="text-red-500 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            {/* Summary */}
            <Card className="p-4 bg-[#FF8C42] blue-50 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">Plan Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Plan Name:</span>
                  <span className="font-semibold text-blue-900">{formData.planName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Coverage:</span>
                  <span className="font-semibold text-blue-900">₹{formData.coverageAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Premium:</span>
                  <span className="font-semibold text-blue-900">₹{formData.premium.toLocaleString()}/year</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Coverage %:</span>
                  <span className="font-semibold text-blue-900">{formData.coveragePercentage}%</span>
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button onClick={() => setStep(2)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || formData.inclusions.length === 0}
                className="flex-1 bg-blue-600 hover:bg-[#FF8C42] blue-700"
              >
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
