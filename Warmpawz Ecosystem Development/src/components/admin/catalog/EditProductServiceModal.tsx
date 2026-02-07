import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number | string;
  status: 'active' | 'out-of-stock';
  rating: number;
}

interface EditProductServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | null;
  categories: string[];
}

export function EditProductServiceModal({ isOpen, onClose, onSuccess, product, categories }: EditProductServiceModalProps) {
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

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price.toString(),
        stock: product.stock.toString(),
        status: product.status,
        rating: product.rating
      });
    }
  }, [product]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!product) return;
    
    try {
      setLoading(true);
      
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/products/${product.id}`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...formData,
            price: parseFloat(formData.price) || 0,
            stock: formData.stock === '∞' ? '∞' : parseInt(formData.stock) || 0,
            updatedAt: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        onSuccess();
      } else {
        alert('Failed to update product. Please try again.');
      }
    } catch (error) {
      console.error('Error updating product:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg">Edit Product/Service</h2>
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
              />
            </div>
            <div>
              <Label>SKU Code</Label>
              <Input
                value={formData.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
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
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Stock</Label>
              <Input
                value={formData.stock}
                onChange={(e) => handleChange('stock', e.target.value)}
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
            <Label>Rating (0-5)</Label>
            <Input
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={formData.rating}
              onChange={(e) => handleChange('rating', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            {loading ? 'Updating...' : 'Update Product'}
          </Button>
        </div>
      </div>
    </div>
  );
}
