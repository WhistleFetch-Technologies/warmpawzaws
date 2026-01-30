import { X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface CreateProductServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: string[];
}

export function CreateProductServiceModal({ isOpen, onClose, onSuccess, categories }: CreateProductServiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    price: '',
    stock: '',
    status: 'active' as 'active' | 'out-of-stock',
    rating: 0
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/products/create`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...formData,
            price: parseFloat(formData.price) || 0,
            stock: formData.stock === '∞' ? '∞' : parseInt(formData.stock) || 0,
            createdAt: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        onSuccess();
        resetForm();
      } else {
        alert('Failed to create product. Please try again.');
      }
    } catch (error) {
      console.error('Error creating product:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      category: '',
      price: '',
      stock: '',
      status: 'active',
      rating: 0
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg">Create New Product/Service</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Product/Service Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Basic Veterinary Consultation"
              />
            </div>
            <div>
              <Label>SKU Code</Label>
              <Input
                value={formData.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
                placeholder="e.g. VET-BASIC-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category</Label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Price (₹)</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Stock</Label>
              <Input
                value={formData.stock}
                onChange={(e) => handleChange('stock', e.target.value)}
                placeholder="Enter number or ∞ for unlimited"
              />
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as any)}
              >
                <option value="active">Active</option>
                <option value="out-of-stock">Out of Stock</option>
              </select>
            </div>
          </div>

          <div>
            <Label>Initial Rating (0-5)</Label>
            <Input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={formData.rating}
              onChange={(e) => handleChange('rating', parseFloat(e.target.value) || 0)}
              placeholder="4.7"
            />
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.name || !formData.category}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            {loading ? 'Creating...' : 'Create Product'}
          </Button>
        </div>
      </div>
    </div>
  );
}
