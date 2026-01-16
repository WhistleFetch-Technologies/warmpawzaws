'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface UploadResultsProps {
  vendorId: string;
  onBack?: () => void;
  onSuccess?: () => void;
}

export function UploadResults({ vendorId, onBack, onSuccess }: UploadResultsProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    testName: '',
    testCode: '',
    category: '',
    description: '',
    price: '',
    durationMinutes: '',
    sampleType: '',
    preparationInstructions: '',
    isAvailable: true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.testName) {
      toast.error('Test name is required');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post<{ success: boolean; error?: string }>(`/vendor/${vendorId}/diagnostics/tests`, {
        testName: formData.testName,
        testCode: formData.testCode || undefined,
        category: formData.category || undefined,
        description: formData.description || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : undefined,
        sampleType: formData.sampleType || undefined,
        preparationInstructions: formData.preparationInstructions || undefined,
        isAvailable: formData.isAvailable,
      });

      if (response.success) {
        toast.success('Diagnostic test added successfully');
        onSuccess?.();
        if (onBack) onBack();
      } else {
        throw new Error(response.error || 'Failed to add test');
      }
    } catch (error: any) {
      console.error('Error adding diagnostic test:', error);
      toast.error(error.message || 'Failed to add diagnostic test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        {onBack && (
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Diagnostic Test</h1>
          <p className="text-gray-500 mt-1">Add a new test to your diagnostic catalog</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Test Name *
          </label>
          <input
            type="text"
            value={formData.testName}
            onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
            placeholder="e.g., Complete Blood Count"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Test Code
            </label>
            <input
              type="text"
              value={formData.testCode}
              onChange={(e) => setFormData({ ...formData, testCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., CBC"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Hematology"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Test description..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price (₹)
            </label>
            <input
              type="number"
              value={formData.price}
              onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={formData.durationMinutes}
              onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              min="1"
              placeholder="30"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sample Type
          </label>
          <input
            type="text"
            value={formData.sampleType}
            onChange={(e) => setFormData({ ...formData, sampleType: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Blood, Urine, Stool"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Preparation Instructions
          </label>
          <textarea
            value={formData.preparationInstructions}
            onChange={(e) => setFormData({ ...formData, preparationInstructions: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Instructions for pet owner..."
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isAvailable"
            checked={formData.isAvailable}
            onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="isAvailable" className="text-sm font-medium text-gray-700">
            Test is available for booking
          </label>
        </div>

        <div className="flex gap-4 pt-4">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? 'Adding...' : (
              <>
                <Upload className="w-4 h-4" />
                Add Test
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
