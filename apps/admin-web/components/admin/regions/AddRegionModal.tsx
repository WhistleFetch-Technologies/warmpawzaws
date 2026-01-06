'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { X, Save, Loader2 } from 'lucide-react';

interface AddRegionModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const REGION_TEMPLATES = [
  { id: 'india', name: 'India', code: 'IN', flag: '🇮🇳', currency: { code: 'INR', symbol: '₹' } },
  { id: 'usa', name: 'United States', code: 'US', flag: '🇺🇸', currency: { code: 'USD', symbol: '$' } },
  { id: 'uae', name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪', currency: { code: 'AED', symbol: 'د.إ' } },
  { id: 'singapore', name: 'Singapore', code: 'SG', flag: '🇸🇬', currency: { code: 'SGD', symbol: 'S$' } },
  { id: 'uk', name: 'United Kingdom', code: 'GB', flag: '🇬🇧', currency: { code: 'GBP', symbol: '£' } },
  { id: 'australia', name: 'Australia', code: 'AU', flag: '🇦🇺', currency: { code: 'AUD', symbol: 'A$' } },
];

export function AddRegionModal({ onClose, onSuccess }: AddRegionModalProps) {
  const [loading, setLoading] = useState(false);
  const [useTemplate, setUseTemplate] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    regionName: '',
    regionCode: '',
    currencyCode: '',
    currencySymbol: '',
  });

  const handleCreateFromTemplate = async (templateId: string) => {
    try {
      setLoading(true);
      const response = await apiClient.post<any>(`/admin/regions/init-${templateId}`, {});
      if (response.success) {
        onSuccess();
      } else {
        alert('Failed to create region from template');
      }
    } catch (error) {
      console.error('Error creating region:', error);
      alert('Error creating region');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustom = async () => {
    if (!formData.regionName || !formData.regionCode) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post<any>('/admin/regions', {
        regionName: formData.regionName,
        regionCode: formData.regionCode,
        currency: {
          code: formData.currencyCode,
          symbol: formData.currencySymbol,
        },
      });
      if (response.success) {
        onSuccess();
      } else {
        alert('Failed to create region');
      }
    } catch (error) {
      console.error('Error creating region:', error);
      alert('Error creating region');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add Region</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Template Selection */}
          <div>
            <label className="flex items-center gap-2 mb-3">
              <input
                type="radio"
                checked={useTemplate}
                onChange={() => setUseTemplate(true)}
                className="w-4 h-4 text-orange-600"
              />
              <span className="font-medium text-gray-900">Use Template</span>
            </label>
            {useTemplate && (
              <div className="space-y-2">
                {REGION_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template.id);
                      handleCreateFromTemplate(template.id);
                    }}
                    disabled={loading}
                    className={`w-full p-3 border-2 rounded-lg text-left transition-colors ${
                      selectedTemplate === template.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{template.flag}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{template.name}</div>
                        <div className="text-sm text-gray-500">
                          {template.currency.symbol} {template.currency.code}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Custom Region */}
          <div>
            <label className="flex items-center gap-2 mb-3">
              <input
                type="radio"
                checked={!useTemplate}
                onChange={() => setUseTemplate(false)}
                className="w-4 h-4 text-orange-600"
              />
              <span className="font-medium text-gray-900">Create Custom</span>
            </label>
            {!useTemplate && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Region Name *
                  </label>
                  <input
                    type="text"
                    value={formData.regionName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, regionName: e.target.value }))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="e.g., Canada"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Region Code *
                  </label>
                  <input
                    type="text"
                    value={formData.regionCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, regionCode: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="e.g., CA"
                    maxLength={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency Code
                    </label>
                    <input
                      type="text"
                      value={formData.currencyCode}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, currencyCode: e.target.value.toUpperCase() }))}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="CAD"
                      maxLength={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency Symbol
                    </label>
                    <input
                      type="text"
                      value={formData.currencySymbol}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, currencySymbol: e.target.value }))}
                      className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      placeholder="$"
                    />
                  </div>
                </div>
                <button
                  onClick={handleCreateCustom}
                  disabled={loading}
                  className="w-full py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Create Region
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

