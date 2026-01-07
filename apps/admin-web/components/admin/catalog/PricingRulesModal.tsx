'use client';

import { X, DollarSign, Percent, Calendar } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface PricingRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId?: string;
  onSuccess?: () => void;
}

export function PricingRulesModal({
  isOpen,
  onClose,
  serviceId,
  onSuccess
}: PricingRulesModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ruleType: 'discount' as 'discount' | 'markup' | 'fixed',
    value: '',
    minQuantity: '',
    validFrom: '',
    validUntil: '',
    applicableTo: 'all' as 'all' | 'specific'
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.value) {
      alert('Please enter a value');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/admin/catalog/pricing-rules', {
        serviceId,
        ...formData
      });
      
      alert('Pricing rule created successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error creating pricing rule:', error);
      alert('Failed to create pricing rule. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-0 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-0">
            <div className="p-0 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Pricing Rules</h3>
          </div>
          <button
            onClick={onClose}
            className="p-0 hover:bg-gray-100 rounded"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-0 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Rule Type
            </label>
            <select
              value={formData.ruleType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('ruleType', e.target.value)}
              className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
            >
              <option value="discount">Discount (%)</option>
              <option value="markup">Markup (%)</option>
              <option value="fixed">Fixed Price</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              {formData.ruleType === 'fixed' ? 'Price (₹)' : 'Value (%)'}
            </label>
            <input
              type="number"
              value={formData.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('value', e.target.value)}
              className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              placeholder={formData.ruleType === 'fixed' ? '0.00' : '0'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Minimum Quantity
            </label>
            <input
              type="number"
              value={formData.minQuantity}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('minQuantity', e.target.value)}
              className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              placeholder="1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Valid From
              </label>
              <input
                type="date"
                value={formData.validFrom}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('validFrom', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Valid Until
              </label>
              <input
                type="date"
                value={formData.validUntil}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('validUntil', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Applicable To
            </label>
            <select
              value={formData.applicableTo}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('applicableTo', e.target.value)}
              className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Services</option>
              <option value="specific">Specific Service</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-0 p-0 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Rule'}
          </Button>
        </div>
      </div>
    </div>
  );
}

