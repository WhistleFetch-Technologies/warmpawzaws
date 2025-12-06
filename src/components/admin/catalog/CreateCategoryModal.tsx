import { X, Grid3x3 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { IconSelector } from './IconSelector';
import { VendorTypeSelector } from './VendorTypeSelector';
import { ServiceStyleSelector } from './ServiceStyleSelector';

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateCategoryModal({ isOpen, onClose, onSuccess }: CreateCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'settings'>('details');
  const [formData, setFormData] = useState({
    name: '',
    status: 'active',
    description: '',
    icon: 'Package',
    vendorType: '',
    serviceStyle: ''
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name) {
      alert('Please enter a category name');
      return;
    }
    if (!formData.vendorType) {
      alert('Please select a vendor type');
      return;
    }
    if (!formData.serviceStyle) {
      alert('Please select a service style');
      return;
    }

    try {
      setLoading(true);
      
      console.log('Creating parent category with data:', formData);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/categories/create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...formData,
            createdAt: new Date().toISOString()
          })
        }
      );

      const result = await response.json();
      console.log('Create category response:', result);

      if (response.ok) {
        console.log('Category created successfully, calling onSuccess');
        onSuccess();
        resetForm();
      } else {
        console.error('Failed to create category:', result);
        alert('Failed to create category. Please try again.');
      }
    } catch (error) {
      console.error('Error creating category:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      status: 'active',
      description: '',
      icon: 'Package',
      vendorType: '',
      serviceStyle: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Grid3x3 className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="text-lg">Create New Category</h2>
            </div>
            <p className="text-sm text-gray-500">
              Add a new parent category with vendor type and service style
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Category Name & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Category Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Veterinary Services"
              />
            </div>
            <div>
              <Label>Status *</Label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Vendor Type */}
          <div>
            <Label>Vendor Type *</Label>
            <VendorTypeSelector
              selectedType={formData.vendorType}
              onSelect={(value) => handleChange('vendorType', value)}
            />
          </div>

          {/* Service Style */}
          <div>
            <Label>Service Style *</Label>
            <ServiceStyleSelector
              selectedStyle={formData.serviceStyle}
              onSelect={(value) => handleChange('serviceStyle', value)}
            />
          </div>

          {/* Icon */}
          <div>
            <Label>Category Icon *</Label>
            <IconSelector
              selectedIcon={formData.icon}
              onSelect={(value) => handleChange('icon', value)}
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe your category in detail..."
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Note:</strong> After creating this parent category, you can add subcategories and then services under each subcategory with all required details.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.name || !formData.vendorType || !formData.serviceStyle}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Creating...' : 'Create Category'}
          </Button>
        </div>
      </div>
    </div>
  );
}