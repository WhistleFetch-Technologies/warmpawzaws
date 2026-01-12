import { X, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

interface EditServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: any;
  categoryName?: string;
  subCategoryName?: string;
  onSuccess: () => void;
}

export function EditServiceModal({ 
  isOpen, 
  onClose, 
  service,
  categoryName,
  subCategoryName,
  onSuccess 
}: EditServiceModalProps) {
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    serviceName: '',
    serviceCode: '',
    description: '',
    basePrice: '',
    duration: '',
    gstInclusion: '',
    gstRate: '',
    showFinalPrice: false,
    serviceType: 'at-home' as 'at-home' | 'at-center',
    status: 'active' as 'active' | 'inactive'
  });

  useEffect(() => {
    if (service) {
      setFormData({
        serviceName: service.name || '',
        serviceCode: service.code || '',
        description: service.description || '',
        basePrice: service.basePrice?.toString() || '',
        duration: service.duration || '',
        gstInclusion: service.gstInclusion || '',
        gstRate: service.gstRate?.toString() || '',
        showFinalPrice: service.showFinalPrice || false,
        serviceType: service.serviceType || 'at-home',
        status: service.status || 'active'
      });
    }
  }, [service]);

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.serviceName) {
      alert('Please enter a service name');
      return;
    }

    try {
      setLoading(true);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/catalog/services/${service.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...formData,
            updatedAt: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        onSuccess();
        onClose();
      } else {
        const error = await response.json();
        console.error('Error updating service:', error);
        alert(error.error || 'Failed to update service. Please try again.');
      }
    } catch (error) {
      console.error('Error updating service:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !service) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-5 py-3.5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base mb-0.5">Edit Service</h2>
            <p className="text-xs text-gray-500">
              {categoryName && subCategoryName 
                ? `${categoryName} > ${subCategoryName}`
                : 'Update service information'
              }
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3.5">
            {/* Service Name & Code */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Service Name *</Label>
                <Input
                  value={formData.serviceName}
                  onChange={(e) => handleChange('serviceName', e.target.value)}
                  placeholder="eg. Dental health care"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Service Code *</Label>
                <Input
                  value={formData.serviceCode}
                  onChange={(e) => handleChange('serviceCode', e.target.value)}
                  placeholder="eg. VET-001"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {/* Service Description */}
            <div>
              <Label className="text-xs">Service Description</Label>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs resize-none"
                rows={2}
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Describe your service in detail..."
              />
            </div>

            {/* Base Price & Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Base Price *</Label>
                <Input
                  type="number"
                  value={formData.basePrice}
                  onChange={(e) => handleChange('basePrice', e.target.value)}
                  placeholder="0.00"
                  className="h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Service Duration *</Label>
                <Select 
                  value={formData.duration} 
                  onValueChange={(value) => handleChange('duration', value)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15min">15 minutes</SelectItem>
                    <SelectItem value="30min">30 minutes</SelectItem>
                    <SelectItem value="45min">45 minutes</SelectItem>
                    <SelectItem value="1hr">1 hour</SelectItem>
                    <SelectItem value="2hr">2 hours</SelectItem>
                    <SelectItem value="3hr">3 hours</SelectItem>
                    <SelectItem value="4hr">4 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Service Type & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Service Type *</Label>
                <Select 
                  value={formData.serviceType} 
                  onValueChange={(value) => handleChange('serviceType', value as any)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="at-home">At Home (Fixed Pricing)</SelectItem>
                    <SelectItem value="at-center">At Center (Custom Pricing)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-gray-500 mt-1">
                  {formData.serviceType === 'at-home' 
                    ? 'Vendors must use exact pricing and cannot modify' 
                    : 'Vendors can set their own pricing for this service'}
                </p>
              </div>
              <div>
                <Label className="text-xs">Status *</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => handleChange('status', value as any)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* GST Configuration */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Info className="w-3.5 h-3.5 text-yellow-600" />
                <span className="text-xs">GST & Tax Configuration</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">GST Inclusion *</Label>
                  <Select 
                    value={formData.gstInclusion} 
                    onValueChange={(value) => handleChange('gstInclusion', value)}
                  >
                    <SelectTrigger className="bg-white h-9 text-sm">
                      <SelectValue placeholder="Select GST option" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inclusive">GST Inclusive</SelectItem>
                      <SelectItem value="exclusive">GST Exclusive</SelectItem>
                      <SelectItem value="none">No GST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">GST Rate (%)</Label>
                  <Select 
                    value={formData.gstRate} 
                    onValueChange={(value) => handleChange('gstRate', value)}
                  >
                    <SelectTrigger className="bg-white h-9 text-sm">
                      <SelectValue placeholder="Select GST rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="5">5%</SelectItem>
                      <SelectItem value="12">12%</SelectItem>
                      <SelectItem value="18">18%</SelectItem>
                      <SelectItem value="28">28%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showFinalPrice"
                  checked={formData.showFinalPrice}
                  onChange={(e) => handleChange('showFinalPrice', e.target.checked)}
                  className="w-3.5 h-3.5 text-[#FF8C42] rounded border-gray-300"
                />
                <label htmlFor="showFinalPrice" className="text-xs text-gray-700">
                  Show final price to customers (including all taxes)
                </label>
              </div>
            </div>

            {/* Warning about existing bookings */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-orange-600" />
                <p className="text-xs text-orange-800">
                  <strong>Note:</strong> Price changes will not affect existing bookings. Only new bookings will use the updated pricing.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 flex items-center justify-end gap-2 flex-shrink-0">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="h-9 text-sm px-4"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !formData.serviceName}
            className="bg-blue-600 hover:bg-blue-700 text-white h-9 text-sm px-4"
          >
            {loading ? 'Updating...' : 'Update Service'}
          </Button>
        </div>
      </div>
    </div>
  );
}