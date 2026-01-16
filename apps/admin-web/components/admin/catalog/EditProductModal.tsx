'use client';

import { X, ShoppingBag } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface EditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  productId: string;
  initialData?: any;
}

export function EditProductModal({
  isOpen,
  onClose,
  onSuccess,
  productId,
  initialData
}: EditProductModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    status: 'active' as 'active' | 'inactive' | 'draft'
  });

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        price: initialData.price?.toString() || '',
        stock: initialData.stock?.toString() || '',
        status: initialData.status || 'active'
      });
    } else if (isOpen && productId) {
      loadProduct();
    }
  }, [isOpen, productId, initialData]);

  const loadProduct = async () => {
    try {
      const data = await apiClient.get<any>(`/admin/catalog/products/${productId}`);
      if (data.product) {
        setFormData({
          name: data.product.name || '',
          description: data.product.description || '',
          price: data.product.price?.toString() || '',
          stock: data.product.stock?.toString() || '',
          status: data.product.status || 'active'
        });
      }
    } catch (error) {
      console.error('Error loading product:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await apiClient.put(`/admin/catalog/products/${productId}`, formData);
      alert('Product updated successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-0 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-0 bg-green-100 rounded-lg">
              <ShoppingBag className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Edit Product</h3>
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
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
              className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('description', e.target.value)}
              className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Price (₹) *
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('price', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Stock
              </label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('stock', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('status', e.target.value)}
              className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
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
            {loading ? 'Updating...' : 'Update Product'}
          </Button>
        </div>
      </div>
    </div>
  );
}

