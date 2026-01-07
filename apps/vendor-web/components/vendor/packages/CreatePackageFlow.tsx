'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface CreatePackageFlowProps {
  vendorId: string;
  onBack: () => void;
  onSuccess: () => void;
}

export function CreatePackageFlow({ vendorId, onBack, onSuccess }: CreatePackageFlowProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    packageName: '',
    packageType: 'subscription',
    packagePrice: '',
    originalPrice: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.packageName || !formData.packagePrice) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post<any>(`/vendor/${vendorId}/packages`, {
        ...formData,
        packagePrice: parseFloat(formData.packagePrice),
        originalPrice: formData.originalPrice ? parseFloat(formData.originalPrice) : parseFloat(formData.packagePrice),
      });

      if (response.success) {
        onSuccess();
      } else {
        alert('Failed to create package');
      }
    } catch (error) {
      console.error('Error creating package:', error);
      alert('Error creating package');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4">
        <div className="flex items-center gap-0">
          <button onClick={onBack} className="p-0 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Create Package</h1>
        </div>
      </div>

      <div className="p-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg border-2 border-gray-200 p-0 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Package Name *
            </label>
            <input
              type="text"
              value={formData.packageName}
              onChange={(e) => setFormData(prev => ({ ...prev, packageName: e.target.value }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="e.g., Monthly Grooming Package"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Package Type *
            </label>
            <select
              value={formData.packageType}
              onChange={(e) => setFormData(prev => ({ ...prev, packageType: e.target.value }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            >
              <option value="subscription">Subscription</option>
              <option value="one-time">One-time</option>
              <option value="bundle">Bundle</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Package Price (₹) *
            </label>
            <input
              type="number"
              value={formData.packagePrice}
              onChange={(e) => setFormData(prev => ({ ...prev, packagePrice: e.target.value }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Original Price (₹)
            </label>
            <input
              type="number"
              value={formData.originalPrice}
              onChange={(e) => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              placeholder="0.00"
              min="0"
              step="0.01"
            />
            <p className="text-xs text-gray-500 mt-0">Leave empty if no discount</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
              rows={4}
              placeholder="Describe what's included in this package..."
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-0 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Create Package
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
