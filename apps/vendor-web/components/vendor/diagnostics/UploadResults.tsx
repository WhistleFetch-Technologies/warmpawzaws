'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Upload, Truck } from 'lucide-react';
import { toast } from 'sonner';

interface DiagnosticTest {
  id: string;
  test_name: string;
  test_code?: string;
  category?: string;
  description?: string;
  price?: number;
  duration_minutes?: number;
  sample_type?: string;
  preparation_instructions?: string;
  is_available?: boolean;
  is_free_home_collection?: boolean;
  home_collection_fee?: number;
}

interface UploadResultsProps {
  vendorId: string;
  editingTest?: DiagnosticTest | null;
  onBack?: () => void;
  onSuccess?: () => void;
}

export function UploadResults({ vendorId, editingTest, onBack, onSuccess }: UploadResultsProps) {
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
    isFreeHomeCollection: true,
    homeCollectionFee: '',
  });

  useEffect(() => {
    if (editingTest) {
      setFormData({
        testName: editingTest.test_name,
        testCode: editingTest.test_code || '',
        category: editingTest.category || '',
        description: editingTest.description || '',
        price: editingTest.price?.toString() || '',
        durationMinutes: editingTest.duration_minutes?.toString() || '',
        sampleType: editingTest.sample_type || '',
        preparationInstructions: editingTest.preparation_instructions || '',
        isAvailable: editingTest.is_available !== false,
        isFreeHomeCollection: editingTest.is_free_home_collection !== false,
        homeCollectionFee: editingTest.home_collection_fee?.toString() || '',
      });
    } else {
      setFormData({
        testName: '',
        testCode: '',
        category: '',
        description: '',
        price: '',
        durationMinutes: '',
        sampleType: '',
        preparationInstructions: '',
        isAvailable: true,
        isFreeHomeCollection: true,
        homeCollectionFee: '',
      });
    }
  }, [editingTest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.testName) {
      toast.error('Test name is required');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        testName: formData.testName,
        testCode: formData.testCode || undefined,
        category: formData.category || undefined,
        description: formData.description || undefined,
        price: formData.price ? parseFloat(formData.price) : undefined,
        durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes) : undefined,
        sampleType: formData.sampleType || undefined,
        preparationInstructions: formData.preparationInstructions || undefined,
        isAvailable: formData.isAvailable,
        isFreeHomeCollection: formData.isFreeHomeCollection,
        homeCollectionFee: formData.isFreeHomeCollection ? 0 : (parseFloat(formData.homeCollectionFee) || 0),
      };
      let response: { success?: boolean; error?: string };
      if (editingTest) {
        response = await apiClient.put<any>(`/vendor/${vendorId}/diagnostics/tests/${editingTest.id}`, payload);
        toast.success('Test updated successfully');
      } else {
        response = await apiClient.post<{ success: boolean; error?: string }>(`/vendor/${vendorId}/diagnostics/tests`, {
          ...payload,
          isAvailable: false, // Draft by default
        });
        toast.success('Diagnostic test added (saved as Draft)');
      }

      if (response?.success !== false) {
        onSuccess?.();
        if (onBack) onBack();
      } else {
        throw new Error((response as any).error || 'Failed to save test');
      }
    } catch (error: any) {
      console.error('Error adding diagnostic test:', error);
      toast.error(error.message || 'Failed to add diagnostic test');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[430px] mx-auto space-y-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-lg font-bold text-gray-900">{editingTest ? 'Edit Test' : 'Add Diagnostic Test'}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{editingTest ? 'Update test details' : 'Add a new test to your catalog'}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-4 shadow-sm space-y-4">
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

        {/* Home Sample Collection - Free or Charged */}
        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
          <label className="text-sm font-medium flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Home Sample Collection
          </label>
          <div className="flex gap-3">
            <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              formData.isFreeHomeCollection ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
            }`}>
              <input
                type="radio"
                name="homeCollection"
                checked={formData.isFreeHomeCollection}
                onChange={() => setFormData({ ...formData, isFreeHomeCollection: true, homeCollectionFee: '' })}
                className="text-blue-600"
              />
              <span className="text-sm font-medium">Free</span>
            </label>
            <label className={`flex-1 flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
              !formData.isFreeHomeCollection ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
            }`}>
              <input
                type="radio"
                name="homeCollection"
                checked={!formData.isFreeHomeCollection}
                onChange={() => setFormData({ ...formData, isFreeHomeCollection: false })}
                className="text-blue-600"
              />
              <span className="text-sm font-medium">Charged</span>
            </label>
          </div>
          {!formData.isFreeHomeCollection && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Home Collection Fee (₹)</label>
              <input
                type="number"
                value={formData.homeCollectionFee}
                onChange={(e) => setFormData({ ...formData, homeCollectionFee: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                min="0"
                placeholder="e.g., 150"
              />
            </div>
          )}
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
            {loading ? (editingTest ? 'Saving...' : 'Adding...') : (
              <>
                <Upload className="w-4 h-4" />
                {editingTest ? 'Save Changes' : 'Add Test'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
