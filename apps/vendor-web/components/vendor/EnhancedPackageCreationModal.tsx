'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Package, Calendar, Percent, Users, Star, Info, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface ServiceItem {
  id: string;
  name: string;
  description?: string;
}

interface PackageFormData {
  // Basic Info
  serviceName: string;
  description: string;
  isPackage: boolean;
  
  // Single Service Fields
  price: number;
  duration: number;
  
  // Package Fields
  packageType: 'combo' | 'subscription' | 'membership' | 'unlimited';
  
  // Combo Package (Multiple services bundled)
  includedServices: ServiceItem[];
  
  // Time-based validity
  validityDays: number;
  
  // Subscription/Plan features
  maxUsageCount: number; // -1 for unlimited
  usageInterval: 'per_day' | 'per_week' | 'per_month' | 'total';
  
  // Membership benefits
  discountPercentage: number;
  specialBenefits: string[];
  
  // Pricing
  originalPrice: number;
  packagePrice: number;
  
  // Additional details
  termsAndConditions: string;
  cancellationPolicy: string;
}

interface EnhancedPackageCreationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PackageFormData) => Promise<void>;
  serviceStyle: 'at_center' | 'at_clinic';
  availableServices?: ServiceItem[];
  centreContext?: boolean; // NEW: Whether this is being created in a centre context
  centreName?: string; // NEW: Name of the centre (for UI display)
}

