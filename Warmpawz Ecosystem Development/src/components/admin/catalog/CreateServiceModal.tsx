import { X, Info, Calendar, Clock, Repeat } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Checkbox } from '../../ui/checkbox';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface CreateServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryId: string | null;
  subCategoryId: string | null;
  categoryName?: string;
  subCategoryName?: string;
  onSuccess: () => void;
}

export function CreateServiceModal({ 
  isOpen, 
  onClose, 
  categoryId, 
  subCategoryId, 
  categoryName,
  subCategoryName,
  onSuccess 
}: CreateServiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    serviceName: '',
    serviceCode: '',
    description: '',
    parentCategory: categoryId || '',
    subCategory: subCategoryId || '',
    basePrice: '',
    duration: '',
    gstInclusion: '',
    gstRate: '',
    showFinalPrice: false,
    serviceType: 'at-home' as 'at-home' | 'at-center',
    
    // Subscription configuration
    enableSubscription: false,
    subscriptionType: 'weekly' as 'weekly' | 'monthly' | 'one-time',
    walksPerDay: '1',
    sessionDuration: '30min',
    numberOfDays: '1',
    daysOfWeek: [] as string[],
    
    // Pricing for different subscription plans
    weeklyOneWalkPrice: '',
    weeklyTwoWalksPrice: '',
    monthlyOneWalkPrice: '',
    monthlyTwoWalksPrice: ''
  });

  const daysOfWeekOptions = [
    { value: 'monday', label: 'Mon' },
    { value: 'tuesday', label: 'Tue' },
    { value: 'wednesday', label: 'Wed' },
    { value: 'thursday', label: 'Thu' },
    { value: 'friday', label: 'Fri' },
    { value: 'saturday', label: 'Sat' },
    { value: 'sunday', label: 'Sun' }
  ];

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      // Reset form with provided category/subcategory IDs
      setFormData(prev => ({
        ...prev,
        parentCategory: categoryId || '',
        subCategory: subCategoryId || ''
      }));
    }
  }, [isOpen, categoryId, subCategoryId]);

  useEffect(() => {
    if (formData.parentCategory) {
      loadSubCategories(formData.parentCategory);
    }
  }, [formData.parentCategory]);

  const loadCategories = async () => {
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/categories`,
        {
          headers: {
            ...getAuthHeaders()
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadSubCategories = async (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    if (category) {
      setSubCategories(category.subCategories || []);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleDayOfWeek = (day: string) => {
    setFormData(prev => {
      const currentDays = prev.daysOfWeek;
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day];
      return { ...prev, daysOfWeek: newDays };
    });
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/services/create`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...formData,
            createdAt: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        onSuccess();
        resetForm();
      } else {
        const error = await response.json();
        console.error('Error creating service:', error);
        alert('Failed to create service. Please try again.');
      }
    } catch (error) {
      console.error('Error creating service:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      serviceName: '',
      serviceCode: '',
      description: '',
      parentCategory: '',
      subCategory: '',
      basePrice: '',
      duration: '',
      gstInclusion: '',
      gstRate: '',
      showFinalPrice: false,
      serviceType: 'at-home',
      enableSubscription: false,
      subscriptionType: 'weekly',
      walksPerDay: '1',
      sessionDuration: '30min',
      numberOfDays: '1',
      daysOfWeek: [],
      weeklyOneWalkPrice: '',
      weeklyTwoWalksPrice: '',
      monthlyOneWalkPrice: '',
      monthlyTwoWalksPrice: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B1A] px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg mb-1 text-white">Create New Service</h2>
            <p className="text-sm text-white/90">
              {categoryName && subCategoryName 
                ? `Adding service to: ${categoryName} > ${subCategoryName}`
                : categoryName
                ? `Adding service to: ${categoryName}`
                : 'Add a new service to the selected category and subcategory'
              }
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <h3 className="text-base mb-4 flex items-center gap-2">
                <Info className="w-4 h-4 text-[#FF8C42]" />
                Basic Information
              </h3>
              
              <div className="space-y-4">
                {/* Service Name & Code */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Service Name *</Label>
                    <Input
                      value={formData.serviceName}
                      onChange={(e) => handleChange('serviceName', e.target.value)}
                      placeholder="e.g., Daily Dog Walking"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Service Code *</Label>
                    <Input
                      value={formData.serviceCode}
                      onChange={(e) => handleChange('serviceCode', e.target.value)}
                      placeholder="e.g., WALK-001"
                      className="mt-1"
                    />
                  </div>
                </div>

                {/* Service Description */}
                <div>
                  <Label>Service Description</Label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none mt-1"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Describe your service in detail..."
                  />
                </div>

                {/* Parent Category & Sub-Category */}
                {!categoryId && !subCategoryId && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Parent Category *</Label>
                      <Select 
                        value={formData.parentCategory} 
                        onValueChange={(value) => handleChange('parentCategory', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Sub-Category *</Label>
                      <Select 
                        value={formData.subCategory} 
                        onValueChange={(value) => handleChange('subCategory', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          {subCategories.map(sub => (
                            <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Show only subcategory selector if category is selected but subcategory is not */}
                {categoryId && !subCategoryId && (
                  <div>
                    <Label>Sub-Category *</Label>
                    <Select 
                      value={formData.subCategory} 
                      onValueChange={(value) => handleChange('subCategory', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        {subCategories.map(sub => (
                          <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Base Price & Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Base Price (₹) *</Label>
                    <Input
                      type="number"
                      value={formData.basePrice}
                      onChange={(e) => handleChange('basePrice', e.target.value)}
                      placeholder="0.00"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">One-time service base price</p>
                  </div>
                  <div>
                    <Label>Service Duration *</Label>
                    <Select 
                      value={formData.duration} 
                      onValueChange={(value) => handleChange('duration', value)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select duration" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15min">15 minutes</SelectItem>
                        <SelectItem value="30min">30 minutes</SelectItem>
                        <SelectItem value="45min">45 minutes</SelectItem>
                        <SelectItem value="1hr">1 hour</SelectItem>
                        <SelectItem value="1.5hr">1.5 hours</SelectItem>
                        <SelectItem value="2hr">2 hours</SelectItem>
                        <SelectItem value="3hr">3 hours</SelectItem>
                        <SelectItem value="4hr">4 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Service Type */}
                <div>
                  <Label>Service Type *</Label>
                  <Select 
                    value={formData.serviceType} 
                    onValueChange={(value) => handleChange('serviceType', value as any)}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="at-home">At Home (Fixed Pricing)</SelectItem>
                      <SelectItem value="at-center">At Center (Custom Pricing)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.serviceType === 'at-home' 
                      ? 'Vendors must use exact pricing and cannot modify' 
                      : 'Vendors can set their own pricing for this service'}
                  </p>
                </div>
              </div>
            </div>

            {/* Subscription Configuration Section */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-[#FF8C42]" />
                  Subscription Plans (Optional)
                </h3>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="enableSubscription"
                    checked={formData.enableSubscription}
                    onCheckedChange={(checked) => handleChange('enableSubscription', checked)}
                  />
                  <label htmlFor="enableSubscription" className="text-sm cursor-pointer">
                    Enable Subscription Plans
                  </label>
                </div>
              </div>

              {formData.enableSubscription && (
                <div className="space-y-5 bg-white rounded-lg p-5 border border-blue-100">
                  {/* Subscription Type */}
                  <div>
                    <Label>Subscription Type *</Label>
                    <div className="grid grid-cols-3 gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => handleChange('subscriptionType', 'weekly')}
                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                          formData.subscriptionType === 'weekly'
                            ? 'border-[#FF8C42] bg-[#FF8C42]/10 text-[#FF8C42]'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Calendar className="w-4 h-4 mx-auto mb-1" />
                        <div className="text-sm">Weekly</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('subscriptionType', 'monthly')}
                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                          formData.subscriptionType === 'monthly'
                            ? 'border-[#FF8C42] bg-[#FF8C42]/10 text-[#FF8C42]'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Calendar className="w-4 h-4 mx-auto mb-1" />
                        <div className="text-sm">Monthly</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange('subscriptionType', 'one-time')}
                        className={`px-4 py-3 rounded-lg border-2 transition-all ${
                          formData.subscriptionType === 'one-time'
                            ? 'border-[#FF8C42] bg-[#FF8C42]/10 text-[#FF8C42]'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Clock className="w-4 h-4 mx-auto mb-1" />
                        <div className="text-sm">One-Time</div>
                      </button>
                    </div>
                  </div>

                  {/* Session Configuration */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Sessions Per Day *</Label>
                      <Select 
                        value={formData.walksPerDay} 
                        onValueChange={(value) => handleChange('walksPerDay', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Session</SelectItem>
                          <SelectItem value="2">2 Sessions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Session Duration *</Label>
                      <Select 
                        value={formData.sessionDuration} 
                        onValueChange={(value) => handleChange('sessionDuration', value)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15min">15 minutes</SelectItem>
                          <SelectItem value="30min">30 minutes</SelectItem>
                          <SelectItem value="45min">45 minutes</SelectItem>
                          <SelectItem value="1hr">1 hour</SelectItem>
                          <SelectItem value="1.5hr">1.5 hours</SelectItem>
                          <SelectItem value="2hr">2 hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Number of Days */}
                  <div>
                    <Label>Number of Days (Duration) *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={formData.numberOfDays}
                      onChange={(e) => handleChange('numberOfDays', e.target.value)}
                      placeholder="e.g., 7 for weekly, 30 for monthly"
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Total number of days the subscription runs
                    </p>
                  </div>

                  {/* Days of Week Selection */}
                  <div>
                    <Label>Active Days of Week *</Label>
                    <div className="flex gap-2 mt-2">
                      {daysOfWeekOptions.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => toggleDayOfWeek(day.value)}
                          className={`flex-1 py-2 rounded-lg border-2 transition-all ${
                            formData.daysOfWeek.includes(day.value)
                              ? 'border-[#FF8C42] bg-[#FF8C42] text-white'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="text-sm">{day.label}</div>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Select the days when the service will be provided
                    </p>
                  </div>

                  {/* Pricing Configuration */}
                  <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                    <h4 className="text-sm mb-3 flex items-center gap-2">
                      <span className="text-amber-700">💰</span>
                      Subscription Pricing
                    </h4>
                    
                    <div className="space-y-3">
                      {/* Weekly Pricing */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Weekly - 1 Session/Day (₹)</Label>
                          <Input
                            type="number"
                            value={formData.weeklyOneWalkPrice}
                            onChange={(e) => handleChange('weeklyOneWalkPrice', e.target.value)}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Weekly - 2 Sessions/Day (₹)</Label>
                          <Input
                            type="number"
                            value={formData.weeklyTwoWalksPrice}
                            onChange={(e) => handleChange('weeklyTwoWalksPrice', e.target.value)}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>
                      </div>

                      {/* Monthly Pricing */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Monthly - 1 Session/Day (₹)</Label>
                          <Input
                            type="number"
                            value={formData.monthlyOneWalkPrice}
                            onChange={(e) => handleChange('monthlyOneWalkPrice', e.target.value)}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Monthly - 2 Sessions/Day (₹)</Label>
                          <Input
                            type="number"
                            value={formData.monthlyTwoWalksPrice}
                            onChange={(e) => handleChange('monthlyTwoWalksPrice', e.target.value)}
                            placeholder="0.00"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* GST Configuration */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4 text-yellow-600" />
                <span className="text-base">GST & Tax Configuration</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>GST Inclusion *</Label>
                  <Select 
                    value={formData.gstInclusion} 
                    onValueChange={(value) => handleChange('gstInclusion', value)}
                  >
                    <SelectTrigger className="bg-white mt-1">
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
                  <Label>GST Rate (%) *</Label>
                  <Select 
                    value={formData.gstRate} 
                    onValueChange={(value) => handleChange('gstRate', value)}
                  >
                    <SelectTrigger className="bg-white mt-1">
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

              <div className="mt-4 flex items-center gap-2">
                <Checkbox
                  id="showFinalPrice"
                  checked={formData.showFinalPrice}
                  onCheckedChange={(checked) => handleChange('showFinalPrice', checked)}
                />
                <label htmlFor="showFinalPrice" className="text-sm text-gray-700 cursor-pointer">
                  Show final price to customers (including all taxes)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            * Required fields
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !formData.serviceName || !formData.parentCategory}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white px-6"
            >
              {loading ? 'Creating...' : 'Create Service'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
