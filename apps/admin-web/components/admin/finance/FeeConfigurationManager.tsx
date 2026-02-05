'use client';

import React, { useState, useEffect } from 'react';
import { 
  IndianRupee, Save, Loader2, RefreshCw, Info, 
  Percent, CreditCard, Truck, Package, Settings,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface FeeConfiguration {
  // Platform Fees
  platformFeePercentage: number;
  platformFeeFlat: number;
  maxPlatformFee: number;
  
  // Convenience Fees
  convenienceFeeBooking: number;
  convenienceFeeOrder: number;
  convenienceFeeTele: number;
  
  // Delivery Fees
  deliveryFeeBase: number;
  deliveryFeePerKm: number;
  freeDeliveryThreshold: number;
  maxDeliveryDistance: number;
  
  // Packaging Fees
  packagingFeeEnabled: boolean;
  packagingFeeAmount: number;
  
  // Service Type Overrides
  serviceTypeOverrides: {
    serviceType: string;
    platformFeePercentage?: number;
    convenienceFee?: number;
    enabled: boolean;
  }[];
}

const defaultConfig: FeeConfiguration = {
  platformFeePercentage: 2,
  platformFeeFlat: 0,
  maxPlatformFee: 500,
  convenienceFeeBooking: 9,
  convenienceFeeOrder: 0,
  convenienceFeeTele: 0,
  deliveryFeeBase: 30,
  deliveryFeePerKm: 5,
  freeDeliveryThreshold: 500,
  maxDeliveryDistance: 25,
  packagingFeeEnabled: false,
  packagingFeeAmount: 10,
  serviceTypeOverrides: [],
};

const serviceTypes = [
  { id: 'veterinary', label: 'Veterinary Services', icon: '🏥' },
  { id: 'grooming', label: 'Grooming', icon: '✂️' },
  { id: 'boarding', label: 'Boarding/Daycare', icon: '🏠' },
  { id: 'training', label: 'Training', icon: '🎓' },
  { id: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  { id: 'pet_store', label: 'Pet Store/Products', icon: '🛒' },
  { id: 'cafe', label: 'Pet Cafe', icon: '☕' },
  { id: 'nutritionist', label: 'Nutritionist/Meals', icon: '🥗' },
];

export function FeeConfigurationManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<FeeConfiguration>(defaultConfig);
  const [expandedSections, setExpandedSections] = useState<string[]>(['platform', 'convenience']);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/finance/fee-configuration');
      
      if (data.success && data.config) {
        setConfig({ ...defaultConfig, ...data.config });
      }
    } catch (error) {
      console.error('Error loading fee configuration:', error);
      // Use defaults if API fails
      setConfig(defaultConfig);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveStatus('idle');
      
      const data = await apiClient.put<any>('/admin/finance/fee-configuration', { config });
      
      if (data.success) {
        setSaveStatus('success');
        setHasChanges(false);
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        alert(data.error || 'Failed to save fee configuration');
      }
    } catch (error) {
      console.error('Error saving fee configuration:', error);
      setSaveStatus('error');
      alert('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (field: keyof FeeConfiguration, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const updateServiceOverride = (serviceType: string, field: string, value: any) => {
    setConfig(prev => {
      const overrides = [...prev.serviceTypeOverrides];
      const idx = overrides.findIndex(o => o.serviceType === serviceType);
      
      if (idx >= 0) {
        overrides[idx] = { ...overrides[idx], [field]: value };
      } else {
        overrides.push({ 
          serviceType, 
          enabled: true,
          [field]: value 
        });
      }
      
      return { ...prev, serviceTypeOverrides: overrides };
    });
    setHasChanges(true);
  };

  const getServiceOverride = (serviceType: string) => {
    return config.serviceTypeOverrides.find(o => o.serviceType === serviceType);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 rounded-xl">
            <IndianRupee className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Fee Configuration</h1>
            <p className="text-sm text-gray-600">Manage platform, convenience, and delivery fees</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadConfiguration}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              hasChanges 
                ? 'bg-orange-600 text-white hover:bg-orange-700' 
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : saveStatus === 'success' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div>
            <p className="font-medium text-blue-900">How Fees Are Applied</p>
            <p className="text-sm text-blue-700 mt-1">
              Platform Fee is charged on the subtotal (before discounts). Convenience Fee is a flat amount added at checkout.
              Delivery fees apply to home services and orders. All fees are displayed transparently to customers.
            </p>
          </div>
        </div>
      </div>

      {/* Platform Fees Section */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('platform')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Percent className="w-5 h-5 text-orange-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-gray-900">Platform Fees</h2>
              <p className="text-sm text-gray-500">Commission charged on transactions</p>
            </div>
          </div>
          {expandedSections.includes('platform') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {expandedSections.includes('platform') && (
          <div className="p-6 border-t border-gray-200 space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Platform Fee (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="50"
                    step="0.1"
                    value={config.platformFeePercentage}
                    onChange={(e) => updateConfig('platformFeePercentage', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-400">%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Percentage of order subtotal</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Flat Platform Fee (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={config.platformFeeFlat}
                    onChange={(e) => updateConfig('platformFeeFlat', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Added to percentage fee</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Platform Fee Cap (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={config.maxPlatformFee}
                    onChange={(e) => updateConfig('maxPlatformFee', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">0 = No cap</p>
              </div>
            </div>
            
            {/* Example Calculation */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Example Calculation</p>
              <p className="text-sm text-gray-600">
                For a ₹1000 order: Platform Fee = ₹{Math.min(
                  (1000 * config.platformFeePercentage / 100) + config.platformFeeFlat,
                  config.maxPlatformFee || Infinity
                ).toFixed(2)}
                {config.maxPlatformFee > 0 && (1000 * config.platformFeePercentage / 100) + config.platformFeeFlat > config.maxPlatformFee && (
                  <span className="text-orange-600"> (capped at ₹{config.maxPlatformFee})</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Convenience Fees Section */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('convenience')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-gray-900">Convenience Fees</h2>
              <p className="text-sm text-gray-500">Flat fees for online transactions</p>
            </div>
          </div>
          {expandedSections.includes('convenience') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {expandedSections.includes('convenience') && (
          <div className="p-6 border-t border-gray-200 space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Booking Convenience Fee (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={config.convenienceFeeBooking}
                    onChange={(e) => updateConfig('convenienceFeeBooking', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">For service bookings</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Convenience Fee (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={config.convenienceFeeOrder}
                    onChange={(e) => updateConfig('convenienceFeeOrder', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">For product orders</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tele Consultation Fee (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={config.convenienceFeeTele}
                    onChange={(e) => updateConfig('convenienceFeeTele', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">For video consultations</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delivery Fees Section */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('delivery')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Truck className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-gray-900">Delivery Fees</h2>
              <p className="text-sm text-gray-500">For home services and product delivery</p>
            </div>
          </div>
          {expandedSections.includes('delivery') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {expandedSections.includes('delivery') && (
          <div className="p-6 border-t border-gray-200 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Delivery Fee (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={config.deliveryFeeBase}
                    onChange={(e) => updateConfig('deliveryFeeBase', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Flat fee for delivery</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Per Kilometer Fee (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={config.deliveryFeePerKm}
                    onChange={(e) => updateConfig('deliveryFeePerKm', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Added per km after base</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Free Delivery Threshold (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={config.freeDeliveryThreshold}
                    onChange={(e) => updateConfig('freeDeliveryThreshold', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">0 = No free delivery</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Delivery Distance (km)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  value={config.maxDeliveryDistance}
                  onChange={(e) => updateConfig('maxDeliveryDistance', parseFloat(e.target.value) || 25)}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum serviceable distance</p>
              </div>
            </div>
            
            {/* Example Calculation */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Example Delivery Fee</p>
              <p className="text-sm text-gray-600">
                For 10km distance: Delivery Fee = ₹{config.deliveryFeeBase} + (10 × ₹{config.deliveryFeePerKm}) = ₹{config.deliveryFeeBase + (10 * config.deliveryFeePerKm)}
                {config.freeDeliveryThreshold > 0 && (
                  <span className="text-green-600"> (FREE for orders above ₹{config.freeDeliveryThreshold})</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Packaging Fees Section */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('packaging')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-gray-900">Packaging Fees</h2>
              <p className="text-sm text-gray-500">For product packaging</p>
            </div>
          </div>
          {expandedSections.includes('packaging') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {expandedSections.includes('packaging') && (
          <div className="p-6 border-t border-gray-200 space-y-6">
            <div className="flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Enable Packaging Fee</p>
                <p className="text-sm text-gray-600">Charge for eco-friendly packaging</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.packagingFeeEnabled}
                  onChange={(e) => updateConfig('packagingFeeEnabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>
            
            {config.packagingFeeEnabled && (
              <div className="w-1/2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Packaging Fee Amount (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={config.packagingFeeAmount}
                    onChange={(e) => updateConfig('packagingFeeAmount', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Service Type Overrides Section */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('overrides')}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Settings className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-left">
              <h2 className="font-semibold text-gray-900">Service Type Overrides</h2>
              <p className="text-sm text-gray-500">Custom fees per service category</p>
            </div>
          </div>
          {expandedSections.includes('overrides') ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        {expandedSections.includes('overrides') && (
          <div className="p-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 mb-4">
              Set custom platform or convenience fees for specific service types. Leave empty to use default values.
            </p>
            
            <div className="space-y-3">
              {serviceTypes.map((service) => {
                const override = getServiceOverride(service.id);
                return (
                  <div 
                    key={service.id}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      override?.enabled ? 'border-orange-200 bg-orange-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{service.icon}</span>
                        <span className="font-medium text-gray-900">{service.label}</span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={override?.enabled || false}
                          onChange={(e) => updateServiceOverride(service.id, 'enabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                      </label>
                    </div>
                    
                    {override?.enabled && (
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Platform Fee (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.1"
                            placeholder={`${config.platformFeePercentage}% (default)`}
                            value={override?.platformFeePercentage ?? ''}
                            onChange={(e) => updateServiceOverride(
                              service.id, 
                              'platformFeePercentage', 
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )}
                            className="w-full px-3 py-1.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Convenience Fee (₹)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder={`₹${config.convenienceFeeBooking} (default)`}
                            value={override?.convenienceFee ?? ''}
                            onChange={(e) => updateServiceOverride(
                              service.id, 
                              'convenienceFee', 
                              e.target.value ? parseFloat(e.target.value) : undefined
                            )}
                            className="w-full px-3 py-1.5 text-sm border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Unsaved Changes Warning */}
      {hasChanges && (
        <div className="fixed bottom-6 right-6 bg-orange-600 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-bounce">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">You have unsaved changes</span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 bg-white text-orange-600 rounded-lg font-medium hover:bg-orange-50"
          >
            Save Now
          </button>
        </div>
      )}
    </div>
  );
}

export default FeeConfigurationManager;
