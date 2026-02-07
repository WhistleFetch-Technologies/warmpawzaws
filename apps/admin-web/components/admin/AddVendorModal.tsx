'use client';

import { X, Upload, Check, User, Building2, FileText, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button, Input } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { EnhancedAddressAutocomplete, AddressComponents } from '@/components/admin/shared/EnhancedAddressAutocomplete';

interface UploadedDocument {
  type: string;
  name: string;
  url?: string;
  file?: File;
  uploading?: boolean;
}

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
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState('');
  
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    alternatePhone: '',
    roleId: '',
    category: '',
    vendorType: 'business' as 'solo' | 'business', // ✅ NEW: Vendor type
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

  const documentTypes = [
    { value: 'gst_certificate', label: 'GST Certificate' },
    { value: 'pan_card', label: 'PAN Card' },
    { value: 'business_license', label: 'Business License' },
    { value: 'address_proof', label: 'Address Proof' },
    { value: 'identity_proof', label: 'Identity Proof' },
    { value: 'veterinary_license', label: 'Veterinary License' },
    { value: 'profile_photo', label: 'Profile Photo' },
    { value: 'other', label: 'Other Document' }
  ];

  useEffect(() => {
    if (isOpen) {
      loadRoles();
    }
  }, [isOpen]);

  const loadRoles = async () => {
    try {
      setRolesLoading(true);
      // Try /admin/roles first (preferred), fallback to /config/roles
      let data: any;
      try {
        data = await apiClient.get<any>('/admin/roles');
        if (data.success && data.roles) {
          setAvailableRoles(data.roles || []);
          return;
        }
      } catch (err) {
        console.warn('Failed to load from /admin/roles, trying /config/roles:', err);
      }
      
      // Fallback to /config/roles
      data = await apiClient.get<any>('/config/roles');
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDocType) return;

    const newDoc: UploadedDocument = {
      type: selectedDocType,
      name: file.name,
      file,
      uploading: true
    };

    setUploadedDocuments(prev => [...prev, newDoc]);
    
    // Upload the file
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('documentType', selectedDocType);
      formDataUpload.append('vendorId', 'new-vendor'); // Temporary ID for new vendors

      // Use fetch directly for FormData uploads
      const response = await fetch('/api/storage/upload', {
        method: 'POST',
        body: formDataUpload
      });
      
      const result = await response.json();

      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.type === selectedDocType && doc.name === file.name
            ? { ...doc, url: result.url || result.fileUrl, uploading: false }
            : doc
        )
      );
    } catch (error) {
      console.error('Error uploading document:', error);
      // Keep the document in list but mark as failed
      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.type === selectedDocType && doc.name === file.name
            ? { ...doc, uploading: false }
            : doc
        )
      );
    }

    setSelectedDocType('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveDocument = (index: number) => {
    setUploadedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Prepare documents data
      const documentsData = uploadedDocuments.reduce((acc, doc) => {
        if (doc.url) {
          acc[doc.type] = { url: doc.url, name: doc.name };
        }
        return acc;
      }, {} as Record<string, { url: string; name: string }>);

      await apiClient.post('/admin/vendors/create', {
        ...formData,
        uploadedDocuments: documentsData,
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
    setUploadedDocuments([]);
    setFormData({
      businessName: '',
      ownerName: '',
      email: '',
      phone: '',
      alternatePhone: '',
      roleId: '',
      category: '',
      vendorType: 'business',
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
        // Solo vendors don't need owner name
        if (formData.vendorType === 'solo') {
          return formData.businessName && formData.email && formData.phone;
        }
        return formData.businessName && formData.ownerName && formData.email && formData.phone;
      case 2:
        return formData.roleId && formData.experience;
      case 3:
        return formData.address && formData.city && formData.state && formData.pincode;
      case 4:
        // Bank details are optional for initial creation
        return true;
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
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Add New Vendor</h2>
            <p className="text-sm text-gray-500">Step {currentStep} of 5</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex items-center gap-3">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex-1">
                <div className={`h-2 rounded-full transition-colors ${step <= currentStep ? 'bg-[#FF8C42]' : 'bg-gray-200'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Basic Info</span>
            <span>Service</span>
            <span>Location</span>
            <span>Banking</span>
            <span>Documents</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold mb-4">Basic Information</h3>
              
              {/* Vendor Type Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Vendor Type *</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleChange('vendorType', 'business')}
                    className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                      formData.vendorType === 'business' 
                        ? 'border-[#FF8C42] bg-orange-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.vendorType === 'business' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">Business</div>
                      <div className="text-xs text-gray-500">Clinic, Salon, Center with staff</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('vendorType', 'solo')}
                    className={`p-4 border-2 rounded-xl flex items-center gap-3 transition-all ${
                      formData.vendorType === 'solo' 
                        ? 'border-[#FF8C42] bg-orange-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      formData.vendorType === 'solo' ? 'bg-[#FF8C42] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <User className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-medium text-gray-900">Solo Provider</div>
                      <div className="text-xs text-gray-500">Individual working independently</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.vendorType === 'solo' ? 'Full Name *' : 'Business Name *'}
                </label>
                <Input
                  value={formData.businessName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('businessName', e.target.value)}
                  placeholder={formData.vendorType === 'solo' ? 'Enter your full name' : 'Enter business name'}
                />
              </div>

              {formData.vendorType === 'business' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                  <Input
                    value={formData.ownerName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('ownerName', e.target.value)}
                    placeholder="Enter owner's full name"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('email', e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
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
              <h3 className="text-sm font-semibold mb-4">Service Details</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Category *</label>
                <select 
                  value={formData.roleId} 
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('roleId', e.target.value)} 
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                >
                  <option value="">Select service category</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.displayName || role.roleName || role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Experience *</label>
                <Input
                  value={formData.experience}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('experience', e.target.value)}
                  placeholder="e.g., 5 years"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                <Input
                  value={formData.specialization}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('specialization', e.target.value)}
                  placeholder="e.g., Large breeds, Exotic pets, Surgery"
                />
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold mb-4">Location & Address</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                <EnhancedAddressAutocomplete
                  value={formData.address}
                  onChange={(address: string, components?: AddressComponents) => {
                    handleChange('address', address);
                    // Auto-populate city, state, pincode from Google Maps selection
                    if (components) {
                      if (components.city) handleChange('city', components.city);
                      if (components.state) handleChange('state', components.state);
                      if (components.pincode) handleChange('pincode', components.pincode);
                      if (components.landmark) handleChange('landmark', components.landmark);
                    }
                  }}
                  placeholder="Search address, landmark, city..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                <Input
                  value={formData.landmark}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('landmark', e.target.value)}
                  placeholder="Near landmark"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <Input
                    value={formData.city}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                  <Input
                    value={formData.state}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('state', e.target.value)}
                    placeholder="State"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                <Input
                  value={formData.pincode}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('pincode', e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  placeholder="6-digit pincode"
                  maxLength={6}
                />
              </div>
            </div>
          )}

          {/* Step 4: Banking */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold mb-4">Banking Details (Optional)</h3>
              <p className="text-xs text-gray-500 mb-4">Bank details can be added later by the vendor</p>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <Input
                  value={formData.bankName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('bankName', e.target.value)}
                  placeholder="Bank name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                <Input
                  value={formData.accountNumber}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('accountNumber', e.target.value)}
                  placeholder="Account number"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                  <Input
                    value={formData.ifscCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('ifscCode', e.target.value)}
                    placeholder="IFSC code"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                  <Input
                    value={formData.accountHolderName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('accountHolderName', e.target.value)}
                    placeholder="Account holder name"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Documents & Additional */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold mb-4">Documents & Additional Details</h3>
              
              {/* Document Upload Section */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">Upload Documents</h4>
                
                <div className="flex gap-3 mb-4">
                  <select 
                    value={selectedDocType}
                    onChange={(e) => setSelectedDocType(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  >
                    <option value="">Select document type</option>
                    {documentTypes.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!selectedDocType}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                </div>

                {/* Uploaded Documents List */}
                {uploadedDocuments.length > 0 && (
                  <div className="space-y-2">
                    {uploadedDocuments.map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium">{doc.name}</div>
                            <div className="text-xs text-gray-500">
                              {documentTypes.find(dt => dt.value === doc.type)?.label || doc.type}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.uploading ? (
                            <span className="text-xs text-blue-600">Uploading...</span>
                          ) : doc.url ? (
                            <span className="text-xs text-green-600">✓ Uploaded</span>
                          ) : (
                            <span className="text-xs text-red-600">Failed</span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveDocument(idx)}
                            className="p-1 hover:bg-red-50 rounded text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {uploadedDocuments.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No documents uploaded yet</p>
                )}
              </div>

              {/* Tier & Commission */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                  <select 
                    value={formData.tier} 
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('tier', e.target.value)} 
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  >
                    <option value="">Select tier</option>
                    <option value="Bronze">Bronze</option>
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Platinum">Platinum</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission %</label>
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
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 1}>
            Previous
          </Button>
          
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {currentStep < 5 ? (
              <Button onClick={nextStep} disabled={!canProceed()} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
                Next
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed() || loading} className="bg-green-600 hover:bg-green-700">
                {loading ? 'Creating...' : 'Create Vendor'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

