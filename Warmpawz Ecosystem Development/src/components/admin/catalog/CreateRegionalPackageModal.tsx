import { useState, useEffect } from 'react';
import { X, Package, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Card } from '../../ui/card';
import { RegionalAvailabilitySelector } from './RegionalAvailabilitySelector';
import { RegionalPricingEditor } from './RegionalPricingEditor';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';

interface Region {
  regionId: string;
  regionName: string;
  regionCode: string;
  isActive: boolean;
  currency: {
    code: string;
    symbol: string;
    symbolPosition: 'before' | 'after';
  };
  business: {
    taxRate: number;
    taxName: string;
  };
}

interface RegionalAvailability {
  mode: 'all' | 'specific' | 'exclude';
  regions: string[];
}

interface RegionalPricing {
  regionId: string;
  basePrice: number;
  currency: string;
  symbol: string;
  taxRate?: number;
  customTaxName?: string;
}

interface CreateRegionalPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PACKAGE_CATEGORIES = [
  { id: 'veterinary', name: 'Veterinary Services' },
  { id: 'grooming', name: 'Grooming & Spa' },
  { id: 'training', name: 'Training & Behavior' },
  { id: 'walking', name: 'Walking & Exercise' },
  { id: 'boarding', name: 'Boarding & Daycare' },
  { id: 'petCafe', name: 'Pet Cafe' },
  { id: 'insurance', name: 'Insurance' },
  { id: 'pharmacy', name: 'Pharmacy & Medicine' },
  { id: 'adoption', name: 'Adoption Services' },
  { id: 'sunset', name: 'Sunset Services' },
];

const PACKAGE_TYPES = [
  { id: 'bundle', name: 'Bundle Package', desc: 'Multiple services together' },
  { id: 'time_based', name: 'Time-Based', desc: 'Valid for specific duration' },
  { id: 'appointment', name: 'Appointment Package', desc: 'Limited appointments' },
  { id: 'membership', name: 'Membership', desc: 'Recurring benefits' },
  { id: 'subscription', name: 'Subscription', desc: 'Monthly/Yearly plan' },
];

