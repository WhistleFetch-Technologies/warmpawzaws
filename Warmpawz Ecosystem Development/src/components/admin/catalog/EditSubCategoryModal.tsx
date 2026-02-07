import { X, Grid3x3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface EditSubCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  subcategory: any;
  parentCategoryName: string;
}

export function EditSubCategoryModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  subcategory,
  parentCategoryName 
}: EditSubCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    status: 'active',
    description: ''
  });

  useEffect(() => {
    if (subcategory) {
      setFormData({
        name: subcategory.name || '',
        status: subcategory.status || 'active',
        description: subcategory.description || ''
      });
    }
  }, [subcategory]);

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
      
      console.log('Updating subcategory with data:', formData);
      
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/subcategories/${subcategory.id}`,
        {
          method: 'PUT',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(formData)
        }
      );

      const result = await response.json();
      console.log('Update subcategory response:', result);

      if (response.ok) {
        console.log('Subcategory updated successfully');
        onSuccess();
        onClose();
      } else {
        console.error('Failed to update subcategory:', result);
        alert(result.error || 'Failed to update subcategory. Please try again.');
      }
    } catch (error) {
      console.error('Error updating subcategory:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !subcategory) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Grid3x3 className="w-4 h-4 text-[#FF8C42]" />
              <h2 className="text-base">Edit Subcategory</h2>
            </div>
            <p className="text-xs text-gray-500">
              Update subcategory under <strong>{parentCategoryName}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Subcategory Name & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Subcategory Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="e.g. Dental Care"
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Status *</Label>
              <select
                className="w-full h-9 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
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
            <Label className="text-xs">Description</Label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs resize-none"
              rows={2}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe your subcategory in detail..."
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-800">
              <strong>ℹ️ Note:</strong> Changes to the subcategory will not affect existing services or bookings.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 flex justify-end gap-2 flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="text-red-600 border-red-600 hover:bg-red-50 h-9 text-sm px-4"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.name}
            className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm px-4"
          >
            {loading ? 'Updating...' : 'Update Subcategory'}
          </Button>
        </div>
      </div>
    </div>
  );
}