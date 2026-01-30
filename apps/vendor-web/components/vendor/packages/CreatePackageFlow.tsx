import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Package, Calendar, Users, Gift, CheckCircle, Info, Plus, X, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Textarea } from '../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Card } from '../../ui/card';
import { Switch } from '../../ui/switch';
import { useVendorCapabilities } from '../hooks/useVendorCapabilities';
import { hasVendorRole } from '@/lib/vendor-utils';
import { toast } from 'sonner';

interface Service {
  id: string;
  name: string;
  price: number;
  duration: number;
}

interface PackageFormData {
  packageName: string;
  packageType: 'bundle' | 'time_based' | 'appointment' | 'membership' | 'subscription';
  description: string;
  category: string;
  
  // Pricing
  originalPrice: number;
  packagePrice: number;
  discount: number;
  discountPercentage: number;
  
  // Validity
  validityType: 'days' | 'months' | 'years' | 'unlimited';
  validityPeriod: number;
  
  // Usage
  usageType: 'sessions' | 'appointments' | 'unlimited';
  totalSessions: number;
  unlimitedUsage: boolean;
  
  // Included Services
  includedServices: string[];
  includedServicesDetails: Array<{ id: string; name: string; price: number }>;
  
  // Benefits (for memberships)
  benefits: string[];
  membershipPerks: {
    priorityBooking: boolean;
    discountOnServices: number;
    freeAddOns: string[];
    dedicatedSupport: boolean;
    exclusiveOffers: boolean;
  };
  
  // Terms
  terms: string[];
  refundPolicy: string;
  cancellationPolicy: string;
  
  // Subscription
  isRecurring: boolean;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
}