export function CreateRegionalPackageModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateRegionalPackageModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingRegions, setLoadingRegions] = useState(true);
  const [regions, setRegions] = useState<Region[]>([]);
  const [currentStep, setCurrentStep] = useState(1);

  // Form data
  const [packageName, setPackageName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [packageType, setPackageType] = useState('bundle');
  const [validityPeriod, setValidityPeriod] = useState('');
  const [validityType, setValidityType] = useState('months');
  const [terms, setTerms] = useState('');

  // Regional configuration
  const [regionalAvailability, setRegionalAvailability] = useState<RegionalAvailability>({
    mode: 'all',
    regions: [],
  });
  const [regionalPricing, setRegionalPricing] = useState<RegionalPricing[]>([]);

  // Load regions on mount
  useEffect(() => {
    if (isOpen) {
      loadRegions();
    }
  }, [isOpen]);

  const loadRegions = async () => {
    try {
      setLoadingRegions(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/regions`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRegions(data.regions || []);
      }
    } catch (error) {
      console.error('Error loading regions:', error);
      toast.error('Failed to load regions');
    } finally {
      setLoadingRegions(false);
    }
  };

  const validateStep1 = (): boolean => {
    if (!packageName.trim()) {
      toast.error('Package name is required');
      return false;
    }
    if (!category) {
      toast.error('Please select a category');
      return false;
    }
    return true;
  };

  const validateStep2 = (): boolean => {
    // Check regional availability
    if (regionalAvailability.mode !== 'all' && regionalAvailability.regions.length === 0) {
      toast.error('Please select at least one region');
      return false;
    }

    // Calculate required regions
    const activeRegions = regions.filter(r => r.isActive);
    let requiredRegions: string[] = [];

    if (regionalAvailability.mode === 'all') {
      requiredRegions = activeRegions.map(r => r.regionId);
    } else if (regionalAvailability.mode === 'specific') {
      requiredRegions = regionalAvailability.regions;
    } else if (regionalAvailability.mode === 'exclude') {
      requiredRegions = activeRegions
        .filter(r => !regionalAvailability.regions.includes(r.regionId))
        .map(r => r.regionId);
    }

    // Check pricing for all required regions
    const missingPricing = requiredRegions.filter(regionId => {
      const pricing = regionalPricing.find(p => p.regionId === regionId);
      return !pricing || pricing.basePrice <= 0;
    });

    if (missingPricing.length > 0) {
      const missingNames = missingPricing
        .map(rid => regions.find(r => r.regionId === rid)?.regionName)
        .filter(Boolean)
        .join(', ');
      toast.error(`Missing pricing for: ${missingNames}`);
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;

    try {
      setLoading(true);

      const packageData = {
        packageName,
        description,
        category,
        packageType,
        validityType,
        validityPeriod: parseInt(validityPeriod) || undefined,
        terms: terms.split('\n').filter(t => t.trim()),
        regionalAvailability,
        regionalPricing,
      };

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/packages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(packageData),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Package created successfully!');
        resetForm();
        onSuccess();
      } else {
        toast.error(data.error || 'Failed to create package');
      }
    } catch (error) {
      console.error('Error creating package:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPackageName('');
    setDescription('');
    setCategory('');
    setPackageType('bundle');
    setValidityPeriod('');
    setValidityType('months');
    setTerms('');
    setRegionalAvailability({ mode: 'all', regions: [] });
    setRegionalPricing([]);
    setCurrentStep(1);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-4xl my-8">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Package className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg">Create Regional Package</h2>
              <p className="text-sm text-gray-600">
                Step {currentStep} of 2: {currentStep === 1 ? 'Basic Information' : 'Regional Configuration'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className={`flex-1 h-2 rounded-full ${currentStep >= 1 ? 'bg-orange-600' : 'bg-gray-300'}`} />
            <div className={`flex-1 h-2 rounded-full ${currentStep >= 2 ? 'bg-orange-600' : 'bg-gray-300'}`} />
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
          {loadingRegions ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-orange-600 animate-spin" />
            </div>
          ) : (
            <>
              {/* Step 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <Card className="p-4 border-2 border-gray-200">
                    <Label className="text-base mb-4 block">Package Details</Label>

                    <div className="space-y-4">
                      <div>
                        <Label>Package Name *</Label>
                        <Input
                          value={packageName}
                          onChange={(e) => setPackageName(e.target.value)}
                          placeholder="e.g., Basic Veterinary Checkup"
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <Label>Description</Label>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Describe what's included in this package..."
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg mt-1 min-h-[100px]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Category *</Label>
                          <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg mt-1"
                          >
                            <option value="">Select Category</option>
                            {PACKAGE_CATEGORIES.map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label>Package Type</Label>
                          <select
                            value={packageType}
                            onChange={(e) => setPackageType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg mt-1"
                          >
                            {PACKAGE_TYPES.map(type => (
                              <option key={type.id} value={type.id}>
                                {type.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Validity Period</Label>
                          <Input
                            type="number"
                            min="1"
                            value={validityPeriod}
                            onChange={(e) => setValidityPeriod(e.target.value)}
                            placeholder="e.g., 1"
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>Validity Type</Label>
                          <select
                            value={validityType}
                            onChange={(e) => setValidityType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg mt-1"
                          >
                            <option value="days">Days</option>
                            <option value="months">Months</option>
                            <option value="years">Years</option>
                            <option value="unlimited">Unlimited</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <Label>Terms & Conditions (one per line)</Label>
                        <textarea
                          value={terms}
                          onChange={(e) => setTerms(e.target.value)}
                          placeholder="Valid for 30 days&#10;Non-refundable&#10;Appointments must be booked in advance"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg mt-1 min-h-[80px]"
                        />
                      </div>
                    </div>
                  </Card>
                </div>
              )}

              {/* Step 2: Regional Configuration */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <RegionalAvailabilitySelector
                    value={regionalAvailability}
                    onChange={setRegionalAvailability}
                    availableRegions={regions}
                  />

                  <RegionalPricingEditor
                    value={regionalPricing}
                    onChange={setRegionalPricing}
                    selectedRegions={regionalAvailability.regions}
                    allRegions={regions}
                    availabilityMode={regionalAvailability.mode}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between sticky bottom-0 bg-white rounded-b-2xl">
          <div className="flex items-center gap-2">
            {currentStep === 2 && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep(1)}
                disabled={loading}
              >
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </Button>

            {currentStep === 1 ? (
              <Button
                onClick={() => {
                  if (validateStep1()) {
                    setCurrentStep(2);
                  }
                }}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Next: Regional Settings
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Create Package
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
