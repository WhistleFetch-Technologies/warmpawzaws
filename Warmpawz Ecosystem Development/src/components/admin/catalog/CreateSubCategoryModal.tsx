import { X, Grid3x3 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { IconSelector } from './IconSelector';

interface CreateSubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  parentCategoryId: string;
  parentCategoryName: string;
}

export function CreateSubCategoryModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  parentCategoryId,
  parentCategoryName 
}: CreateSubCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    status: 'active',
    description: '',
    icon: 'Package'
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('Please enter a subcategory name');
      return;
    }

    try {
      setLoading(true);
      
      console.log('Creating subcategory with data:', formData);
      
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/subcategories/create`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...formData,
            parentCategory: parentCategoryId,
            createdAt: new Date().toISOString()
          })
        }
      );

      const result = await response.json();
      console.log('Create subcategory response:', result);

      if (response.ok) {
        console.log('Subcategory created successfully');
        onSuccess();
        resetForm();
      } else {
        console.error('Failed to create subcategory:', result);
        alert('Failed to create subcategory. Please try again.');
      }
    } catch (error) {
      console.error('Error creating subcategory:', error);
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
      icon: 'Package'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Grid3x3 className="w-5 h-5 text-[#FF8C42]" />
              <h2 className="text-lg">Add Subcategory</h2>
            </div>
            <p className="text-sm text-gray-500">
              Add subcategory under <strong>{parentCategoryName}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Subcategory Name & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Subcategory Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Dental Care"
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

          {/* Description */}
          <div>
            <Label>Description</Label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe your subcategory in detail..."
            />
          </div>

          {/* Icon Selector */}
          <div>
            <Label>Icon</Label>
            <IconSelector
              selectedIcon={formData.icon}
              onSelect={(icon) => handleChange('icon', icon)}
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Note:</strong> After creating this subcategory, you can add services under it with all required details (pricing, duration, GST, etc.)
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
            disabled={loading || !formData.name}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Creating...' : 'Create Subcategory'}
          </Button>
        </div>
      </div>
    </div>
  );
}