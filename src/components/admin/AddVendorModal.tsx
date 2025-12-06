import { X, Upload, Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface AddVendorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddVendorModal({ isOpen, onClose, onSuccess }: AddVendorModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    // Step 1: Basic Information
    businessName: '',
    ownerName: '',
    email: '',
    phone: '',
    alternatePhone: '',
    
    // Step 2: Business Details
    category: '',
    services: [] as string[],
    experience: '',
    registrationNumber: '',
    gstNumber: '',
    panNumber: '',
    
    // Step 3: Location & Address
    address: '',
    city: '',
    state: '',
    pincode: '',
    landmark: '',
    serviceAreas: [] as string[],
    
    // Step 4: Banking Details
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    
    // Step 5: Additional Details
    operatingHours: '',
    capacity: '',
    certifications: [] as string[],
    specialization: '',
    
    // Admin settings
    tier: 'Bronze',
    commission: '15',
    status: 'active'
  });

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
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/vendors/create`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...formData,
            createdBy: 'admin_1',
            createdAt: new Date().toISOString()
          })
        }
      );

      if (response.ok) {
        onSuccess();
        resetForm();
      } else {
        const error = await response.json();
        console.error('Error creating vendor:', error);
        alert('Failed to create vendor. Please try again.');
      }
    } catch (error) {
      console.error('Error creating vendor:', error);
      alert('An error occurred. Please try again.');
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
        return formData.category && formData.services.length > 0 && formData.experience;
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
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg mb-1">Add New Vendor</h2>
            <p className="text-sm text-gray-500">Step {currentStep} of 5</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-4 bg-gray-50">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex-1">
                <div className={`h-2 rounded-full ${step <= currentStep ? 'bg-[#FF8C42]' : 'bg-gray-200'}`} />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-600">
            <span>Basic Info</span>
            <span>Business</span>
            <span>Location</span>
            <span>Banking</span>
            <span>Additional</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Basic Information</h3>
              
              <div>
                <Label>Business Name *</Label>
                <Input
                  value={formData.businessName}
                  onChange={(e) => handleChange('businessName', e.target.value)}
                  placeholder="Enter business name"
                />
              </div>

              <div>
                <Label>Owner Name *</Label>
                <Input
                  value={formData.ownerName}
                  onChange={(e) => handleChange('ownerName', e.target.value)}
                  placeholder="Enter owner's full name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email Address *</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>

              <div>
                <Label>Alternate Phone Number</Label>
                <Input
                  type="tel"
                  value={formData.alternatePhone}
                  onChange={(e) => handleChange('alternatePhone', e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
            </div>
          )}

          {/* Step 2: Business Details */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Business Details</h3>
              
              <div>
                <Label>Category *</Label>
                <Select value={formData.category} onValueChange={(value) => handleChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="healthcare">Healthcare Providers</SelectItem>
                    <SelectItem value="grooming">Grooming & Day-care</SelectItem>
                    <SelectItem value="walking">Walkers & Sitters</SelectItem>
                    <SelectItem value="boarding">Boarding & Adoption</SelectItem>
                    <SelectItem value="training">Training Services</SelectItem>
                    <SelectItem value="retail">Retail & Products</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Services Offered * (Select all that apply)</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {['Veterinary', 'Grooming', 'Dog Walking', 'Training', 'Boarding', 'Day Care', 'Pet Sitting', 'Retail'].map((service) => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => handleServiceToggle(service)}
                      className={`px-4 py-2 rounded-lg border text-sm transition-colors ${
                        formData.services.includes(service)
                          ? 'bg-[#FF8C42] text-white border-[#FF8C42]'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-[#FF8C42]'
                      }`}
                    >
                      {formData.services.includes(service) && <Check className="w-4 h-4 inline mr-1" />}
                      {service}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Years of Experience *</Label>
                <Select value={formData.experience} onValueChange={(value) => handleChange('experience', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-1">0-1 years</SelectItem>
                    <SelectItem value="1-3">1-3 years</SelectItem>
                    <SelectItem value="3-5">3-5 years</SelectItem>
                    <SelectItem value="5-10">5-10 years</SelectItem>
                    <SelectItem value="10+">10+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Registration Number</Label>
                  <Input
                    value={formData.registrationNumber}
                    onChange={(e) => handleChange('registrationNumber', e.target.value)}
                    placeholder="Business registration no."
                  />
                </div>
                <div>
                  <Label>GST Number</Label>
                  <Input
                    value={formData.gstNumber}
                    onChange={(e) => handleChange('gstNumber', e.target.value)}
                    placeholder="GST number"
                  />
                </div>
              </div>

              <div>
                <Label>PAN Number</Label>
                <Input
                  value={formData.panNumber}
                  onChange={(e) => handleChange('panNumber', e.target.value)}
                  placeholder="PAN number"
                />
              </div>
            </div>
          )}

          {/* Step 3: Location & Address */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Location & Address</h3>
              
              <div>
                <Label>Complete Address *</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Street address, building name, etc."
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>City *</Label>
                  <Input
                    value={formData.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="City"
                  />
                </div>
                <div>
                  <Label>State *</Label>
                  <Select value={formData.state} onValueChange={(value) => handleChange('state', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Maharashtra">Maharashtra</SelectItem>
                      <SelectItem value="Karnataka">Karnataka</SelectItem>
                      <SelectItem value="Delhi">Delhi</SelectItem>
                      <SelectItem value="Tamil Nadu">Tamil Nadu</SelectItem>
                      <SelectItem value="Gujarat">Gujarat</SelectItem>
                      <SelectItem value="Rajasthan">Rajasthan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Pincode *</Label>
                  <Input
                    value={formData.pincode}
                    onChange={(e) => handleChange('pincode', e.target.value)}
                    placeholder="Pincode"
                    maxLength={6}
                  />
                </div>
              </div>

              <div>
                <Label>Landmark</Label>
                <Input
                  value={formData.landmark}
                  onChange={(e) => handleChange('landmark', e.target.value)}
                  placeholder="Nearby landmark"
                />
              </div>

              <div>
                <Label>Service Coverage Areas</Label>
                <Input
                  placeholder="e.g., Koramangala, Indiranagar, HSR Layout (comma separated)"
                  onChange={(e) => handleChange('serviceAreas', e.target.value.split(',').map(s => s.trim()))}
                />
              </div>
            </div>
          )}

          {/* Step 4: Banking Details */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Banking Details</h3>
              
              <div>
                <Label>Bank Name *</Label>
                <Input
                  value={formData.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                  placeholder="Enter bank name"
                />
              </div>

              <div>
                <Label>Account Holder Name *</Label>
                <Input
                  value={formData.accountHolderName}
                  onChange={(e) => handleChange('accountHolderName', e.target.value)}
                  placeholder="As per bank records"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Account Number *</Label>
                  <Input
                    value={formData.accountNumber}
                    onChange={(e) => handleChange('accountNumber', e.target.value)}
                    placeholder="Account number"
                  />
                </div>
                <div>
                  <Label>IFSC Code *</Label>
                  <Input
                    value={formData.ifscCode}
                    onChange={(e) => handleChange('ifscCode', e.target.value)}
                    placeholder="IFSC code"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Additional Details & Admin Settings */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <h3 className="text-sm mb-4">Additional Details</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Operating Hours</Label>
                  <Input
                    value={formData.operatingHours}
                    onChange={(e) => handleChange('operatingHours', e.target.value)}
                    placeholder="e.g., 9 AM - 8 PM"
                  />
                </div>
                <div>
                  <Label>Daily Capacity</Label>
                  <Input
                    value={formData.capacity}
                    onChange={(e) => handleChange('capacity', e.target.value)}
                    placeholder="e.g., 20 pets/day"
                  />
                </div>
              </div>

              <div>
                <Label>Specialization</Label>
                <Input
                  value={formData.specialization}
                  onChange={(e) => handleChange('specialization', e.target.value)}
                  placeholder="e.g., Large breed grooming, exotic pets"
                />
              </div>

              <div className="border-t border-gray-200 pt-4 mt-6">
                <h3 className="text-sm mb-4">Admin Settings</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Vendor Tier</Label>
                    <Select value={formData.tier} onValueChange={(value) => handleChange('tier', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bronze">Bronze</SelectItem>
                        <SelectItem value="Silver">Silver</SelectItem>
                        <SelectItem value="Gold">Gold</SelectItem>
                        <SelectItem value="Platinum">Platinum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Commission Rate (%)</Label>
                    <Input
                      type="number"
                      value={formData.commission}
                      onChange={(e) => handleChange('commission', e.target.value)}
                      placeholder="15"
                      min="0"
                      max="100"
                    />
                  </div>
                  <div>
                    <Label>Initial Status</Label>
                    <Select value={formData.status} onValueChange={(value) => handleChange('status', value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending Review</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onClose : prevStep}
          >
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>
          
          {currentStep < 5 ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              Continue
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            >
              {loading ? 'Creating...' : 'Create Vendor'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
