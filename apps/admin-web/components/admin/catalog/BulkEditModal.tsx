'use client';

import { X, Edit } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedIds: string[];
  itemType: 'service' | 'product' | 'category';
}

export function BulkEditModal({
  isOpen,
  onClose,
  onSuccess,
  selectedIds,
  itemType
}: BulkEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    status: '' as '' | 'active' | 'inactive' | 'draft',
    price: '',
    category: ''
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (selectedIds.length === 0) {
      alert('Please select items to edit');
      return;
    }

    const updates: any = {};
    if (formData.status) updates.status = formData.status;
    if (formData.price) updates.price = parseFloat(formData.price);
    if (formData.category) updates.categoryId = formData.category;

    if (Object.keys(updates).length === 0) {
      alert('Please select at least one field to update');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post(`/admin/catalog/${itemType}s/bulk-edit`, {
        ids: selectedIds,
        updates
      });
      alert(`Successfully updated ${selectedIds.length} ${itemType}(s)!`);
      onSuccess?.();
      onClose();
      setFormData({
        status: '',
        price: '',
        category: ''
      });
    } catch (error) {
      console.error('Error bulk editing:', error);
      alert('Failed to update items. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-0 border-b">
          <div className="flex items-center gap-3">
            <div className="p-0 bg-blue-100 rounded-lg">
              <Edit className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">
              Bulk Edit {itemType ? (itemType.charAt(0).toUpperCase() + itemType.slice(1)) : 'Item'}s
            </h3>
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
          <p className="text-sm text-gray-600">
            Updating <strong>{selectedIds.length}</strong> {itemType}(s)
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Status (optional)
            </label>
            <select
              value={formData.status}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('status', e.target.value)}
              className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">No change</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          {(itemType === 'service' || itemType === 'product') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Price (₹) (optional)
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('price', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
                placeholder="Leave empty to keep current"
              />
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-0">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Only filled fields will be updated. Leave fields empty to keep current values.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-0 border-t">
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
            {loading ? 'Updating...' : `Update ${selectedIds.length} Items`}
          </Button>
        </div>
      </div>
    </div>
  );
}

