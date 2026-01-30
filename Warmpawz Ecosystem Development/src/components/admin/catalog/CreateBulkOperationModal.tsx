import { X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';
import { authenticatedPost } from '../../../utils/authenticatedFetch'; // ✅ FIX: Add authenticated fetch

interface CreateBulkOperationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateBulkOperationModal({ isOpen, onClose, onSuccess }: CreateBulkOperationModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'Price Update' as 'Price Update' | 'Status Change' | 'Export',
    items: '',
    description: ''
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // ✅ FIX: Use authenticatedPost instead of fetch with publicAnonKey
      const response = await authenticatedPost(
        `${getApiBaseUrl()}/admin/catalog/bulk-operations/create`,
        {
          ...formData,
          items: parseInt(formData.items) || 0,
          createdAt: new Date().toISOString()
        }
      );

      if (response.ok) {
        onSuccess();
        resetForm();
      } else {
        alert('Failed to create operation. Please try again.');
      }
    } catch (error) {
      console.error('Error creating operation:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'Price Update',
      items: '',
      description: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg">Create Bulk Operation</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label>Operation Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Update prices for Grooming services"
            />
          </div>

          <div>
            <Label>Operation Type</Label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value as any)}
            >
              <option value="Price Update">Price Update</option>
              <option value="Status Change">Status Change</option>
              <option value="Export">Export</option>
            </select>
          </div>

          <div>
            <Label>Number of Items</Label>
            <Input
              type="number"
              value={formData.items}
              onChange={(e) => handleChange('items', e.target.value)}
              placeholder="0"
            />
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none"
              rows={3}
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Describe the operation..."
            />
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.name}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
          >
            {loading ? 'Creating...' : 'Create Operation'}
          </Button>
        </div>
      </div>
    </div>
  );
}