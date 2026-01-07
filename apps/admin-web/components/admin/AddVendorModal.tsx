'use client';

import { X, Upload, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button, Input } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddVendorModal({ isOpen, onClose, onSuccess }: AddVendorModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    alternatePhone: '',
    roleId: '',
    category: '',
    services: [] as string[],
    experience: '',
    registrationNumber: '',
    gstNumber: '',
    panNumber: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    serviceAreas: [] as string[],
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    operatingHours: '',
    capacity: '',
    certifications: [] as string[],
    specialization: '',
    tier: 'Bronze',
    commission: '15',
    status: 'active'
  });

  useEffect(() => {
    if (isOpen) {
      loadRoles();
    }
  }, [isOpen]);

  const loadRoles = async () => {
    try {
      setRolesLoading(true);
      const data = await apiClient.get<any>('/config/roles');
      setAvailableRoles(data.roles || []);
    } catch (error) {
      console.error('Error loading roles:', error);
    } finally {
      setRolesLoading(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleServiceToggle = (service: string) => {
    setFormData(prev => ({
      ...prev,
      services: prev.services.includes(service)
        ? prev.services.filter(s => s !== service)
        : [...prev.services, service]
    }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      await apiClient.post('/admin/vendors/create', {
        ...formData,
        createdBy: 'admin_1',
        createdAt: new Date().toISOString()
      });

      alert('Vendor created successfully');
      resetForm();
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error creating vendor:', error);
      alert(error.message || 'Failed to create vendor. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setFormData({
      businessName: '',
      ownerName: '',
      email: '',
      phone: '',
      alternatePhone: '',
      roleId: '',
      category: '',
      services: [],
      experience: '',
      registrationNumber: '',
      gstNumber: '',
      panNumber: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      landmark: '',
      serviceAreas: [],
      bankName: '',
      accountNumber: '',
      ifscCode: '',
      accountHolderName: '',
      operatingHours: '',
      capacity: '',
      certifications: [],
      specialization: '',
      tier: 'Bronze',
      commission: '15',
      status: 'active'
    });
  };

  const nextStep = () => {
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.businessName && formData.ownerName && formData.email && formData.phone;
      case 2:
        return formData.roleId && formData.category && formData.services.length > 0 && formData.experience;
      case 3:
        return formData.address && formData.city && formData.state && formData.pincode;
      case 4:
        return formData.bankName && formData.accountNumber && formData.ifscCode && formData.accountHolderName;
      case 5:
        return true;
      default:
        return false;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-0 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg mb-0">Add New Vendor</h2>
            <p className="text-sm text-gray-500">Step {currentStep} of 5</p>
          </div>
          <button onClick={onClose} className="p-0 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-0 py-4 bg-gray-50">
          <div className="flex items-center gap-0">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex-1">
                <div className={`h-2 rounded-full ${step <= currentStep ? 'bg-[#FF8C42]' : 'bg-gray-200'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Basic Information</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Business Name *</label>
                <Input
                  value={formData.businessName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('businessName', e.target.value)}
                  placeholder="Enter business name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Owner Name *</label>
                <Input
                  value={formData.ownerName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('ownerName', e.target.value)}
                  placeholder="Enter owner's full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Email Address *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('email', e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Phone Number *</label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('phone', e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Business Details */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Business Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Role/Category *</label>
                <select value={formData.roleId} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('roleId', e.target.value)} className="w-full px-4 py-0 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none">
                  <option value="">Select role</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.roleName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Experience *</label>
                <Input
                  value={formData.experience}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('experience', e.target.value)}
                  placeholder="e.g., 5 years"
                />
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Location & Address</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Address *</label>
                <Input
                  value={formData.address}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('address', e.target.value)}
                  placeholder="Street address"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">City *</label>
                  <Input
                    value={formData.city}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">State *</label>
                  <Input
                    value={formData.state}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('state', e.target.value)}
                    placeholder="State"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Pincode *</label>
                <Input
                  value={formData.pincode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('pincode', e.target.value)}
                  placeholder="Pincode"
                />
              </div>
            </div>
          )}

          {/* Step 4: Banking */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Banking Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Bank Name *</label>
                <Input
                  value={formData.bankName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('bankName', e.target.value)}
                  placeholder="Bank name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-0">Account Number *</label>
                <Input
                  value={formData.accountNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('accountNumber', e.target.value)}
                  placeholder="Account number"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">IFSC Code *</label>
                  <Input
                    value={formData.ifscCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('ifscCode', e.target.value)}
                    placeholder="IFSC code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Account Holder Name *</label>
                  <Input
                    value={formData.accountHolderName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('accountHolderName', e.target.value)}
                    placeholder="Account holder name"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Additional */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Additional Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Tier</label>
                  <select value={formData.tier} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('tier', e.target.value)} className="w-full px-4 py-0 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none">
                      <option value="">Select tier</option>
                      <option value="Bronze">Bronze</option>
                      <option value="Silver">Silver</option>
                      <option value="Gold">Gold</option>
                    
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-0">Commission %</label>
                  <Input
                    value={formData.commission}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('commission', e.target.value)}
                    placeholder="15"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-0 py-4 border-t border-gray-200 flex items-center justify-between">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
            Previous
          </Button>
          
          <div className="flex gap-0">
            {currentStep < 5 ? (
              <Button onClick={nextStep} disabled={!canProceed()}>
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed() || loading}>
                {loading ? 'Creating...' : 'Create Vendor'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