export function EnhancedPackageCreationModal({ 
  open, 
  onClose, 
  onSubmit,
  serviceStyle,
  availableServices = [],
  centreContext = false,
  centreName = ''
}: EnhancedPackageCreationModalProps) {
  const [formData, setFormData] = useState<PackageFormData>({
    serviceName: '',
    description: '',
    isPackage: false,
    price: 0,
    duration: 30,
    packageType: 'combo',
    includedServices: [],
    validityDays: 30,
    maxUsageCount: -1,
    usageInterval: 'total',
    discountPercentage: 0,
    specialBenefits: [],
    originalPrice: 0,
    packagePrice: 0,
    termsAndConditions: '',
    cancellationPolicy: ''
  });

  const [benefitInput, setBenefitInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showServiceSelector, setShowServiceSelector] = useState(false); // ✅ NEW: Service selector modal

  const handleSubmit = async () => {
    // Validation
    if (!formData.serviceName.trim()) {
      toast.error('Service name is required');
      return;
    }

    if (!formData.isPackage) {
      if (!formData.price || formData.price <= 0) {
        toast.error('Price is required for single services');
        return;
      }
    } else {
      if (!formData.packagePrice || formData.packagePrice <= 0) {
        toast.error('Package price is required');
        return;
      }

      if (formData.packageType === 'combo' && formData.includedServices.length === 0) {
        toast.error('Please add at least one service to the combo package');
        return;
      }

      if (!formData.validityDays || formData.validityDays <= 0) {
        toast.error('Validity period is required for packages');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      await onSubmit(formData);
      resetForm();
      onClose();
    } catch (error) {
      console.error('Error submitting package:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      serviceName: '',
      description: '',
      isPackage: false,
      price: 0,
      duration: 30,
      packageType: 'combo',
      includedServices: [],
      validityDays: 30,
      maxUsageCount: -1,
      usageInterval: 'total',
      discountPercentage: 0,
      specialBenefits: [],
      originalPrice: 0,
      packagePrice: 0,
      termsAndConditions: '',
      cancellationPolicy: ''
    });
    setBenefitInput('');
  };

  const addIncludedService = () => {
    setShowServiceSelector(true);
  };

  const toggleServiceSelection = (service: ServiceItem) => {
    const exists = formData.includedServices.find(s => s.id === service.id);
    if (exists) {
      // Remove service
      setFormData({
        ...formData,
        includedServices: formData.includedServices.filter(s => s.id !== service.id)
      });
    } else {
      // Add service
      setFormData({
        ...formData,
        includedServices: [...formData.includedServices, service]
      });
    }
  };

  const removeIncludedService = (id: string) => {
    setFormData({
      ...formData,
      includedServices: formData.includedServices.filter(s => s.id !== id)
    });
  };

  const updateIncludedService = (id: string, field: keyof ServiceItem, value: string) => {
    setFormData({
      ...formData,
      includedServices: formData.includedServices.map(s =>
        s.id === id ? { ...s, [field]: value } : s
      )
    });
  };

  const addBenefit = () => {
    if (benefitInput.trim()) {
      setFormData({
        ...formData,
        specialBenefits: [...formData.specialBenefits, benefitInput.trim()]
      });
      setBenefitInput('');
    }
  };

  const removeBenefit = (index: number) => {
    setFormData({
      ...formData,
      specialBenefits: formData.specialBenefits.filter((_, i) => i !== index)
    });
  };

  const calculateSavings = () => {
    if (formData.originalPrice > 0 && formData.packagePrice > 0) {
      return ((formData.originalPrice - formData.packagePrice) / formData.originalPrice * 100).toFixed(1);
    }
    return 0;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-[#FF8C42]" />
            {formData.isPackage ? 'Create Package/Plan' : 'Add Custom Service'}
          </DialogTitle>
          <DialogDescription>
            {formData.isPackage 
              ? 'Create a combo package, subscription plan, or membership offering'
              : 'Create a single service offering. Requires admin approval.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Service Type Toggle */}
          <div className="flex items-center space-x-2 p-4 bg-orange-50 rounded-lg border border-orange-200">
            <Checkbox
              id="is-package"
              checked={formData.isPackage}
              onCheckedChange={(checked) => setFormData({ ...formData, isPackage: checked as boolean })}
            />
            <div className="flex-1">
              <Label htmlFor="is-package" className="cursor-pointer font-semibold text-[#FF8C42]">
                This is a Package/Plan (Multiple services or subscription)
              </Label>
              <p className="text-xs text-gray-600 mt-1">
                Enable this for combos, memberships, health plans, or subscription services
              </p>
            </div>
          </div>

          {/* Basic Information */}
          <div>
            <Label>Service/Package Name *</Label>
            <Input
              value={formData.serviceName}
              onChange={(e) => setFormData({ ...formData, serviceName: e.target.value })}
              placeholder={formData.isPackage ? "e.g., Premium Grooming Package" : "e.g., Advanced Dental Cleaning"}
              className="mt-2"
            />
          </div>

          <div>
            <Label>Description *</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detailed description of what's included..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* Package-Specific Fields */}
          {formData.isPackage ? (
            <>
              {/* Package Type */}
              <div>
                <Label>Package Type *</Label>
                <Select 
                  value={formData.packageType} 
                  onValueChange={(val) => setFormData({ ...formData, packageType: val as any })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="combo">
                      Combo Package (Multiple services bundled)
                    </SelectItem>
                    <SelectItem value="subscription">
                      Subscription Plan (Recurring service access)
                    </SelectItem>
                    <SelectItem value="membership">
                      Membership (Discounts & benefits)
                    </SelectItem>
                    <SelectItem value="unlimited">
                      Unlimited Plan (Unlimited usage within period)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Package Type Specific Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-600 mt-0.5" />
                  <div className="text-xs text-blue-900">
                    {formData.packageType === 'combo' && (
                      <p><strong>Combo Package:</strong> Bundle multiple services together. Customer gets all services, valid for specified days.</p>
                    )}
                    {formData.packageType === 'subscription' && (
                      <p><strong>Subscription Plan:</strong> Recurring access to specific services with usage limits per interval.</p>
                    )}
                    {formData.packageType === 'membership' && (
                      <p><strong>Membership:</strong> Annual/monthly membership with discount benefits on all services.</p>
                    )}
                    {formData.packageType === 'unlimited' && (
                      <p><strong>Unlimited Plan:</strong> Unlimited access to specified services within the validity period.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Combo Package - Included Services */}
              {(formData.packageType === 'combo' || formData.packageType === 'unlimited') && (
                <div>
                  <Label className="flex items-center justify-between">
                    <span>Included Services *</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addIncludedService}
                      className="h-8"
                      disabled={availableServices.length === 0}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      {availableServices.length > 0 ? 'Select Services' : 'No Services Enabled'}
                    </Button>
                  </Label>
                  
                  {/* Selected Services Display */}
                  <div className="mt-2 space-y-2">
                    {formData.includedServices.map((service, index) => (
                      <div key={service.id} className="border rounded-lg p-3 bg-green-50 border-green-200">
                        <div className="flex items-start gap-2">
                          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-900">{service.name}</h4>
                            {service.description && (
                              <p className="text-xs text-gray-600 mt-0.5">{service.description}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeIncludedService(service.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {formData.includedServices.length === 0 && (
                      <div className="text-center py-6 border-2 border-dashed rounded-lg">
                        <Package className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-500 mb-1">No services selected</p>
                        <p className="text-xs text-gray-400">
                          Click &quot;Select Services&quot; to choose from your enabled services
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Validity Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Validity Period (Days) *
                  </Label>
                  <Input
                    type="number"
                    value={formData.validityDays}
                    onChange={(e) => setFormData({ ...formData, validityDays: parseInt(e.target.value) || 0 })}
                    placeholder="30"
                    min="1"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Package valid for {formData.validityDays} days after purchase
                  </p>
                </div>

                {/* Usage Limits (for subscription/unlimited) */}
                {(formData.packageType === 'subscription' || formData.packageType === 'unlimited') && (
                  <div>
                    <Label>Usage Limit</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="number"
                        value={formData.maxUsageCount === -1 ? '' : formData.maxUsageCount}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          maxUsageCount: e.target.value === '' ? -1 : parseInt(e.target.value) || 0 
                        })}
                        placeholder="Unlimited"
                        min="-1"
                      />
                      <Select 
                        value={formData.usageInterval} 
                        onValueChange={(val) => setFormData({ ...formData, usageInterval: val as any })}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="per_day">Per Day</SelectItem>
                          <SelectItem value="per_week">Per Week</SelectItem>
                          <SelectItem value="per_month">Per Month</SelectItem>
                          <SelectItem value="total">Total</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.maxUsageCount === -1 ? 'Unlimited' : formData.maxUsageCount} visits {formData.usageInterval !== 'total' ? formData.usageInterval.replace('per_', 'per ') : 'in total'}
                    </p>
                  </div>
                )}
              </div>

              {/* Membership - Discount & Benefits */}
              {formData.packageType === 'membership' && (
                <div>
                  <Label className="flex items-center gap-1">
                    <Percent className="w-3 h-3" />
                    Membership Discount (%)
                  </Label>
                  <Input
                    type="number"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData({ ...formData, discountPercentage: parseFloat(e.target.value) || 0 })}
                    placeholder="10"
                    min="0"
                    max="100"
                    step="0.5"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Members get {formData.discountPercentage}% off on all services
                  </p>
                </div>
              )}

              {/* Special Benefits */}
              <div>
                <Label className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Special Benefits
                </Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={benefitInput}
                    onChange={(e) => setBenefitInput(e.target.value)}
                    placeholder="e.g., Priority booking, Free consultation"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                  />
                  <Button type="button" variant="outline" onClick={addBenefit}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.specialBenefits.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {formData.specialBenefits.map((benefit, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-50 px-3 py-2 rounded">
                        <span className="text-sm">✓ {benefit}</span>
                        <button
                          type="button"
                          onClick={() => removeBenefit(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Original Price (₹)</Label>
                  <Input
                    type="number"
                    value={formData.originalPrice || ''}
                    onChange={(e) => setFormData({ ...formData, originalPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="5000"
                    min="0"
                    className="mt-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">Total value if bought separately</p>
                </div>
                <div>
                  <Label>Package Price (₹) *</Label>
                  <Input
                    type="number"
                    value={formData.packagePrice || ''}
                    onChange={(e) => setFormData({ ...formData, packagePrice: parseFloat(e.target.value) || 0 })}
                    placeholder="3999"
                    min="0"
                    className="mt-2"
                  />
                  {formData.originalPrice > formData.packagePrice && formData.packagePrice > 0 && (
                    <p className="text-xs text-green-600 mt-1 font-semibold">
                      Save {calculateSavings()}% (₹{formData.originalPrice - formData.packagePrice})
                    </p>
                  )}
                </div>
              </div>

              {/* Terms & Conditions */}
              <div>
                <Label>Terms & Conditions</Label>
                <Textarea
                  value={formData.termsAndConditions}
                  onChange={(e) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                  placeholder="Package terms, restrictions, etc..."
                  rows={2}
                  className="mt-2"
                />
              </div>

              {/* Cancellation Policy */}
              <div>
                <Label>Cancellation Policy</Label>
                <Textarea
                  value={formData.cancellationPolicy}
                  onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                  placeholder="Refund and cancellation terms..."
                  rows={2}
                  className="mt-2"
                />
              </div>
            </>
          ) : (
            /* Single Service Fields */
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Price (₹) *</Label>
                  <Input
                    type="number"
                    value={formData.price || ''}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    placeholder="500"
                    min="0"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                    placeholder="30"
                    min="5"
                    step="5"
                    className="mt-2"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onClose(); }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-[#FF8C42] hover:bg-[#ff7a28]"
          >
            {isSubmitting ? 'Submitting...' : formData.isPackage ? 'Create Package' : 'Add Service'}
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* ✅ Service Selector Dialog */}
      <Dialog open={showServiceSelector} onOpenChange={setShowServiceSelector}>
        <DialogContent className="max-w-[500px] max-h-[70vh]">
          <DialogHeader>
            <DialogTitle>Select Services for Package</DialogTitle>
            <DialogDescription>
              Choose from your enabled services to include in this package
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[50vh] overflow-y-auto">
            {availableServices.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm text-gray-600 mb-2">No services available</p>
                <p className="text-xs text-gray-500">
                  Please enable some services first before creating a package
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {availableServices.map((service) => {
                  const isSelected = formData.includedServices.some(s => s.id === service.id);
                  return (
                    <div
                      key={service.id}
                      onClick={() => toggleServiceSelection(service)}
                      className={`border rounded-lg p-3 cursor-pointer transition-all ${
                        isSelected 
                          ? 'bg-green-50 border-green-500 shadow-sm' 
                          : 'bg-white border-gray-200 hover:border-[#FF8C42]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isSelected 
                            ? 'bg-green-500 border-green-500' 
                            : 'bg-white border-gray-300'
                        }`}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-semibold text-gray-900">{service.name}</h4>
                          {service.description && (
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{service.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowServiceSelector(false)}
            >
              Done ({formData.includedServices.length} selected)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}