export function CreatePackageFlow({
  vendorId,
  vendorData,
  onBack,
  onSuccess
}: {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [availableServices, setAvailableServices] = useState<Service[]>([]);
  
  // ✅ CAPABILITY CHECK: Only allow package creation for vendors with package_management capability
  // ✅ CRITICAL FIX: Check both roleId formats (camelCase and snake_case)
  const effectiveRoleId = vendorData?.roleId || vendorData?.role_id || (vendorData as any)?.selected_role_id;
  const { capabilities, loading: capsLoading } = useVendorCapabilities(effectiveRoleId);
  const hasPackageCapability = capabilities.package_management || 
                                capabilities.packages || 
                                capabilities.packageManagement || 
                                false;
  
  // ✅ FIX: Solo vendors cannot create packages EXCEPT trainers/walkers/sitters
  const isSoloVendor = vendorData?.vendorConfiguration === 'solo' || 
                       vendorData?.isSoloProvider || 
                       vendorData?.is_solo_provider || 
                       false;
  
  // ✅ Check if this is a trainer/walker/sitter/groomer who CAN create session packages as solo (solo trainer, solo groomer)
  const isTrainerWalkerSitter = vendorData ? hasVendorRole(vendorData, ['pet_trainer', 'trainer', 'trainer_solo', 'pet_walker', 'walker', 'dog_walker', 'pet_sitter', 'sitter', 'pet_groomer', 'groomer', 'groomer_solo']) : false;
  
  // ✅ Solo trainers/walkers/sitters CAN create session packages
  // Business accounts with package capability CAN create all packages
  const canCreatePackages = hasPackageCapability || isTrainerWalkerSitter || !isSoloVendor;
  
  // ✅ Block if: solo vendor AND NOT a trainer/walker/sitter
  const shouldBlockAccess = isSoloVendor && !isTrainerWalkerSitter;
  
  // ✅ Show access denied if no capability and not a trainer/walker/sitter, OR blocked solo vendor
  if (!capsLoading && (shouldBlockAccess || (!hasPackageCapability && !isTrainerWalkerSitter))) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Package Creation Not Available</h2>
          <p className="text-gray-600 mb-6">
            {shouldBlockAccess
              ? 'Solo providers can create custom services but not packages. Solo trainers, walkers, sitters, and groomers can create session packages.'
              : 'Package creation is only available for business accounts with package management capability enabled.'
            }
          </p>
          <Button onClick={onBack} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }
  const [formData, setFormData] = useState<PackageFormData>({
    packageName: '',
    packageType: 'bundle',
    description: '',
    category: 'grooming',
    
    originalPrice: 0,
    packagePrice: 0,
    discount: 0,
    discountPercentage: 0,
    
    validityType: 'months',
    validityPeriod: 1,
    
    usageType: 'sessions',
    totalSessions: 1,
    unlimitedUsage: false,
    
    includedServices: [],
    includedServicesDetails: [],
    
    benefits: [],
    membershipPerks: {
      priorityBooking: false,
      discountOnServices: 0,
      freeAddOns: [],
      dedicatedSupport: false,
      exclusiveOffers: false
    },
    
    terms: [],
    refundPolicy: '',
    cancellationPolicy: '',
    
    isRecurring: false,
    billingCycle: 'monthly'
  });

  const [newBenefit, setNewBenefit] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newFreeAddOn, setNewFreeAddOn] = useState('');

  useEffect(() => {
    loadAvailableServices();
  }, [vendorId]);

  useEffect(() => {
    // Auto-calculate discount
    if (formData.originalPrice > 0 && formData.packagePrice > 0) {
      const discount = formData.originalPrice - formData.packagePrice;
      const discountPercentage = Math.round((discount / formData.originalPrice) * 100);
      setFormData(prev => ({ ...prev, discount, discountPercentage }));
    }
  }, [formData.originalPrice, formData.packagePrice]);

  const loadAvailableServices = async () => {
    try {
      const response = await apiClient.get<any>(`/vendor/${vendorId}/services/enabled`);

      if (response.success) {
        setAvailableServices(response.services || []);
      }
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  const handleServiceToggle = (serviceId: string) => {
    const service = availableServices.find(s => s.id === serviceId);
    if (!service) return;

    if (formData.includedServices.includes(serviceId)) {
      // Remove
      setFormData(prev => ({
        ...prev,
        includedServices: prev.includedServices.filter(id => id !== serviceId),
        includedServicesDetails: prev.includedServicesDetails.filter(s => s.id !== serviceId)
      }));
    } else {
      // Add
      setFormData(prev => ({
        ...prev,
        includedServices: [...prev.includedServices, serviceId],
        includedServicesDetails: [
          ...prev.includedServicesDetails,
          { id: serviceId, name: service.name, price: service.price }
        ]
      }));
    }
  };

  const calculateOriginalPrice = () => {
    return formData.includedServicesDetails.reduce((sum, s) => sum + s.price, 0);
  };

  // Validate form before submission
  const validateForm = (): string | null => {
    if (!formData.packageName.trim()) {
      return 'Package name is required';
    }
    if (!formData.packagePrice || formData.packagePrice <= 0) {
      return 'Package price must be greater than 0';
    }
    if (formData.includedServices.length === 0) {
      return 'Please select at least one service to include';
    }
    if (formData.validityPeriod <= 0 && formData.validityType !== 'unlimited') {
      return 'Validity period must be greater than 0';
    }
    return null;
  };

  const handleSubmit = async () => {
    // Validate form
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      setSubmitting(true);

      const response = await apiClient.post<any>(`/vendor/${vendorId}/packages`, formData);

      if (response.success) {
        toast.success('Package created and submitted for approval!');
        onSuccess();
      } else {
        toast.error(response.error || response.hint || 'Failed to create package');
      }
    } catch (error: any) {
      console.error('Error creating package:', error);
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to create package. Please try again.';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const packageTypes = [
    { id: 'bundle', name: 'Service Bundle', icon: '📦', desc: 'Multiple services packaged together' },
    { id: 'time_based', name: 'Time-Based Plan', icon: '⏰', desc: 'Valid for specific duration' },
    { id: 'appointment', name: 'Appointment Package', icon: '📅', desc: 'Limited/unlimited appointments' },
    { id: 'membership', name: 'Membership', icon: '👑', desc: 'Exclusive benefits & discounts' },
    { id: 'subscription', name: 'Subscription', icon: '🔄', desc: 'Recurring benefits' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] p-4 text-white sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Create Package</h1>
            <p className="text-xs text-white/90">Step {step} of 4</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(s => (
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
        {/* Step 1: Package Type & Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <Card className="p-4 bg-orange-50 border-orange-200">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-orange-900 text-sm">Choose Package Type</h3>
                  <p className="text-xs text-orange-700 mt-1">
                    Select the type that best fits what you want to offer
                  </p>
                </div>
              </div>
            </Card>

            {/* Package Types */}
            <div className="space-y-2">
              {packageTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setFormData(prev => ({ ...prev, packageType: type.id as any }))}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                    formData.packageType === type.id
                      ? 'border-[#FF8C42] bg-orange-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{type.icon}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{type.name}</h3>
                      <p className="text-sm text-gray-600 mt-0.5">{type.desc}</p>
                    </div>
                    {formData.packageType === type.id && (
                      <CheckCircle className="w-5 h-5 text-[#FF8C42]" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Basic Info */}
            <Card className="p-4">
              <div className="space-y-4">
                <div>
                  <Label>Package Name *</Label>
                  <Input
                    placeholder="e.g., Premium Grooming Package"
                    value={formData.packageName}
                    onChange={e => setFormData(prev => ({ ...prev, packageName: e.target.value }))}
                  />
                </div>

                <div>
                  <Label>Description *</Label>
                  <Textarea
                    placeholder="Describe what's included and the benefits..."
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={4}
                  />
                </div>

                <div>
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={value => setFormData(prev => ({ ...prev, category: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grooming">Grooming</SelectItem>
                      <SelectItem value="veterinary">Veterinary</SelectItem>
                      <SelectItem value="training">Training</SelectItem>
                      <SelectItem value="boarding">Boarding</SelectItem>
                      <SelectItem value="wellness">Wellness</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            <Button
              onClick={() => setStep(2)}
              disabled={!formData.packageName || !formData.description}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              Next: Select Services
            </Button>
          </div>
        )}

        {/* Step 2: Included Services */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="p-4 bg-blue-50 border-blue-200">
              <h3 className="font-semibold text-blue-900 text-sm mb-2">Select Services</h3>
              <p className="text-xs text-blue-700">
                Choose which services are included in this package
              </p>
            </Card>

            {availableServices.length === 0 ? (
              <Card className="p-6 text-center">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No services available</p>
                <p className="text-sm text-gray-500 mt-1">Enable services first</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {availableServices.map(service => (
                  <Card
                    key={service.id}
                    className={`p-4 cursor-pointer transition-all ${
                      formData.includedServices.includes(service.id)
                        ? 'border-2 border-[#FF8C42] bg-orange-50'
                        : 'border border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleServiceToggle(service.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{service.name}</h3>
                        <p className="text-sm text-gray-600">
                          ₹{service.price} • {service.duration}min
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        formData.includedServices.includes(service.id)
                          ? 'border-[#FF8C42] bg-[#FF8C42]'
                          : 'border-gray-300'
                      }`}>
                        {formData.includedServices.includes(service.id) && (
                          <CheckCircle className="w-4 h-4 text-white" />
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {formData.includedServices.length > 0 && (
              <Card className="p-4 bg-green-50 border-green-200">
                <h3 className="font-semibold text-green-900 text-sm mb-2">Selected Services</h3>
                <div className="space-y-1">
                  {formData.includedServicesDetails.map(service => (
                    <div key={service.id} className="flex justify-between text-sm">
                      <span className="text-green-800">{service.name}</span>
                      <span className="text-green-900 font-semibold">₹{service.price}</span>
                    </div>
                  ))}
                  <div className="border-t border-green-300 pt-2 mt-2 flex justify-between font-semibold">
                    <span className="text-green-900">Total Value</span>
                    <span className="text-green-900">₹{calculateOriginalPrice()}</span>
                  </div>
                </div>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => {
                  setFormData(prev => ({ ...prev, originalPrice: calculateOriginalPrice() }));
                  setStep(3);
                }}
                disabled={formData.includedServices.length === 0}
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
              >
                Next: Pricing & Validity
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Pricing, Validity & Usage */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Pricing */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Pricing</h3>
              <div className="space-y-4">
                <div>
                  <Label>Total Value (Auto-calculated)</Label>
                  <Input
                    type="number"
                    value={formData.originalPrice}
                    disabled
                    className="bg-gray-100"
                  />
                </div>

                <div>
                  <Label>Package Price (₹) *</Label>
                  <Input
                    type="number"
                    placeholder="Discounted price"
                    value={formData.packagePrice}
                    onChange={e => setFormData(prev => ({ ...prev, packagePrice: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                {formData.discountPercentage > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-green-700">Discount</span>
                      <span className="font-bold text-green-900">
                        {formData.discountPercentage}% OFF (₹{formData.discount} saved)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Validity */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Validity Period</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Duration</Label>
                    <Input
                      type="number"
                      placeholder="1"
                      value={formData.validityPeriod}
                      onChange={e => setFormData(prev => ({ ...prev, validityPeriod: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Select
                      value={formData.validityType}
                      onValueChange={value => setFormData(prev => ({ ...prev, validityType: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="days">Days</SelectItem>
                        <SelectItem value="months">Months</SelectItem>
                        <SelectItem value="years">Years</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </Card>

            {/* Usage Limits */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Usage Limits</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Unlimited Usage</Label>
                    <p className="text-xs text-gray-500">Allow unlimited redemptions</p>
                  </div>
                  <Switch
                    checked={formData.unlimitedUsage}
                    onCheckedChange={checked => setFormData(prev => ({ ...prev, unlimitedUsage: checked }))}
                  />
                </div>

                {!formData.unlimitedUsage && (
                  <div>
                    <Label>Total Sessions/Appointments</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 10"
                      value={formData.totalSessions}
                      onChange={e => setFormData(prev => ({ ...prev, totalSessions: parseInt(e.target.value) || 1 }))}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Subscription Options */}
            {formData.packageType === 'subscription' && (
              <Card className="p-4 bg-purple-50 border-purple-200">
                <h3 className="font-semibold text-purple-900 mb-3">Subscription Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Recurring Billing</Label>
                    <Switch
                      checked={formData.isRecurring}
                      onCheckedChange={checked => setFormData(prev => ({ ...prev, isRecurring: checked }))}
                    />
                  </div>

                  {formData.isRecurring && (
                    <div>
                      <Label>Billing Cycle</Label>
                      <Select
                        value={formData.billingCycle}
                        onValueChange={value => setFormData(prev => ({ ...prev, billingCycle: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="quarterly">Quarterly</SelectItem>
                          <SelectItem value="yearly">Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </Card>
            )}

            <div className="flex gap-3">
              <Button onClick={() => setStep(2)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!formData.packagePrice}
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
              >
                Next: Benefits & Terms
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Benefits & Terms */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Benefits */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Benefits & Features</h3>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Priority booking available"
                    value={newBenefit}
                    onChange={e => setNewBenefit(e.target.value)}
                    onKeyPress={e => {
                      if (e.key === 'Enter' && newBenefit.trim()) {
                        setFormData(prev => ({ ...prev, benefits: [...prev.benefits, newBenefit.trim()] }));
                        setNewBenefit('');
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newBenefit.trim()) {
                        setFormData(prev => ({ ...prev, benefits: [...prev.benefits, newBenefit.trim()] }));
                        setNewBenefit('');
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {formData.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded-lg">
                      <span className="text-sm text-green-900">✓ {benefit}</span>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, benefits: prev.benefits.filter((_, i) => i !== index) }))}
                        className="text-red-500 text-xs"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Membership Perks (if membership type) */}
            {formData.packageType === 'membership' && (
              <Card className="p-4 bg-purple-50 border-purple-200">
                <h3 className="font-semibold text-purple-900 mb-3">Membership Perks</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Priority Booking</Label>
                    <Switch
                      checked={formData.membershipPerks.priorityBooking}
                      onCheckedChange={checked => setFormData(prev => ({
                        ...prev,
                        membershipPerks: { ...prev.membershipPerks, priorityBooking: checked }
                      }))}
                    />
                  </div>

                  <div>
                    <Label>Discount on Services (%)</Label>
                    <Input
                      type="number"
                      placeholder="e.g., 20"
                      value={formData.membershipPerks.discountOnServices}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        membershipPerks: { ...prev.membershipPerks, discountOnServices: parseInt(e.target.value) || 0 }
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Dedicated Support</Label>
                    <Switch
                      checked={formData.membershipPerks.dedicatedSupport}
                      onCheckedChange={checked => setFormData(prev => ({
                        ...prev,
                        membershipPerks: { ...prev.membershipPerks, dedicatedSupport: checked }
                      }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Exclusive Offers</Label>
                    <Switch
                      checked={formData.membershipPerks.exclusiveOffers}
                      onCheckedChange={checked => setFormData(prev => ({
                        ...prev,
                        membershipPerks: { ...prev.membershipPerks, exclusiveOffers: checked }
                      }))}
                    />
                  </div>
                </div>
              </Card>
            )}

            {/* Terms & Conditions */}
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Terms & Conditions</h3>
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g., Non-transferable"
                    value={newTerm}
                    onChange={e => setNewTerm(e.target.value)}
                    onKeyPress={e => {
                      if (e.key === 'Enter' && newTerm.trim()) {
                        setFormData(prev => ({ ...prev, terms: [...prev.terms, newTerm.trim()] }));
                        setNewTerm('');
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newTerm.trim()) {
                        setFormData(prev => ({ ...prev, terms: [...prev.terms, newTerm.trim()] }));
                        setNewTerm('');
                      }
                    }}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {formData.terms.map((term, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                      <span className="text-sm text-gray-900">• {term}</span>
                      <button
                        onClick={() => setFormData(prev => ({ ...prev, terms: prev.terms.filter((_, i) => i !== index) }))}
                        className="text-red-500 text-xs"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div>
                  <Label>Refund Policy</Label>
                  <Textarea
                    placeholder="e.g., No refund after activation"
                    value={formData.refundPolicy}
                    onChange={e => setFormData(prev => ({ ...prev, refundPolicy: e.target.value }))}
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Cancellation Policy</Label>
                  <Textarea
                    placeholder="e.g., 24 hours notice required"
                    value={formData.cancellationPolicy}
                    onChange={e => setFormData(prev => ({ ...prev, cancellationPolicy: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            </Card>

            {/* Summary */}
            <Card className="p-4 bg-blue-50 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-3">Package Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Name:</span>
                  <span className="font-semibold text-blue-900">{formData.packageName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Type:</span>
                  <span className="font-semibold text-blue-900">{packageTypes.find(t => t.id === formData.packageType)?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Price:</span>
                  <span className="font-semibold text-blue-900">₹{formData.packagePrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Discount:</span>
                  <span className="font-semibold text-green-900">{formData.discountPercentage}% OFF</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Validity:</span>
                  <span className="font-semibold text-blue-900">
                    {formData.validityType === 'unlimited' ? 'Unlimited' : `${formData.validityPeriod} ${formData.validityType}`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Usage:</span>
                  <span className="font-semibold text-blue-900">
                    {formData.unlimitedUsage ? 'Unlimited' : `${formData.totalSessions} sessions`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Services:</span>
                  <span className="font-semibold text-blue-900">{formData.includedServices.length} included</span>
                </div>
              </div>
            </Card>

            <div className="flex gap-3">
              <Button onClick={() => setStep(3)} variant="outline" className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !formData.packageName.trim() || !formData.packagePrice}
                className="flex-1 bg-[#FF8C42] hover:bg-[#FF7A2E]"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit for Approval'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
