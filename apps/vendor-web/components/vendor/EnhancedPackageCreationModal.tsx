'use client';

import { useState } from 'react';
import { Plus, Trash2, Package, Calendar, Percent, Star, Info, Check, X } from 'lucide-react';

interface ServiceItem {
  id: string;
  name: string;
  description?: string;
}

interface PackageFormData {
  serviceName: string;
  description: string;
  isPackage: boolean;
  price: number;
  duration: number;
  packageType: 'combo' | 'subscription' | 'membership' | 'unlimited';
  includedServices: ServiceItem[];
  validityDays: number;
  maxUsageCount: number;
  usageInterval: 'per_day' | 'per_week' | 'per_month' | 'total';
  discountPercentage: number;
  specialBenefits: string[];
  originalPrice: number;
  packagePrice: number;
  termsAndConditions: string;
  cancellationPolicy: string;
}

interface EnhancedPackageCreationModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PackageFormData) => Promise<void>;
  serviceStyle: 'at_center' | 'at_clinic';
  availableServices?: ServiceItem[];
  centreContext?: boolean;
  centreName?: string;
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
  const [showServiceSelector, setShowServiceSelector] = useState(false);

  const handleSubmit = async () => {
    if (!formData.serviceName.trim()) {
      alert('Service name is required');
      return;
    }

    if (!formData.isPackage) {
      if (!formData.price || formData.price <= 0) {
        alert('Price is required for single services');
        return;
      }
    } else {
      if (!formData.packagePrice || formData.packagePrice <= 0) {
        alert('Package price is required');
        return;
      }

      if (formData.packageType === 'combo' && formData.includedServices.length === 0) {
        alert('Please add at least one service to the combo package');
        return;
      }

      if (!formData.validityDays || formData.validityDays <= 0) {
        alert('Validity period is required for packages');
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
      alert('Failed to submit package');
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

  const toggleServiceSelection = (service: ServiceItem) => {
    const exists = formData.includedServices.find(s => s.id === service.id);
    if (exists) {
      setFormData({
        ...formData,
        includedServices: formData.includedServices.filter(s => s.id !== service.id)
      });
    } else {
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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto">
          <div className="p-0 border-b border-gray-200">
            <div className="flex items-center justify-between mb-0">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-0">
                <Package className="w-5 h-5 text-orange-500" />
                {formData.isPackage ? 'Create Package/Plan' : 'Add Custom Service'}
              </h2>
              <button onClick={onClose} className="p-0 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              {formData.isPackage 
                ? 'Create a combo package, subscription plan, or membership offering'
                : 'Create a single service offering. Requires admin approval.'}
            </p>
          </div>

          <div className="p-0 space-y-4">
            <div className="flex items-center space-x-2 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <input
                type="checkbox"
                id="is-package"
                checked={formData.isPackage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, isPackage: e.target.checked })}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <label htmlFor="is-package" className="cursor-pointer font-semibold text-orange-600">
                  This is a Package/Plan (Multiple services or subscription)
                </label>
                <p className="text-xs text-gray-600 mt-0">
                  Enable this for combos, memberships, health plans, or subscription services
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Service/Package Name *</label>
              <input
                type="text"
                value={formData.serviceName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, serviceName: e.target.value })}
                placeholder={formData.isPackage ? "e.g., Premium Grooming Package" : "e.g., Advanced Dental Cleaning"}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">Description *</label>
              <textarea
                value={formData.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of what's included..."
                rows={3}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {formData.isPackage ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Package Type *</label>
                  <select
                    value={formData.packageType}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, packageType: e.target.value as any })}
                    className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="combo">Combo Package (Multiple services bundled)</option>
                    <option value="subscription">Subscription Plan (Recurring service access)</option>
                    <option value="membership">Membership (Discounts & benefits)</option>
                    <option value="unlimited">Unlimited Plan (Unlimited usage within period)</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-0">
                  <div className="flex items-start gap-0">
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

                {(formData.packageType === 'combo' || formData.packageType === 'unlimited') && (
                  <div>
                    <div className="flex items-center justify-between mb-0">
                      <label className="block text-sm font-medium text-gray-700">Included Services *</label>
                      <button
                        type="button"
                        onClick={() => setShowServiceSelector(true)}
                        className="px-0 py-0.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-0"
                        disabled={availableServices.length === 0}
                      >
                        <Plus className="w-3 h-3" />
                        {availableServices.length > 0 ? 'Select Services' : 'No Services Enabled'}
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {formData.includedServices.map((service) => (
                        <div key={service.id} className="border rounded-lg p-0 bg-green-50 border-green-200">
                          <div className="flex items-start gap-0">
                            <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-gray-900">{service.name}</h4>
                              {service.description && (
                                <p className="text-xs text-gray-600 mt-0.5">{service.description}</p>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeIncludedService(service.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 p-0 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {formData.includedServices.length === 0 && (
                        <div className="text-center py-0 border-2 border-dashed rounded-lg">
                          <Package className="w-8 h-8 text-gray-400 mx-auto mb-0" />
                          <p className="text-sm text-gray-500 mb-0">No services selected</p>
                          <p className="text-xs text-gray-400">
                            Click &quot;Select Services&quot; to choose from your enabled services
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-0">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0 flex items-center gap-0">
                      <Calendar className="w-3 h-3" />
                      Validity Period (Days) *
                    </label>
                    <input
                      type="number"
                      value={formData.validityDays}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, validityDays: parseInt(e.target.value) || 0 })}
                      placeholder="30"
                      min="1"
                      className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-0">
                      Package valid for {formData.validityDays} days after purchase
                    </p>
                  </div>

                  {(formData.packageType === 'subscription' || formData.packageType === 'unlimited') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-0">Usage Limit</label>
                      <div className="flex gap-0">
                        <input
                          type="number"
                          value={formData.maxUsageCount === -1 ? '' : formData.maxUsageCount}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ 
                            ...formData, 
                            maxUsageCount: e.target.value === '' ? -1 : parseInt(e.target.value) || 0 
                          })}
                          placeholder="Unlimited"
                          min="-1"
                          className="flex-1 px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        />
                        <select
                          value={formData.usageInterval}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, usageInterval: e.target.value as any })}
                          className="w-32 px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="per_day">Per Day</option>
                          <option value="per_week">Per Week</option>
                          <option value="per_month">Per Month</option>
                          <option value="total">Total</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {formData.packageType === 'membership' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0 flex items-center gap-0">
                      <Percent className="w-3 h-3" />
                      Membership Discount (%)
                    </label>
                    <input
                      type="number"
                      value={formData.discountPercentage}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, discountPercentage: parseFloat(e.target.value) || 0 })}
                      placeholder="10"
                      min="0"
                      max="100"
                      step="0.5"
                      className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-0">
                      Members get {formData.discountPercentage}% off on all services
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0 flex items-center gap-0">
                    <Star className="w-3 h-3" />
                    Special Benefits
                  </label>
                  <div className="flex gap-0">
                    <input
                      value={benefitInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBenefitInput(e.target.value)}
                      placeholder="e.g., Priority booking, Free consultation"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBenefit())}
                      className="flex-1 px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                    <button type="button" onClick={addBenefit} className="px-4 py-0 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {formData.specialBenefits.length > 0 && (
                    <div className="mt-0 space-y-1">
                      {formData.specialBenefits.map((benefit, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 px-0 py-0 rounded">
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

                <div className="grid grid-cols-2 gap-0">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Original Price (₹)</label>
                    <input
                      type="number"
                      value={formData.originalPrice || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, originalPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="5000"
                      min="0"
                      className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                    <p className="text-xs text-gray-500 mt-0">Total value if bought separately</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-0">Package Price (₹) *</label>
                    <input
                      type="number"
                      value={formData.packagePrice || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, packagePrice: parseFloat(e.target.value) || 0 })}
                      placeholder="3999"
                      min="0"
                      className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                    />
                    {formData.originalPrice > formData.packagePrice && formData.packagePrice > 0 && (
                      <p className="text-xs text-green-600 mt-0 font-semibold">
                        Save {calculateSavings()}% (₹{formData.originalPrice - formData.packagePrice})
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Terms & Conditions</label>
                  <textarea
                    value={formData.termsAndConditions}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, termsAndConditions: e.target.value })}
                    placeholder="Package terms, restrictions, etc..."
                    rows={2}
                    className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Cancellation Policy</label>
                  <textarea
                    value={formData.cancellationPolicy}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
                    placeholder="Refund and cancellation terms..."
                    rows={2}
                    className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Price (₹) *</label>
                  <input
                    type="number"
                    value={formData.price || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    placeholder="500"
                    min="0"
                    className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Duration (min)</label>
                  <input
                    type="number"
                    value={formData.duration}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, duration: parseInt(e.target.value) || 0 })}
                    placeholder="30"
                    min="5"
                    step="5"
                    className="w-full px-0 py-0 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-0 border-t border-gray-200 flex gap-0">
            <button
              onClick={() => { resetForm(); onClose(); }}
              className="flex-1 px-4 py-0 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-0 bg-orange-500 hover:bg-orange-600 text-white rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : formData.isPackage ? 'Create Package' : 'Add Service'}
            </button>
          </div>
        </div>
      </div>

      {showServiceSelector && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-0 max-w-[500px] w-full max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Services for Package</h3>
                <p className="text-sm text-gray-600 mt-0">Choose from your enabled services to include in this package</p>
              </div>
              <button onClick={() => setShowServiceSelector(false)} className="p-0 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="max-h-[50vh] overflow-y-auto mb-4">
              {availableServices.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-0" />
                  <p className="text-sm text-gray-600 mb-0">No services available</p>
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
                        className={`border rounded-lg p-0 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-green-50 border-green-500 shadow-sm' 
                            : 'bg-white border-gray-200 hover:border-orange-500'
                        }`}
                      >
                        <div className="flex items-start gap-0">
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
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-0">{service.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex gap-0 pt-4 border-t border-gray-200">
              <button
                onClick={() => setShowServiceSelector(false)}
                className="flex-1 px-4 py-0 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Done ({formData.includedServices.length} selected)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

